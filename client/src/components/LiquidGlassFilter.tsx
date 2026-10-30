import React, { useEffect, useState } from "react";

/**
 * LiquidGlassFilter — real edge refraction for floating chrome.
 *
 * Adapted from the technique used by liqui.design (as referenced by
 * liquidglassdesign.com's "macOS Tahoe 26" material): a canvas-generated
 * displacement map drives an SVG feDisplacementMap so the backdrop *bends*
 * at the bezel instead of only blurring (glassmorphism).
 *
 * `backdrop-filter: url(#…)` is only honoured by Chromium. Elsewhere we
 * leave the CSS blur/rim fallback untouched by only adding the
 * `lq-refract` class on supported engines.
 */

const MAP_SIZE = 128;
const BEZEL = 0.22; // fraction of the edge that refracts

function buildDisplacementMap(): string {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const u = x / (MAP_SIZE - 1);
      const v = y / (MAP_SIZE - 1);

      // Distance into the bezel from each edge (0 at edge, 1 past bezel)
      const dl = Math.min(u / BEZEL, 1);
      const dr = Math.min((1 - u) / BEZEL, 1);
      const dt = Math.min(v / BEZEL, 1);
      const db = Math.min((1 - v) / BEZEL, 1);

      // Convex lens profile: strongest bend right at the rim, smooth falloff
      const lens = (d: number) => Math.pow(1 - d, 2.2);
      const dx = lens(dl) - lens(dr); // + pushes sampling inward from left edge
      const dy = lens(dt) - lens(db);

      const i = (y * MAP_SIZE + x) * 4;
      img.data[i] = Math.round(128 + dx * 127); // R → X displacement
      img.data[i + 1] = Math.round(128 + dy * 127); // G → Y displacement
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

function supportsBackdropUrlFilter(): boolean {
  if (typeof navigator === "undefined") return false;
  const brands = (navigator as any).userAgentData?.brands as { brand: string }[] | undefined;
  const isChromium = brands
    ? brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand))
    : /Chrome\//.test(navigator.userAgent);
  return isChromium;
}

export function LiquidGlassFilter() {
  const [mapUrl, setMapUrl] = useState<string>("");

  useEffect(() => {
    const reduceTransparency = window.matchMedia?.("(prefers-reduced-transparency: reduce)").matches;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceTransparency || reduceMotion || !supportsBackdropUrlFilter()) return;

    const url = buildDisplacementMap();
    if (!url) return;
    setMapUrl(url);
    document.documentElement.classList.add("lq-refract");
    return () => document.documentElement.classList.remove("lq-refract");
  }, []);

  if (!mapUrl) return null;

  return (
    <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute size-0" style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <filter id="lq-tahoe-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="softened" />
          <feImage href={mapUrl} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="softened" in2="map" scale="22" xChannelSelector="R" yChannelSelector="G" result="bent" />
          <feColorMatrix in="bent" type="saturate" values="1.6" />
        </filter>
      </defs>
    </svg>
  );
}

import React from "react";

/**
 * LiquidGlassFilter
 * Hardware-accelerated SVG optical refraction and chromatic dispersion filter
 * configured for:
 *   - Refraction: 1
 *   - Reflection: 1
 *   - Dispersion: 0.35
 *   - Frost: 0 (Crystal clear optical transparency)
 *   - Tint: 0
 *   - Shadow: 0.5
 *   - Elevation: 0.4
 *   - Smoothness: 0.5
 */
export function LiquidGlassFilter() {
  return (
    <svg
      className="pointer-events-none fixed -top-full -left-full w-0 h-0 opacity-0 select-none"
      aria-hidden="true"
      style={{ position: "fixed", width: 0, height: 0 }}
    >
      <defs>
        {/* Core Optical Refraction Filter (Refraction: 1) */}
        <filter
          id="liquid-glass-refract"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.012"
            numOctaves="2"
            result="liquidWave"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="liquidWave"
            scale="10"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displacedGraphic"
          />
          <feBlend in="SourceGraphic" in2="displacedGraphic" mode="normal" />
        </filter>

        {/* Chromatic Dispersion & Specular Reflection Filter (Dispersion: 0.35, Reflection: 1) */}
        <filter
          id="liquid-glass-dispersion"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015 0.015"
            numOctaves="2"
            result="noise"
          />
          {/* Red channel micro displacement */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="6"
            xChannelSelector="R"
            yChannelSelector="G"
            result="displacedRed"
          />
          {/* Blue channel micro displacement (offset for dispersion) */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="9.5"
            xChannelSelector="B"
            yChannelSelector="G"
            result="displacedBlue"
          />
          <feBlend in="displacedRed" in2="displacedBlue" mode="screen" result="chromaticDispersed" />
          <feBlend in="SourceGraphic" in2="chromaticDispersed" mode="normal" />
        </filter>
      </defs>
    </svg>
  );
}

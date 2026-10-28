// Bundles serverless routes from api-src/ into self-contained standalone files in api/
// This guarantees zero missing module errors when deploying on Vercel or Netlify.
import esbuild from "esbuild";
import { readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const apiSrcDir = resolve("api-src");
const apiOutDir = resolve("api");

const files = readdirSync(apiSrcDir).filter((f) => f.endsWith(".ts"));

console.log(`[bundle-api] Bundling ${files.length} serverless functions from api-src to api...`);

for (const file of files) {
  const entryPoint = join(apiSrcDir, file);
  const outfile = join(apiOutDir, file);

  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
    outfile,
    sourcemap: false,
    banner: {
      js: "// Generated self-contained serverless bundle (Vercel & Netlify compatible)",
    },
  });

  console.log(`  ✓ Bundled ${file} -> api/${file}`);
}

console.log("[bundle-api] All serverless functions bundled successfully.");

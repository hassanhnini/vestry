// Copies the on-device background-removal model (ISNet, via @imgly/background-removal-data)
// and the matching ONNX Runtime WASM binaries into /public/bg-models so they are self-hosted.
// Runs automatically after `npm install`. Skips the training-only runtime to save space.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules", "@imgly", "background-removal-data", "dist");
const dest = join(process.cwd(), "public", "bg-models");

if (process.env.SKIP_BG_MODELS === "1") {
  console.log("[bg-models] SKIP_BG_MODELS=1 — not self-hosting models (set NEXT_PUBLIC_BG_MODEL_URL to a CDN).");
  process.exit(0);
}
if (!existsSync(src)) {
  console.warn("[bg-models] @imgly/background-removal-data not installed; skipping copy.");
  process.exit(0);
}

const resources = JSON.parse(readFileSync(join(src, "resources.json"), "utf8"));
const keep = Object.fromEntries(
  Object.entries(resources).filter(([key]) => !key.includes("training")),
);
mkdirSync(dest, { recursive: true });
let files = 0;
for (const entry of Object.values(keep)) {
  for (const chunk of entry.chunks) {
    const target = join(dest, chunk.hash);
    if (!existsSync(target)) cpSync(join(src, chunk.hash), target);
    files++;
  }
}
writeFileSync(join(dest, "resources.json"), JSON.stringify(keep));
console.log(`[bg-models] ${files} model/runtime chunks ready in public/bg-models`);

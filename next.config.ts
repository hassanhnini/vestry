import { existsSync } from "node:fs";
import { join } from "node:path";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import type { NextConfig } from "next";

/**
 * A production build has to be able to serve the background-removal model from somewhere: either
 * self-hosted in public/bg-models (what `npm install` does) or a CDN. With neither, the app builds
 * and deploys cleanly and then 404s the model the first time someone adds a photo — a failure that
 * is easy to ship and hard to spot. Fail the build instead.
 *
 * Only at build time: NEXT_PUBLIC_BG_MODEL_URL is inlined into the bundle then, so a server
 * started later from a correct build does not need it in its environment.
 */
function assertModelAvailable() {
  if (process.env.NEXT_PUBLIC_BG_MODEL_URL) return;
  if (existsSync(join(process.cwd(), "public", "bg-models", "resources.json"))) return;
  throw new Error(
    "No background-removal model available to this build. Either run `npm install` without SKIP_BG_MODELS=1 to self-host it, or set NEXT_PUBLIC_BG_MODEL_URL to a CDN serving @imgly/background-removal-data. See README ▸ Deployment.",
  );
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@anthropic-ai/sdk"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // On-device background-removal model + WASM runtime: immutable, content-addressed files.
        source: "/bg-models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) assertModelAvailable();
  return nextConfig;
}

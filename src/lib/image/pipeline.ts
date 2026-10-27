"use client";
// Client-side image pipeline: validate → normalise/compress → background removal → trim → sample.
// Background removal runs on-device (ISNet via ONNX Runtime WASM) with self-hosted model files,
// or through the optional server provider when one is configured.

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"];
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ORIGINAL_MAX_EDGE = 1600;
const CUTOUT_MAX_EDGE = 1200;

export class PipelineError extends Error {
  constructor(message: string, public code: "type" | "size" | "decode" | "bg-timeout" | "bg-failed" | "network" | "aborted") {
    super(message);
  }
}

export function validateFile(file: File) {
  const type = file.type || guessType(file.name);
  if (!ACCEPTED_TYPES.includes(type)) {
    throw new PipelineError("That file type isn't supported. Please use a JPEG, PNG, WebP or HEIC photo.", "type");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new PipelineError("That photo is over 20 MB. Please choose a smaller image.", "size");
  }
  if (file.size === 0) throw new PipelineError("That file is empty.", "decode");
}

function guessType(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "heic" ? "image/heic" : "";
}

export async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new PipelineError(
      "This photo couldn't be opened in your browser. If it's an iPhone HEIC photo, try exporting it as JPEG (or set Camera ▸ Formats ▸ Most Compatible).",
      "decode",
    );
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), type, quality));
}

export interface Adjustments {
  /** degrees, multiple of 90 */
  rotation?: number;
  /** crop rectangle in source pixels (after rotation) */
  crop?: { x: number; y: number; width: number; height: number } | null;
}

/** Apply rotation/crop and downscale to a high-quality JPEG suitable for storage and reprocessing. */
export async function normaliseOriginal(source: Blob, adj: Adjustments = {}): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await decode(source);
  const rot = (((adj.rotation ?? 0) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const rw = swap ? bmp.height : bmp.width;
  const rh = swap ? bmp.width : bmp.height;
  // 1) rotate into a full-size canvas
  const rc = canvas(rw, rh);
  const rctx = rc.getContext("2d")!;
  rctx.translate(rw / 2, rh / 2);
  rctx.rotate((rot * Math.PI) / 180);
  rctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  bmp.close();
  // 2) crop + scale
  const crop = adj.crop ?? { x: 0, y: 0, width: rw, height: rh };
  const scale = Math.min(1, ORIGINAL_MAX_EDGE / Math.max(crop.width, crop.height));
  const out = canvas(crop.width * scale, crop.height * scale);
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff"; // flatten any transparency in the source
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(rc, crop.x, crop.y, crop.width, crop.height, 0, 0, out.width, out.height);
  return { blob: await toBlob(out, "image/jpeg", 0.9), width: out.width, height: out.height };
}

export async function sha256(blob: Blob) {
  const buf = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type BgProvider = "local" | "server";
export type ProgressFn = (stage: string, fraction: number) => void;

function bgPublicPath() {
  const custom = process.env.NEXT_PUBLIC_BG_MODEL_URL;
  if (custom) return custom.endsWith("/") ? custom : custom + "/";
  return new URL("/bg-models/", window.location.origin).toString();
}

let modelWarm = false;
export function isModelWarm() {
  return modelWarm;
}

/** Remove the background. Returns a PNG with alpha. */
export async function removeBackground(
  image: Blob,
  opts: { provider: BgProvider; model: "small" | "medium"; onProgress?: ProgressFn; timeoutMs?: number; authToken?: string },
): Promise<Blob> {
  const timeoutMs = opts.timeoutMs ?? 180_000;
  const work =
    opts.provider === "server"
      ? removeOnServer(image, opts.authToken)
      : (async () => {
          const lib = await import("@imgly/background-removal");
          const blob = await lib.removeBackground(image, {
            publicPath: bgPublicPath(),
            model: opts.model,
            output: { format: "image/png" },
            progress: (key: string, current: number, total: number) => {
              if (!opts.onProgress) return;
              if (key.startsWith("fetch")) opts.onProgress("Downloading on-device model (one time)", total ? current / total : 0);
              else opts.onProgress("Removing background", total ? current / total : 0.5);
            },
          });
          modelWarm = true;
          return blob;
        })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new PipelineError("Background removal took too long. Check your connection and try again.", "bg-timeout")),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } catch (e) {
    if (e instanceof PipelineError) throw e;
    throw new PipelineError(
      `Background removal failed${e instanceof Error && e.message ? ` (${e.message.slice(0, 120)})` : ""}. You can retry or keep the original photo.`,
      "bg-failed",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function removeOnServer(image: Blob, token?: string) {
  const fd = new FormData();
  fd.append("image", image, "image.jpg");
  let res: Response;
  try {
    res = await fetch("/api/bg/remove", { method: "POST", body: fd, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new PipelineError("You appear to be offline. Background removal needs a connection for the server provider.", "network");
  }
  if (!res.ok) {
    const msg = (await res.json().catch(() => null))?.error ?? `Server returned ${res.status}`;
    throw new PipelineError(msg, "bg-failed");
  }
  return res.blob();
}

export interface Cutout {
  blob: Blob;
  width: number;
  height: number;
  /** Share of the original frame kept as foreground (0..1). */
  coverage: number;
}

let webpAlpha: boolean | null = null;
async function supportsWebpAlpha() {
  if (webpAlpha !== null) return webpAlpha;
  try {
    const b = await toBlob(canvas(2, 2), "image/webp", 0.9);
    webpAlpha = b.type === "image/webp";
  } catch {
    webpAlpha = false;
  }
  return webpAlpha;
}

/** Trim transparent margins, add breathing room, cap resolution and encode with alpha preserved. */
export async function finaliseCutout(png: Blob): Promise<Cutout> {
  const bmp = await decode(png);
  const c = canvas(bmp.width, bmp.height);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const { data, width, height } = img;
  // Drop faint background residue (near-transparent haze) so cut-outs sit cleanly on any backdrop.
  for (let i = 3; i < data.length; i += 4) if (data[i] < 28) data[i] = 0;
  ctx.putImageData(img, 0, 0);
  let minX = width, minY = height, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 16) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const coverage = count / (width * height);
  if (maxX < 0) throw new PipelineError("No garment was detected in this photo. Try a photo where the item fills more of the frame.", "bg-failed");
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const pad = Math.round(Math.max(bw, bh) * 0.04);
  const scale = Math.min(1, CUTOUT_MAX_EDGE / (Math.max(bw, bh) + pad * 2));
  const out = canvas((bw + pad * 2) * scale, (bh + pad * 2) * scale);
  const octx = out.getContext("2d")!;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(c, minX, minY, bw, bh, pad * scale, pad * scale, bw * scale, bh * scale);
  bmp.close();
  const blob = (await supportsWebpAlpha()) ? await toBlob(out, "image/webp", 0.92) : await toBlob(out, "image/png");
  return { blob, width: out.width, height: out.height, coverage };
}

/** Downscaled RGBA pixels for on-device colour/shape analysis. */
export async function samplePixels(blob: Blob, maxEdge = 128): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const bmp = await decode(blob);
  const s = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const c = canvas(bmp.width * s, bmp.height * s);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const img = ctx.getImageData(0, 0, c.width, c.height);
  return { data: img.data, width: img.width, height: img.height };
}

/** A compact JPEG (garment on white) for optional cloud tagging — never the full-resolution photo. */
export async function aiPreview(blob: Blob, maxEdge = 768): Promise<string> {
  const bmp = await decode(blob);
  const s = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const c = canvas(bmp.width * s, bmp.height * s);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const out = await toBlob(c, "image/jpeg", 0.85);
  const buf = new Uint8Array(await out.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

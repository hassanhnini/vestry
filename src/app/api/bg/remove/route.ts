// Optional server-side background removal through remove.bg (free tier: limited previews/month).
// Only active when REMOVE_BG_API_KEY is set; the on-device model is the default.
import { NextResponse } from "next/server";
import { authorize, HttpError } from "@/lib/ai/server";
import { jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const key = process.env.REMOVE_BG_API_KEY;
    if (!key) throw new HttpError(503, "Server background removal is not configured. Use the on-device option.");
    await authorize(req, "bg", Number(process.env.BG_LIMIT_PER_HOUR ?? 30));
    const form = await req.formData();
    const image = form.get("image");
    if (!(image instanceof Blob)) throw new HttpError(400, "No image provided.");
    if (image.size > 12 * 1024 * 1024) throw new HttpError(413, "Image is too large.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) throw new HttpError(415, "Unsupported image type.");
    const fd = new FormData();
    fd.append("image_file", image, "upload.jpg");
    fd.append("size", "auto");
    fd.append("format", "png");
    const res = await fetch("https://api.remove.bg/v1.0/removebg", { method: "POST", headers: { "X-Api-Key": key }, body: fd, signal: AbortSignal.timeout(55_000) });
    if (res.status === 402) throw new HttpError(429, "The remove.bg free credits are used up. Switch to on-device processing in Settings.");
    if (res.status === 429) throw new HttpError(429, "remove.bg is rate limiting requests. Try again shortly.");
    if (!res.ok) throw new HttpError(502, `Background removal service error (${res.status}).`);
    return new NextResponse(await res.arrayBuffer(), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}

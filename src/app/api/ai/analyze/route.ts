import { NextResponse } from "next/server";
import { z } from "zod";
import { analyseGarment, authorize, HttpError } from "@/lib/ai/server";
import { jsonError } from "@/lib/api-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  image: z.string().min(100).max(2_000_000).regex(/^[A-Za-z0-9+/=]+$/),
  hint: z.string().max(120).optional().default(""),
});

export async function POST(req: Request) {
  try {
    await authorize(req, "analyze", Number(process.env.AI_ANALYZE_LIMIT_PER_HOUR ?? 60));
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid image payload.");
    const result = await analyseGarment(parsed.data.image, parsed.data.hint);
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, HttpError, styleOutfits } from "@/lib/ai/server";
import { jsonError } from "@/lib/api-utils";
import { buildStylistPrompt } from "@/lib/stylist/prompt";
import { CATEGORY_IDS } from "@/lib/taxonomy";
import type { CompactItem } from "@/lib/ai/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

const Item = z.object({
  id: z.string().max(64),
  name: z.string().max(120),
  category: z.enum(CATEGORY_IDS as [string, ...string[]]),
  colors: z.array(z.string().max(30)).max(6),
  pattern: z.string().max(30),
  fit: z.string().max(20).optional(),
  formality: z.number().min(1).max(5),
  seasons: z.array(z.string().max(10)).max(4),
  styles: z.array(z.string().max(40)).max(12),
  wearCount: z.number().min(0).max(100000),
});

const Body = z.object({
  closet: z.array(Item).min(2).max(400),
  request: z.object({
    style: z.string().max(40).nullish(),
    customStyle: z.string().max(200).optional(),
    occasion: z.string().max(40).nullish(),
    customOccasion: z.string().max(200).optional(),
    season: z.string().max(10).nullish(),
    weather: z.string().max(10).nullish(),
    palette: z.string().max(20).optional(),
    silhouette: z.string().max(20).optional(),
    comfort: z.number().min(1).max(5).optional(),
    dressCode: z.string().max(20).optional(),
    anchorItemIds: z.array(z.string().max(64)).max(5).optional(),
    excludeItemIds: z.array(z.string().max(64)).max(200).optional(),
    preferRarelyWorn: z.boolean().optional(),
    count: z.number().min(1).max(6).optional(),
  }),
  profile: z
    .object({
      styles: z.array(z.string().max(40)).max(12).optional(),
      favoriteColors: z.array(z.string().max(30)).max(20).optional(),
      avoidColors: z.array(z.string().max(30)).max(20).optional(),
      fit: z.string().max(20).optional(),
      comfort: z.number().optional(),
      notes: z.string().max(300).optional(),
      climate: z.string().max(20).optional(),
    })
    .default({}),
  avoidSignatures: z.array(z.string().max(2000)).max(60).default([]),
});

export async function POST(req: Request) {
  try {
    await authorize(req, "stylist", Number(process.env.AI_STYLIST_LIMIT_PER_HOUR ?? 30));
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid stylist request.");
    const { closet, request, profile, avoidSignatures } = parsed.data;
    const { prompt, resolveAlias } = buildStylistPrompt(closet as CompactItem[], request as never, profile, avoidSignatures);
    const out = await styleOutfits(prompt);
    // Map aliases back to real ids. Unknown aliases are kept as-is so client-side grounding rejects them visibly.
    const outfits = out.outfits.map((o) => ({
      name: o.name,
      explanation: o.explanation,
      itemIds: o.itemIds.map((a) => resolveAlias(a) ?? `unknown:${a.slice(0, 20)}`),
    }));
    return NextResponse.json({ provider: out.provider, outfits });
  } catch (e) {
    return jsonError(e);
  }
}

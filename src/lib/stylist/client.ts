"use client";
// Orchestrates outfit generation: cloud model when chosen and available, the on-device engine
// otherwise — and always as a fallback. Model output is grounded against the closet again here.
import { generateOutfits, signatureOf, type StyleRequest } from "./engine";
import { groundOutfits } from "./grounding";
import type { ClothingItem, OutfitSource, StyleProfile } from "../types";
import type { CompactItem } from "../ai/schema";

export interface ResultOutfit {
  key: string;
  itemIds: string[];
  name: string;
  explanation: string;
  source: OutfitSource;
  signature: string;
}

export interface StylistRun {
  outfits: ResultOutfit[];
  notice?: string;
  /** Set when the cloud stylist was requested but could not be used. */
  fallbackReason?: string;
}

export function compactCloset(items: ClothingItem[]): CompactItem[] {
  return items
    .filter((i) => !i.archived)
    .map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      colors: i.colors,
      pattern: i.pattern,
      fit: i.fit,
      formality: i.formality,
      seasons: i.seasons,
      styles: i.styles,
      wearCount: i.wearCount,
    }));
}

function rules(items: ClothingItem[], req: StyleRequest, profile: StyleProfile, avoid: string[]): StylistRun {
  const r = generateOutfits(items, req, { profile, avoidSignatures: avoid });
  return {
    outfits: r.outfits.map((o) => ({ key: crypto.randomUUID(), itemIds: o.itemIds, name: o.name, explanation: o.explanation, source: "rules" as const, signature: o.signature })),
    notice: r.notice,
  };
}

export async function runStylist(opts: {
  items: ClothingItem[];
  req: StyleRequest;
  profile: StyleProfile;
  avoidSignatures: string[];
  engine: "ai" | "rules";
  token?: string;
}): Promise<StylistRun> {
  const { items, req, profile, avoidSignatures, engine, token } = opts;
  if (engine === "rules") return rules(items, req, profile, avoidSignatures);

  let fallbackReason: string | undefined;
  try {
    const res = await fetch("/api/ai/stylist", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        closet: compactCloset(items),
        request: { ...req, seed: undefined, style: req.style ?? null, occasion: req.occasion ?? null, season: req.season ?? null, weather: req.weather ?? null },
        profile: {
          styles: profile.styles,
          favoriteColors: profile.favoriteColors,
          avoidColors: profile.avoidColors,
          fit: profile.fit,
          comfort: profile.comfort,
          notes: profile.notes?.slice(0, 300),
          climate: profile.climate,
        },
        avoidSignatures: avoidSignatures.slice(0, 60),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? `Stylist service error (${res.status})`);
    const grounded = groundOutfits(body.outfits ?? [], items, { excludeItemIds: req.excludeItemIds, anchorItemIds: req.anchorItemIds });
    const source: OutfitSource = body.provider === "gemini" ? "gemini" : "claude";
    const outfits: ResultOutfit[] = grounded.outfits.map((o) => ({ key: crypto.randomUUID(), ...o, source }));
    const want = req.count ?? 4;
    let notice: string | undefined;
    if (grounded.unknownIds.length || grounded.rejected) {
      notice = `${grounded.rejected} AI suggestion${grounded.rejected === 1 ? " was" : "s were"} discarded because ${grounded.unknownIds.length ? "they referenced pieces that aren't in your closet" : "they weren't complete outfits"}.`;
    }
    if (outfits.length < want) {
      const fill = rules(items, { ...req, count: want - outfits.length }, profile, [...avoidSignatures, ...outfits.map((o) => o.signature)]);
      const added = fill.outfits.filter((f) => !outfits.some((o) => o.signature === f.signature));
      outfits.push(...added);
      if (added.length) notice = `${notice ? notice + " " : ""}${added.length} more ${added.length === 1 ? "look was" : "looks were"} added by the on-device stylist.`;
    }
    return { outfits, notice };
  } catch (e) {
    fallbackReason = (e as Error).name === "TimeoutError" ? "The AI stylist took too long." : (e as Error).message;
  }
  const r = rules(items, req, profile, avoidSignatures);
  return { ...r, fallbackReason };
}

export { signatureOf };

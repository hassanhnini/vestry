// Strict grounding for model-generated outfits: every id must exist in the user's closet,
// excluded/archived items are rejected, and each outfit must be structurally wearable.
import type { ClothingItem } from "../types";
import { roleOf, signatureOf } from "./engine";

export interface RawOutfit {
  name: string;
  itemIds: string[];
  explanation: string;
}

export interface GroundedOutfit extends RawOutfit {
  signature: string;
}

export interface GroundingReport {
  outfits: GroundedOutfit[];
  /** Ids the model returned that are not in the closet (fabricated). */
  unknownIds: string[];
  /** Outfits dropped because they became incomplete or duplicated. */
  rejected: number;
}

export function groundOutfits(
  raw: RawOutfit[],
  closet: ClothingItem[],
  opts: { excludeItemIds?: string[]; anchorItemIds?: string[] } = {},
): GroundingReport {
  const byId = new Map(closet.filter((i) => !i.archived).map((i) => [i.id, i]));
  const exclude = new Set(opts.excludeItemIds ?? []);
  const anchors = opts.anchorItemIds ?? [];
  const unknown = new Set<string>();
  const seen = new Set<string>();
  const outfits: GroundedOutfit[] = [];
  let rejected = 0;

  for (const o of raw) {
    const ids = [...new Set(o.itemIds)];
    const items: ClothingItem[] = [];
    let fabricated = false;
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) {
        unknown.add(id);
        fabricated = true;
        continue;
      }
      if (exclude.has(id)) continue;
      items.push(item);
    }
    // An outfit that referenced a non-existent garment is discarded entirely rather than
    // silently "repaired", so the explanation never describes something the user doesn't own.
    if (fabricated) { rejected++; continue; }
    const roles = items.map(roleOf);
    const count = (r: string) => roles.filter((x) => x === r).length;
    const hasBase = (count("top") >= 1 && count("bottom") === 1 && count("one-piece") === 0) || (count("one-piece") === 1 && count("bottom") === 0);
    const sane = count("shoes") <= 1 && count("outer") <= 2 && count("bag") <= 1 && count("top") <= 2;
    const anchored = anchors.every((a) => items.some((i) => i.id === a));
    if (!hasBase || !sane || !anchored) { rejected++; continue; }
    const signature = signatureOf(items.map((i) => i.id));
    if (seen.has(signature)) { rejected++; continue; }
    seen.add(signature);
    outfits.push({
      name: o.name.trim().slice(0, 80) || "Untitled outfit",
      itemIds: items.map((i) => i.id),
      explanation: o.explanation.trim().slice(0, 600),
      signature,
    });
  }
  return { outfits, unknownIds: [...unknown], rejected };
}

// What happens to saved outfits when a garment leaves the closet. Kept separate from the store so
// it can be reasoned about — and tested — without a repository or React.
import { describeOutfit, isWearable, mentionsItem } from "./stylist/engine";
import { STYLE_BY_ID } from "./taxonomy";
import type { ClothingItem, Occasion, Outfit, StyleId, StyleProfile } from "./types";

export interface ItemRemoval {
  /** Outfits to save: the piece taken out, and anything that described it rewritten. */
  updated: Outfit[];
  /** Ids of outfits that can no longer be worn and should be deleted. */
  deleted: string[];
}

/**
 * Take `itemId` out of every saved outfit that uses it.
 *
 * An outfit left without a wearable base (a top and a bottom, or a one-piece) is deleted rather
 * than kept as something the user could never put on. The ones that survive are re-described from
 * the pieces that remain, so no name or explanation refers to a garment that is no longer owned.
 * A name the user wrote themselves is left alone unless it named the deleted piece.
 *
 * `closet` is the closet as it stands *before* the deletion: the piece itself is needed to tell
 * whether an outfit's name refers to it. Without it, the name is rewritten either way.
 */
export function removeItemFromOutfits(
  itemId: string,
  outfits: Outfit[],
  closet: ClothingItem[],
  profile: StyleProfile | null = null,
  updatedAt: string = new Date().toISOString(),
): ItemRemoval {
  const removed = closet.find((i) => i.id === itemId);
  const byId = new Map(closet.map((i) => [i.id, i]));
  const updated: Outfit[] = [];
  const deleted: string[] = [];

  for (const outfit of outfits) {
    if (!outfit.itemIds.includes(itemId)) continue;
    const remaining = outfit.itemIds
      .filter((x) => x !== itemId)
      .map((x) => byId.get(x))
      .filter((i): i is ClothingItem => !!i);

    if (!isWearable(remaining)) {
      deleted.push(outfit.id);
      continue;
    }

    const fresh = describeOutfit(
      remaining,
      { style: outfit.style && outfit.style in STYLE_BY_ID ? (outfit.style as StyleId) : null, occasion: (outfit.occasion as Occasion) ?? null },
      { profile },
    );
    // The stored explanation describes a combination that no longer exists, so it is always
    // rewritten — but an outfit the user never let the stylist describe stays undescribed.
    const explanation = outfit.explanation ? fresh.explanation : "";
    updated.push({
      ...outfit,
      itemIds: remaining.map((i) => i.id),
      name: removed && mentionsItem(outfit.name, removed) ? fresh.name : outfit.name,
      explanation,
      // The standing description is now the on-device stylist's; the badge must not say otherwise.
      source: explanation && (outfit.source === "claude" || outfit.source === "gemini") ? "rules" : outfit.source,
      updatedAt,
    });
  }

  return { updated, deleted };
}

import { describe, expect, it } from "vitest";
import { removeItemFromOutfits } from "@/lib/outfits";
import type { Outfit } from "@/lib/types";
import { sampleCloset } from "./fixtures";

const closet = sampleCloset();

/** A knit layered over a tee with jeans: losing the knit still leaves a wearable outfit. */
function outfit(extra: Partial<Outfit> = {}): Outfit {
  return {
    id: "outfit-1",
    name: "Camel knitwear & denim jeans",
    itemIds: ["knit-camel", "tee-white", "jeans", "sneakers"],
    explanation: "The camel knitwear warms the white tee, and denim blue keeps it easy.",
    favorite: false,
    source: "rules",
    wearCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

/** The store runs the cascade before the piece leaves the closet, so it passes the full list. */
const remove = (id: string, o: Outfit) => removeItemFromOutfits(id, [o], closet);

describe("removing a deleted garment from saved outfits", () => {
  it("never leaves a name or explanation describing a piece the user no longer owns", () => {
    const r = remove("knit-camel", outfit());
    expect(r.deleted).toEqual([]);
    expect(r.updated).toHaveLength(1);

    const [next] = r.updated;
    expect(next.itemIds).toEqual(["tee-white", "jeans", "sneakers"]);
    expect(next.name.toLowerCase()).not.toContain("knitwear");
    expect(next.name.toLowerCase()).not.toContain("camel");
    expect(next.explanation).not.toBe(outfit().explanation);
    expect(next.explanation.toLowerCase()).not.toContain("camel");
    expect(next.updatedAt).not.toBe(outfit().updatedAt);
  });

  it("deletes an outfit left without a wearable base rather than keeping it", () => {
    // Two tops and shoes, no bottom: nothing anyone could actually put on.
    const r = remove("jeans", outfit());
    expect(r.updated).toEqual([]);
    expect(r.deleted).toEqual(["outfit-1"]);

    const topAndShoes = remove("tee-white", outfit({ itemIds: ["tee-white", "sneakers", "bag-black"] }));
    expect(topAndShoes.deleted).toEqual(["outfit-1"]);
  });

  it("keeps an outfit that still has a top and a bottom", () => {
    const r = remove("sneakers", outfit());
    expect(r.deleted).toEqual([]);
    expect(r.updated[0].itemIds).toEqual(["knit-camel", "tee-white", "jeans"]);
  });

  it("keeps a dress-based outfit, and drops it when the dress goes", () => {
    const dressy = outfit({ itemIds: ["dress-navy", "heels", "bag-black"], name: "Navy dress & black heels" });
    expect(remove("heels", dressy).updated[0].itemIds).toEqual(["dress-navy", "bag-black"]);
    expect(remove("dress-navy", dressy).deleted).toEqual(["outfit-1"]);
  });

  it("keeps a name the user wrote themselves, unless it named the deleted piece", () => {
    expect(remove("knit-camel", outfit({ name: "Tuesday client meeting" })).updated[0].name).toBe("Tuesday client meeting");
    expect(remove("knit-camel", outfit({ name: "My camel knitwear look" })).updated[0].name.toLowerCase()).not.toContain("knitwear");
  });

  it("stops crediting the AI once the on-device stylist has rewritten the description", () => {
    expect(remove("knit-camel", outfit({ source: "claude" })).updated[0].source).toBe("rules");
  });

  it("does not invent a description for an outfit that never had one", () => {
    const [next] = remove("knit-camel", outfit({ source: "manual", explanation: "" })).updated;
    expect(next.explanation).toBe("");
    expect(next.source).toBe("manual");
  });

  it("leaves outfits that do not use the piece untouched", () => {
    const r = remove("knit-camel", outfit({ id: "outfit-2", itemIds: ["shirt-blue", "trousers-black", "loafers"] }));
    expect(r.updated).toEqual([]);
    expect(r.deleted).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { groundOutfits } from "@/lib/stylist/grounding";
import { sampleCloset } from "./fixtures";

describe("grounding of model outfits", () => {
  const closet = sampleCloset();
  it("rejects outfits referencing garments the user does not own", () => {
    const r = groundOutfits(
      [
        { name: "A", itemIds: ["tee-white", "jeans", "sneakers"], explanation: "ok" },
        { name: "B", itemIds: ["tee-white", "imaginary-silk-scarf", "jeans"], explanation: "fake" },
      ],
      closet,
    );
    expect(r.outfits).toHaveLength(1);
    expect(r.unknownIds).toEqual(["imaginary-silk-scarf"]);
  });
  it("rejects incomplete, duplicate and non-anchored outfits", () => {
    const r = groundOutfits(
      [
        { name: "no bottom", itemIds: ["tee-white", "sneakers"], explanation: "" },
        { name: "dup1", itemIds: ["tee-white", "jeans"], explanation: "" },
        { name: "dup2", itemIds: ["jeans", "tee-white"], explanation: "" },
        { name: "dress+trousers", itemIds: ["dress-navy", "trousers-black"], explanation: "" },
      ],
      closet,
    );
    expect(r.outfits.map((o) => o.name)).toEqual(["dup1"]);
    const anchored = groundOutfits([{ name: "x", itemIds: ["tee-white", "jeans"], explanation: "" }], closet, { anchorItemIds: ["skirt-pink"] });
    expect(anchored.outfits).toHaveLength(0);
  });
  it("drops excluded items and archived items count as unknown", () => {
    const c = sampleCloset();
    c.find((i) => i.id === "belt")!.archived = true;
    const r = groundOutfits([{ name: "x", itemIds: ["tee-white", "jeans", "sneakers", "belt"], explanation: "" }], c, { excludeItemIds: ["sneakers"] });
    expect(r.outfits).toHaveLength(0);
    expect(r.unknownIds).toEqual(["belt"]);
  });
});

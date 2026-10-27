import { describe, expect, it } from "vitest";
import { computeInsights } from "@/lib/insights";
import { item, sampleCloset } from "./fixtures";

describe("wardrobe insights", () => {
  it("counts categories and colours", () => {
    const ins = computeInsights(sampleCloset(), [], []);
    expect(ins.total).toBe(16);
    expect(ins.byGroup.find((g) => g.id === "shoes")?.count).toBe(4);
    expect(ins.topColors[0].id).toBe("black");
  });
  it("finds versatile and never-styled items", () => {
    const c = sampleCloset();
    const outfits = [
      { id: "o1", itemIds: ["tee-white", "jeans", "sneakers"] },
      { id: "o2", itemIds: ["shirt-blue", "jeans", "loafers"] },
    ] as never;
    const ins = computeInsights(c, outfits, []);
    expect(ins.versatile[0].item.id).toBe("jeans");
    expect(ins.neverStyled.find((i) => i.id === "jeans")).toBeUndefined();
    expect(ins.neverStyled.find((i) => i.id === "coat-camel")).toBeDefined();
  });
  it("only reports dormant pieces when wear is tracked", () => {
    const c = [item("t-shirt", "white", { id: "a", createdAt: "2026-01-01T00:00:00Z", lastWornAt: "2026-02-01" })];
    expect(computeInsights(c, [], [], new Date(2026, 5, 1)).dormant).toHaveLength(0);
    const ins = computeInsights(c, [], [{ id: "w", date: "2026-02-01", itemIds: ["a"], createdAt: "" }], new Date(2026, 5, 1));
    expect(ins.dormant.map((i) => i.id)).toEqual(["a"]);
  });
  it("suggests gaps without requiring shopping", () => {
    const c = [item("t-shirt", "white"), item("shirt", "blue"), item("knitwear", "camel"), item("blouse", "red"), item("jeans", "denim")];
    const ids = computeInsights(c, [], []).gaps.map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(["shoes", "bottoms", "layer", "bag"]));
  });
});

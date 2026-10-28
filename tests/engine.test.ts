import { describe, expect, it } from "vitest";
import { alternativesFor, generateOutfits, roleOf, scoreOutfit, seasonFor } from "@/lib/stylist/engine";
import { item, sampleCloset } from "./fixtures";

const ids = (c: { id: string }[]) => new Set(c.map((i) => i.id));

describe("rules stylist", () => {
  it("only ever uses items from the closet", () => {
    const closet = sampleCloset();
    const { outfits } = generateOutfits(closet, { count: 6, season: "autumn" });
    expect(outfits.length).toBeGreaterThan(0);
    const valid = ids(closet);
    for (const o of outfits) for (const id of o.itemIds) expect(valid.has(id)).toBe(true);
  });

  it("produces structurally complete outfits", () => {
    const closet = sampleCloset();
    const { outfits } = generateOutfits(closet, { count: 5, season: "spring" });
    for (const o of outfits) {
      const roles = o.itemIds.map((id) => roleOf(closet.find((i) => i.id === id)!));
      const hasBase = (roles.includes("top") && roles.includes("bottom")) || roles.includes("one-piece");
      expect(hasBase).toBe(true);
      expect(roles.filter((r) => r === "shoes").length).toBe(1);
      expect(o.explanation.length).toBeGreaterThan(10);
    }
  });

  it("returns distinct combinations", () => {
    const { outfits } = generateOutfits(sampleCloset(), { count: 5 });
    expect(new Set(outfits.map((o) => o.signature)).size).toBe(outfits.length);
  });

  it("respects exclusions and archived items", () => {
    const closet = sampleCloset();
    closet.find((i) => i.id === "jeans")!.archived = true;
    const { outfits } = generateOutfits(closet, { count: 6, excludeItemIds: ["sneakers"] });
    for (const o of outfits) {
      expect(o.itemIds).not.toContain("jeans");
      expect(o.itemIds).not.toContain("sneakers");
    }
  });

  it("styles every outfit around an anchor item", () => {
    const { outfits } = generateOutfits(sampleCloset(), { count: 4, anchorItemIds: ["skirt-pink"] });
    expect(outfits.length).toBeGreaterThan(0);
    for (const o of outfits) expect(o.itemIds).toContain("skirt-pink");
  });

  it("adds outerwear in cold weather and avoids sandals", () => {
    const closet = sampleCloset();
    const { outfits } = generateOutfits(closet, { count: 4, weather: "cold" });
    for (const o of outfits) {
      const roles = o.itemIds.map((id) => roleOf(closet.find((i) => i.id === id)!));
      expect(roles).toContain("outer");
      expect(o.itemIds).not.toContain("sandals");
    }
  });

  it("prefers polished pieces for business dress codes", () => {
    const closet = sampleCloset();
    const { outfits } = generateOutfits(closet, { count: 1, dressCode: "business", occasion: "work", season: "autumn" });
    const top = outfits[0];
    expect(top.itemIds).not.toContain("sneakers");
    expect(top.itemIds.some((id) => ["trousers-black", "dress-navy", "blazer-navy"].includes(id))).toBe(true);
  });

  it("penalises clashing prints and colours", () => {
    const calm = scoreOutfit([item("t-shirt", "white"), item("jeans", "denim")], {}, {});
    const clash = scoreOutfit(
      [item("blouse", "orange", { pattern: "floral" }), item("skirt", "purple", { pattern: "animal" })],
      {},
      {},
    );
    expect(calm.total).toBeGreaterThan(clash.total);
  });

  it("honours colours the user avoids", () => {
    const closet = [item("t-shirt", "red", { id: "red" }), item("t-shirt", "white", { id: "white" }), item("jeans", "denim", { id: "j" }), item("sneakers", "white", { id: "s" })];
    const profile = { avoidColors: ["red"] } as never;
    const { outfits } = generateOutfits(closet, { count: 1 }, { profile });
    expect(outfits[0].itemIds).toContain("white");
  });

  it("explains when the closet is too small", () => {
    const res = generateOutfits([item("sneakers", "white")], {});
    expect(res.outfits).toHaveLength(0);
    expect(res.notice).toMatch(/top and one bottom/);
  });

  it("varies results with a new seed", () => {
    const closet = sampleCloset();
    const a = generateOutfits(closet, { count: 3, seed: 1 }).outfits.map((o) => o.signature);
    const sigs = new Set<string>(a);
    for (let s = 2; s < 8; s++) generateOutfits(closet, { count: 3, seed: s }).outfits.forEach((o) => sigs.add(o.signature));
    expect(sigs.size).toBeGreaterThan(3);
  });

  it("ranks alternatives for a slot using only owned items", () => {
    const closet = sampleCloset();
    const alts = alternativesFor(closet, ["tee-white", "jeans", "sneakers"], "shoes", {});
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) {
      expect(roleOf(a.item)).toBe("shoes");
      expect(a.item.id).not.toBe("sneakers");
    }
  });
});

describe("today's season", () => {
  const january = new Date("2026-01-15T12:00:00Z");
  const july = new Date("2026-07-15T12:00:00Z");

  it("follows the northern hemisphere when nothing is set", () => {
    expect(seasonFor(january)).toBe("winter");
    expect(seasonFor(july)).toBe("summer");
    expect(seasonFor(january, { hemisphere: "northern" })).toBe("winter");
  });

  it("flips for someone south of the equator", () => {
    expect(seasonFor(january, { hemisphere: "southern" })).toBe("summer");
    expect(seasonFor(july, { hemisphere: "southern" })).toBe("winter");
    expect(seasonFor(new Date("2026-10-15T12:00:00Z"), { hemisphere: "southern" })).toBe("spring");
  });

  it("still lets the climate override the calendar", () => {
    expect(seasonFor(july, { hemisphere: "southern", climate: "tropical" })).toBe("summer");
    expect(seasonFor(new Date("2026-04-15T12:00:00Z"), { hemisphere: "southern", climate: "cold" })).toBe("winter");
  });
});

import { describe, expect, it } from "vitest";
import { EMPTY_FILTER, filterItems } from "@/lib/closet-filter";
import { sampleCloset } from "./fixtures";

describe("closet filtering", () => {
  const closet = sampleCloset();
  it("filters by category group", () => {
    const r = filterItems(closet, { ...EMPTY_FILTER, group: "shoes" });
    expect(r.map((i) => i.id).sort()).toEqual(["heels", "loafers", "sandals", "sneakers"]);
  });
  it("searches names, categories and colours with all terms", () => {
    expect(filterItems(closet, { ...EMPTY_FILTER, query: "navy" }).map((i) => i.id).sort()).toEqual(["blazer-navy", "dress-navy"]);
    expect(filterItems(closet, { ...EMPTY_FILTER, query: "navy blazer" }).map((i) => i.id)).toEqual(["blazer-navy"]);
  });
  it("hides archived unless requested and supports favourites", () => {
    const c = sampleCloset();
    c[0].archived = true;
    c[1].favorite = true;
    expect(filterItems(c, EMPTY_FILTER).find((i) => i.id === c[0].id)).toBeUndefined();
    expect(filterItems(c, { ...EMPTY_FILTER, showArchived: true }).length).toBe(c.length);
    expect(filterItems(c, { ...EMPTY_FILTER, favoritesOnly: true }).map((i) => i.id)).toEqual([c[1].id]);
  });
  it("filters by colour and sorts by colour", () => {
    const r = filterItems(closet, { ...EMPTY_FILTER, colors: ["black"], sort: "name" });
    expect(r.every((i) => i.colors.includes("black"))).toBe(true);
    expect(r.map((i) => i.name)).toEqual([...r.map((i) => i.name)].sort());
  });
});

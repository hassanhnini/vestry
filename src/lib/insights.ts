import { CATEGORIES, COLOR_BY_ID, GROUPS } from "./taxonomy";
import { daysSince } from "./dates";
import { roleOf } from "./stylist/engine";
import type { ClothingItem, Outfit, WearLog } from "./types";

export interface Insights {
  total: number;
  byGroup: { id: string; label: string; count: number }[];
  topColors: { id: string; label: string; hex: string; count: number }[];
  neverStyled: ClothingItem[];
  dormant: ClothingItem[];
  versatile: { item: ClothingItem; outfits: number }[];
  gaps: { id: string; title: string; body: string }[];
  tracksWear: boolean;
}

export function computeInsights(items: ClothingItem[], outfits: Outfit[], wear: WearLog[], now = new Date()): Insights {
  const active = items.filter((i) => !i.archived);
  const byGroup = GROUPS.map((g) => ({ id: g.id, label: g.label, count: active.filter((i) => CATEGORIES[i.category]?.group === g.id).length })).filter((g) => g.count > 0);
  const colorCounts = new Map<string, number>();
  for (const i of active) if (i.colors[0]) colorCounts.set(i.colors[0], (colorCounts.get(i.colors[0]) ?? 0) + 1);
  const topColors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, count]) => ({ id, label: COLOR_BY_ID[id]?.label ?? id, hex: COLOR_BY_ID[id]?.hex ?? "#999", count }));

  const usage = new Map<string, number>();
  for (const o of outfits) for (const id of o.itemIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  const neverStyled = active.filter((i) => !usage.has(i.id));
  const tracksWear = wear.length > 0;
  const dormant = tracksWear
    ? active.filter((i) => daysSince(i.lastWornAt, now) > 60 && daysSince(i.createdAt.slice(0, 10), now) > 14).sort((a, b) => (a.lastWornAt ?? "").localeCompare(b.lastWornAt ?? ""))
    : [];
  const versatile = active
    .filter((i) => usage.has(i.id))
    .map((item) => ({ item, outfits: usage.get(item.id)! }))
    .sort((a, b) => b.outfits - a.outfits)
    .slice(0, 6);

  const count = (pred: (i: ClothingItem) => boolean) => active.filter(pred).length;
  const tops = count((i) => roleOf(i) === "top");
  const bottoms = count((i) => roleOf(i) === "bottom");
  const shoes = active.filter((i) => roleOf(i) === "shoes");
  const gaps: Insights["gaps"] = [];
  if (active.length >= 3) {
    if (!shoes.length) gaps.push({ id: "shoes", title: "No shoes yet", body: "Adding even one pair you already own will complete every outfit." });
    else if (!shoes.some((s) => COLOR_BY_ID[s.colors[0]]?.neutral)) gaps.push({ id: "neutral-shoes", title: "A neutral shoe", body: "Black, white or tan shoes would pair with most of your closet." });
    if (tops >= 4 && bottoms <= 1) gaps.push({ id: "bottoms", title: "More bottoms would multiply your outfits", body: `You have ${tops} tops but ${bottoms} bottom${bottoms === 1 ? "" : "s"}. One versatile trouser or skirt adds many combinations.` });
    if (bottoms >= 4 && tops <= 1) gaps.push({ id: "tops", title: "More tops would multiply your outfits", body: `You have ${bottoms} bottoms but ${tops} top${tops === 1 ? "" : "s"}.` });
    if (!count((i) => roleOf(i) === "outer")) gaps.push({ id: "layer", title: "A layer for cooler days", body: "A blazer, trench or knit cardigan would let the stylist build looks for colder weather." });
    if (!count((i) => roleOf(i) === "bag")) gaps.push({ id: "bag", title: "Add your everyday bag", body: "Bags finish outfits — photograph the one you carry most." });
  }
  return { total: active.length, byGroup, topColors, neverStyled, dormant, versatile, gaps, tracksWear };
}

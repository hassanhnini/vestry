import { CATEGORIES, COLORS, categoryLabel } from "./taxonomy";
import type { CategoryGroup, ClothingItem, Occasion, Season, StyleId } from "./types";

export type SortKey = "recent" | "category" | "color" | "favorites" | "name" | "least-worn";

export interface ClosetFilter {
  query: string;
  group: CategoryGroup | "all";
  colors: string[];
  seasons: Season[];
  styles: StyleId[];
  occasions: Occasion[];
  favoritesOnly: boolean;
  showArchived: boolean;
  sort: SortKey;
}

export const EMPTY_FILTER: ClosetFilter = {
  query: "",
  group: "all",
  colors: [],
  seasons: [],
  styles: [],
  occasions: [],
  favoritesOnly: false,
  showArchived: false,
  sort: "recent",
};

export function activeFilterCount(f: ClosetFilter) {
  return f.colors.length + f.seasons.length + f.styles.length + f.occasions.length + (f.favoritesOnly ? 1 : 0) + (f.showArchived ? 1 : 0);
}

const colorOrder = Object.fromEntries(COLORS.map((c, i) => [c.id, i]));
const categoryOrder = Object.fromEntries(Object.keys(CATEGORIES).map((c, i) => [c, i]));

export function filterItems(items: ClothingItem[], f: ClosetFilter) {
  const q = f.query.trim().toLowerCase();
  const out = items.filter((i) => {
    if (!f.showArchived && i.archived) return false;
    if (f.group !== "all" && CATEGORIES[i.category]?.group !== f.group) return false;
    if (f.favoritesOnly && !i.favorite) return false;
    if (f.colors.length && !i.colors.some((c) => f.colors.includes(c))) return false;
    if (f.seasons.length && !i.seasons.some((s) => f.seasons.includes(s))) return false;
    if (f.styles.length && !i.styles.some((s) => f.styles.includes(s))) return false;
    if (f.occasions.length && !i.occasions.some((o) => f.occasions.includes(o))) return false;
    if (q) {
      const hay = [i.name, categoryLabel(i.category), i.brand, i.material, ...i.colors, i.notes].filter(Boolean).join(" ").toLowerCase();
      if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  const by: Record<SortKey, (a: ClothingItem, b: ClothingItem) => number> = {
    recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
    category: (a, b) => categoryOrder[a.category] - categoryOrder[b.category] || a.name.localeCompare(b.name),
    color: (a, b) => (colorOrder[a.colors[0]] ?? 99) - (colorOrder[b.colors[0]] ?? 99) || a.name.localeCompare(b.name),
    favorites: (a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt.localeCompare(a.createdAt),
    name: (a, b) => a.name.localeCompare(b.name),
    "least-worn": (a, b) => a.wearCount - b.wearCount || (a.lastWornAt ?? "").localeCompare(b.lastWornAt ?? ""),
  };
  return out.sort(by[f.sort]);
}

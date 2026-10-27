import type { Category, ClothingItem } from "@/lib/types";
import { CATEGORIES, COLOR_BY_ID } from "@/lib/taxonomy";

let n = 0;
export function item(category: Category, color: string, extra: Partial<ClothingItem> = {}): ClothingItem {
  const info = CATEGORIES[category];
  const id = extra.id ?? `${category}-${color}-${++n}`;
  return {
    id,
    name: `${COLOR_BY_ID[color]?.label ?? color} ${info.label}`,
    category,
    colors: [color],
    colorHex: [COLOR_BY_ID[color]?.hex ?? "#888888"],
    pattern: "solid",
    styles: [],
    seasons: info.seasons,
    occasions: [],
    formality: info.formality,
    favorite: false,
    archived: false,
    imageOriginal: `local/${id}/original.jpg`,
    imageCutout: `local/${id}/cutout.png`,
    ai: { source: "manual", confidence: {}, reviewed: true },
    wearCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

export function sampleCloset() {
  return [
    item("t-shirt", "white", { id: "tee-white" }),
    item("shirt", "light-blue", { id: "shirt-blue" }),
    item("knitwear", "camel", { id: "knit-camel" }),
    item("blouse", "red", { id: "blouse-red" }),
    item("jeans", "denim", { id: "jeans" }),
    item("trousers", "black", { id: "trousers-black" }),
    item("skirt", "fuchsia", { id: "skirt-pink", pattern: "floral" }),
    item("dress", "navy", { id: "dress-navy" }),
    item("blazer", "navy", { id: "blazer-navy" }),
    item("coat", "camel", { id: "coat-camel" }),
    item("sneakers", "white", { id: "sneakers" }),
    item("loafers", "black", { id: "loafers" }),
    item("heels", "black", { id: "heels" }),
    item("sandals", "beige", { id: "sandals" }),
    item("handbag", "black", { id: "bag-black" }),
    item("belt", "brown", { id: "belt" }),
  ];
}

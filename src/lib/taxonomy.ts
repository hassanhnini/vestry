import type { Category, CategoryGroup, Occasion, Pattern, Role, Season, StyleId, Fit } from "./types";

export interface CategoryInfo {
  label: string;
  group: CategoryGroup;
  role: Role;
  /** Typical formality 1..5 */
  formality: number;
  /** 0 = no warmth (sandals) … 3 = very warm (coat) */
  warmth: number;
  seasons: Season[];
}

const ALL: Season[] = ["spring", "summer", "autumn", "winter"];
const MILD: Season[] = ["spring", "summer", "autumn"];
const COOL: Season[] = ["spring", "autumn", "winter"];

export const CATEGORIES: Record<Category, CategoryInfo> = {
  "t-shirt": { label: "T-shirt", group: "tops", role: "top", formality: 1, warmth: 0, seasons: MILD },
  "tank-top": { label: "Tank top", group: "tops", role: "top", formality: 1, warmth: 0, seasons: ["spring", "summer"] },
  shirt: { label: "Shirt", group: "tops", role: "top", formality: 3, warmth: 1, seasons: ALL },
  blouse: { label: "Blouse", group: "tops", role: "top", formality: 3, warmth: 1, seasons: ALL },
  knitwear: { label: "Knitwear", group: "tops", role: "top", formality: 2, warmth: 2, seasons: COOL },
  cardigan: { label: "Cardigan", group: "tops", role: "top", formality: 2, warmth: 2, seasons: COOL },
  sweatshirt: { label: "Sweatshirt", group: "tops", role: "top", formality: 1, warmth: 2, seasons: COOL },
  jeans: { label: "Jeans", group: "bottoms", role: "bottom", formality: 2, warmth: 1, seasons: ALL },
  trousers: { label: "Tailored trousers", group: "bottoms", role: "bottom", formality: 4, warmth: 1, seasons: ALL },
  "wide-leg-trousers": { label: "Wide-leg trousers", group: "bottoms", role: "bottom", formality: 3, warmth: 1, seasons: ALL },
  skirt: { label: "Skirt", group: "bottoms", role: "bottom", formality: 3, warmth: 0, seasons: ALL },
  shorts: { label: "Shorts", group: "bottoms", role: "bottom", formality: 1, warmth: 0, seasons: ["spring", "summer"] },
  leggings: { label: "Leggings", group: "bottoms", role: "bottom", formality: 1, warmth: 1, seasons: COOL },
  dress: { label: "Dress", group: "dresses", role: "one-piece", formality: 3, warmth: 0, seasons: ALL },
  jumpsuit: { label: "Jumpsuit", group: "dresses", role: "one-piece", formality: 3, warmth: 1, seasons: ALL },
  blazer: { label: "Blazer", group: "outerwear", role: "outer", formality: 4, warmth: 1, seasons: ALL },
  jacket: { label: "Jacket", group: "outerwear", role: "outer", formality: 2, warmth: 2, seasons: COOL },
  "leather-jacket": { label: "Leather jacket", group: "outerwear", role: "outer", formality: 2, warmth: 2, seasons: COOL },
  coat: { label: "Coat", group: "outerwear", role: "outer", formality: 4, warmth: 3, seasons: ["autumn", "winter"] },
  trench: { label: "Trench coat", group: "outerwear", role: "outer", formality: 4, warmth: 2, seasons: ["spring", "autumn"] },
  sneakers: { label: "Sneakers", group: "shoes", role: "shoes", formality: 1, warmth: 1, seasons: ALL },
  heels: { label: "Heels", group: "shoes", role: "shoes", formality: 4, warmth: 0, seasons: ALL },
  flats: { label: "Flats", group: "shoes", role: "shoes", formality: 3, warmth: 0, seasons: MILD },
  loafers: { label: "Loafers", group: "shoes", role: "shoes", formality: 3, warmth: 1, seasons: ALL },
  boots: { label: "Boots", group: "shoes", role: "shoes", formality: 3, warmth: 2, seasons: COOL },
  sandals: { label: "Sandals", group: "shoes", role: "shoes", formality: 2, warmth: 0, seasons: ["spring", "summer"] },
  handbag: { label: "Handbag", group: "bags", role: "bag", formality: 3, warmth: 0, seasons: ALL },
  tote: { label: "Tote", group: "bags", role: "bag", formality: 2, warmth: 0, seasons: ALL },
  crossbody: { label: "Crossbody bag", group: "bags", role: "bag", formality: 2, warmth: 0, seasons: ALL },
  clutch: { label: "Clutch", group: "bags", role: "bag", formality: 5, warmth: 0, seasons: ALL },
  backpack: { label: "Backpack", group: "bags", role: "bag", formality: 1, warmth: 0, seasons: ALL },
  belt: { label: "Belt", group: "accessories", role: "accessory", formality: 3, warmth: 0, seasons: ALL },
  scarf: { label: "Scarf", group: "accessories", role: "accessory", formality: 3, warmth: 2, seasons: COOL },
  jewelry: { label: "Jewellery", group: "accessories", role: "accessory", formality: 3, warmth: 0, seasons: ALL },
  hat: { label: "Hat", group: "accessories", role: "accessory", formality: 2, warmth: 1, seasons: ALL },
  sunglasses: { label: "Sunglasses", group: "accessories", role: "accessory", formality: 2, warmth: 0, seasons: ["spring", "summer"] },
  other: { label: "Other", group: "accessories", role: "accessory", formality: 2, warmth: 0, seasons: ALL },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as Category[];

export const GROUPS: { id: CategoryGroup; label: string }[] = [
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "dresses", label: "Dresses" },
  { id: "outerwear", label: "Outerwear" },
  { id: "shoes", label: "Shoes" },
  { id: "bags", label: "Bags" },
  { id: "accessories", label: "Accessories" },
];

export interface NamedColor {
  id: string;
  label: string;
  hex: string;
  /** Neutrals pair with almost anything. */
  neutral: boolean;
}

/** Fashion colour vocabulary. Measured pixels are mapped to the nearest entry in CIELAB space. */
export const COLORS: NamedColor[] = [
  { id: "black", label: "Black", hex: "#1c1c1c", neutral: true },
  { id: "charcoal", label: "Charcoal", hex: "#45474b", neutral: true },
  { id: "grey", label: "Grey", hex: "#9a9a9a", neutral: true },
  { id: "white", label: "White", hex: "#f7f7f5", neutral: true },
  { id: "ivory", label: "Ivory", hex: "#efe7d6", neutral: true },
  { id: "beige", label: "Beige", hex: "#d8c6a8", neutral: true },
  { id: "camel", label: "Camel", hex: "#b88a57", neutral: true },
  { id: "brown", label: "Brown", hex: "#6b4630", neutral: true },
  { id: "taupe", label: "Taupe", hex: "#8f8072", neutral: true },
  { id: "navy", label: "Navy", hex: "#1f2a44", neutral: true },
  { id: "denim", label: "Denim blue", hex: "#4a6383", neutral: true },
  { id: "light-blue", label: "Light blue", hex: "#a9c3dd", neutral: false },
  { id: "blue", label: "Blue", hex: "#2f5fb3", neutral: false },
  { id: "olive", label: "Olive", hex: "#6b6b3a", neutral: true },
  { id: "khaki", label: "Khaki", hex: "#a39a6e", neutral: true },
  { id: "green", label: "Green", hex: "#2f7a4a", neutral: false },
  { id: "sage", label: "Sage", hex: "#a6b39a", neutral: false },
  { id: "teal", label: "Teal", hex: "#1f6f73", neutral: false },
  { id: "burgundy", label: "Burgundy", hex: "#6d1f2c", neutral: false },
  { id: "red", label: "Red", hex: "#c0282d", neutral: false },
  { id: "rust", label: "Rust", hex: "#a2512b", neutral: false },
  { id: "orange", label: "Orange", hex: "#e07a2e", neutral: false },
  { id: "mustard", label: "Mustard", hex: "#c99a2e", neutral: false },
  { id: "yellow", label: "Yellow", hex: "#ecd04a", neutral: false },
  { id: "pink", label: "Pink", hex: "#e8a3b5", neutral: false },
  { id: "blush", label: "Blush", hex: "#e9c9c0", neutral: false },
  { id: "fuchsia", label: "Fuchsia", hex: "#c2276f", neutral: false },
  { id: "lilac", label: "Lilac", hex: "#b9a6d3", neutral: false },
  { id: "purple", label: "Purple", hex: "#5d3a86", neutral: false },
  { id: "gold", label: "Gold", hex: "#c9a64a", neutral: false },
  { id: "silver", label: "Silver", hex: "#c3c6ca", neutral: true },
];

export const COLOR_BY_ID: Record<string, NamedColor> = Object.fromEntries(COLORS.map((c) => [c.id, c]));

export const PATTERNS: { id: Pattern; label: string; bold: boolean }[] = [
  { id: "solid", label: "Solid", bold: false },
  { id: "denim", label: "Denim", bold: false },
  { id: "textured", label: "Textured", bold: false },
  { id: "striped", label: "Striped", bold: false },
  { id: "checked", label: "Checked / plaid", bold: true },
  { id: "floral", label: "Floral", bold: true },
  { id: "polka-dot", label: "Polka dot", bold: true },
  { id: "animal", label: "Animal print", bold: true },
  { id: "graphic", label: "Graphic / logo", bold: true },
  { id: "abstract", label: "Abstract print", bold: true },
];

export const SEASONS: { id: Season; label: string }[] = [
  { id: "spring", label: "Spring" },
  { id: "summer", label: "Summer" },
  { id: "autumn", label: "Autumn" },
  { id: "winter", label: "Winter" },
];

export const OCCASIONS: { id: Occasion; label: string; formality: [number, number] }[] = [
  { id: "everyday", label: "Everyday", formality: [1, 3] },
  { id: "work", label: "Work", formality: [3, 4] },
  { id: "university", label: "University", formality: [1, 3] },
  { id: "date", label: "Date", formality: [2, 4] },
  { id: "dinner", label: "Dinner", formality: [3, 5] },
  { id: "travel", label: "Travel", formality: [1, 3] },
  { id: "weekend", label: "Weekend", formality: [1, 2] },
  { id: "party", label: "Party", formality: [3, 5] },
  { id: "formal", label: "Formal event", formality: [4, 5] },
  { id: "sport", label: "Active", formality: [1, 1] },
];

export const FITS: { id: Fit; label: string }[] = [
  { id: "fitted", label: "Fitted" },
  { id: "regular", label: "Regular" },
  { id: "relaxed", label: "Relaxed" },
  { id: "oversized", label: "Oversized" },
];

export interface StyleInfo {
  id: StyleId;
  label: string;
  blurb: string;
  /** Categories that read strongly in this aesthetic. */
  categories: Category[];
  /** Colours the aesthetic gravitates to. */
  colors: string[];
  formality: [number, number];
  patterns: Pattern[];
  /** Preferred palette approach */
  palette: "tonal" | "neutral" | "contrast" | "colorful";
}

export const STYLES: StyleInfo[] = [
  {
    id: "elevated-high-street",
    label: "Elevated high street",
    blurb: "Trend-aware pieces styled with polish.",
    categories: ["blazer", "wide-leg-trousers", "loafers", "knitwear", "trench", "handbag", "shirt", "jeans", "boots"],
    colors: ["black", "white", "camel", "beige", "grey", "navy", "denim", "burgundy"],
    formality: [2, 4],
    patterns: ["solid", "denim", "striped", "textured"],
    palette: "neutral",
  },
  {
    id: "chic-casual",
    label: "Chic casual",
    blurb: "Easy staples with one considered detail.",
    categories: ["t-shirt", "jeans", "knitwear", "sneakers", "flats", "tote", "trench", "shirt"],
    colors: ["white", "navy", "denim", "beige", "black", "light-blue", "camel"],
    formality: [1, 3],
    patterns: ["solid", "denim", "striped"],
    palette: "neutral",
  },
  {
    id: "minimalist",
    label: "Minimalist",
    blurb: "Clean lines, few colours, nothing extra.",
    categories: ["t-shirt", "trousers", "wide-leg-trousers", "coat", "knitwear", "loafers", "sneakers", "tote"],
    colors: ["black", "white", "grey", "charcoal", "ivory", "beige", "taupe"],
    formality: [2, 4],
    patterns: ["solid", "textured"],
    palette: "tonal",
  },
  {
    id: "old-money",
    label: "Old money",
    blurb: "Heritage tailoring, cashmere and quiet colour.",
    categories: ["blazer", "knitwear", "cardigan", "shirt", "trousers", "loafers", "trench", "coat", "skirt", "belt", "scarf"],
    colors: ["navy", "ivory", "camel", "white", "brown", "green", "burgundy", "beige", "light-blue"],
    formality: [3, 5],
    patterns: ["solid", "striped", "checked", "textured"],
    palette: "neutral",
  },
  {
    id: "parisian",
    label: "Parisian",
    blurb: "Effortless, a little undone, always flattering.",
    categories: ["shirt", "blouse", "jeans", "trench", "flats", "loafers", "knitwear", "skirt", "dress", "handbag", "scarf"],
    colors: ["navy", "white", "black", "denim", "red", "beige", "ivory"],
    formality: [2, 4],
    patterns: ["solid", "striped", "denim", "polka-dot", "floral"],
    palette: "contrast",
  },
  {
    id: "scandinavian",
    label: "Scandinavian",
    blurb: "Relaxed volumes, soft neutrals, practical layers.",
    categories: ["knitwear", "wide-leg-trousers", "coat", "sneakers", "boots", "tote", "cardigan", "jeans"],
    colors: ["white", "ivory", "grey", "beige", "black", "sage", "light-blue", "taupe"],
    formality: [1, 3],
    patterns: ["solid", "textured", "striped"],
    palette: "tonal",
  },
  {
    id: "streetwear",
    label: "Streetwear",
    blurb: "Sneakers first, graphic energy, relaxed fits.",
    categories: ["sweatshirt", "t-shirt", "jeans", "sneakers", "jacket", "backpack", "crossbody", "hat", "shorts"],
    colors: ["black", "white", "grey", "olive", "red", "blue", "khaki"],
    formality: [1, 2],
    patterns: ["solid", "graphic", "denim", "abstract"],
    palette: "contrast",
  },
  {
    id: "quiet-luxury",
    label: "Quiet luxury",
    blurb: "Exceptional basics in a hushed, tonal palette.",
    categories: ["knitwear", "trousers", "wide-leg-trousers", "coat", "loafers", "handbag", "shirt", "blazer"],
    colors: ["ivory", "camel", "beige", "taupe", "grey", "navy", "brown", "white", "black"],
    formality: [3, 5],
    patterns: ["solid", "textured"],
    palette: "tonal",
  },
  {
    id: "smart-casual",
    label: "Smart casual",
    blurb: "Polished enough for the office, relaxed enough for after.",
    categories: ["shirt", "blazer", "knitwear", "trousers", "jeans", "loafers", "boots", "sneakers", "handbag", "belt"],
    colors: ["navy", "white", "light-blue", "grey", "camel", "black", "denim"],
    formality: [2, 4],
    patterns: ["solid", "striped", "checked", "denim"],
    palette: "neutral",
  },
  {
    id: "feminine",
    label: "Feminine",
    blurb: "Soft colour, fluid shapes, romantic details.",
    categories: ["dress", "blouse", "skirt", "cardigan", "heels", "flats", "handbag", "jewelry", "sandals"],
    colors: ["blush", "pink", "ivory", "lilac", "white", "light-blue", "sage", "red"],
    formality: [2, 4],
    patterns: ["solid", "floral", "polka-dot", "textured"],
    palette: "colorful",
  },
  {
    id: "edgy",
    label: "Edgy",
    blurb: "Leather, black and sharp contrast.",
    categories: ["leather-jacket", "boots", "jeans", "t-shirt", "skirt", "belt", "crossbody", "jewelry"],
    colors: ["black", "charcoal", "grey", "white", "burgundy", "silver"],
    formality: [1, 3],
    patterns: ["solid", "graphic", "animal", "denim"],
    palette: "contrast",
  },
  {
    id: "trendy",
    label: "Trendy",
    blurb: "This season's colour and proportion plays.",
    categories: ["wide-leg-trousers", "blazer", "skirt", "boots", "handbag", "jacket", "knitwear", "loafers"],
    colors: ["burgundy", "brown", "olive", "red", "lilac", "camel", "black"],
    formality: [2, 4],
    patterns: ["solid", "animal", "checked", "striped"],
    palette: "colorful",
  },
];

export const STYLE_BY_ID = Object.fromEntries(STYLES.map((s) => [s.id, s])) as Record<StyleId, StyleInfo>;

export function categoryLabel(c: Category) {
  return CATEGORIES[c]?.label ?? "Item";
}

export function colorLabel(id: string) {
  return COLOR_BY_ID[id]?.label ?? id;
}

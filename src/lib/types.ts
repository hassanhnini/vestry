// Core domain model shared by the UI, the storage adapters and the stylist engines.

export type CategoryGroup =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "bags"
  | "accessories";

/** The slot an item fills when an outfit is assembled. */
export type Role = "top" | "bottom" | "one-piece" | "outer" | "shoes" | "bag" | "accessory";

export type Category =
  | "t-shirt"
  | "tank-top"
  | "shirt"
  | "blouse"
  | "knitwear"
  | "cardigan"
  | "sweatshirt"
  | "jeans"
  | "trousers"
  | "wide-leg-trousers"
  | "skirt"
  | "shorts"
  | "leggings"
  | "dress"
  | "jumpsuit"
  | "blazer"
  | "jacket"
  | "leather-jacket"
  | "coat"
  | "trench"
  | "sneakers"
  | "heels"
  | "flats"
  | "loafers"
  | "boots"
  | "sandals"
  | "handbag"
  | "tote"
  | "crossbody"
  | "clutch"
  | "backpack"
  | "belt"
  | "scarf"
  | "jewelry"
  | "hat"
  | "sunglasses"
  | "other";

export type Pattern =
  | "solid"
  | "striped"
  | "checked"
  | "floral"
  | "polka-dot"
  | "animal"
  | "graphic"
  | "abstract"
  | "denim"
  | "textured";

export type Season = "spring" | "summer" | "autumn" | "winter";

export type Occasion =
  | "everyday"
  | "work"
  | "university"
  | "date"
  | "dinner"
  | "travel"
  | "weekend"
  | "party"
  | "formal"
  | "sport";

export type StyleId =
  | "elevated-high-street"
  | "chic-casual"
  | "minimalist"
  | "old-money"
  | "parisian"
  | "scandinavian"
  | "streetwear"
  | "quiet-luxury"
  | "smart-casual"
  | "feminine"
  | "edgy"
  | "trendy";

export type Fit = "fitted" | "regular" | "relaxed" | "oversized";

/** Where a piece of metadata came from, so the UI never overstates certainty. */
export type AiSource = "claude" | "gemini" | "on-device" | "manual";

export interface AiMeta {
  source: AiSource;
  /** 0..1 per field. Absent = not predicted. */
  confidence: Partial<Record<"category" | "colors" | "pattern" | "material" | "seasons" | "occasions" | "styles" | "formality", number>>;
  /** True once the user has looked at / confirmed the suggestions. */
  reviewed: boolean;
  notes?: string;
}

export interface ClothingItem {
  id: string;
  name: string;
  category: Category;
  /** Named colour ids (see COLORS), dominant first. */
  colors: string[];
  /** Measured hex values from the actual image, dominant first. */
  colorHex: string[];
  pattern: Pattern;
  material?: string;
  fit?: Fit;
  styles: StyleId[];
  seasons: Season[];
  occasions: Occasion[];
  /** 1 = very casual … 5 = formal */
  formality: number;
  brand?: string;
  notes?: string;
  favorite: boolean;
  archived: boolean;
  /** Storage path of the (downscaled) original photo. */
  imageOriginal: string;
  /** Storage path of the transparent cutout, or null when background removal was skipped/failed. */
  imageCutout: string | null;
  imageHash?: string;
  ai: AiMeta;
  wearCount: number;
  lastWornAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type OutfitSource = "rules" | "claude" | "gemini" | "manual";

export interface Outfit {
  id: string;
  name: string;
  itemIds: string[];
  style?: string;
  occasion?: string;
  explanation: string;
  notes?: string;
  favorite: boolean;
  source: OutfitSource;
  wearCount: number;
  lastWornAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerEntry {
  id: string;
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  outfitId: string;
  event?: string;
  worn: boolean;
  createdAt: string;
}

export interface WearLog {
  id: string;
  date: string;
  outfitId?: string;
  itemIds: string[];
  createdAt: string;
}

export type Climate = "cold" | "temperate" | "warm" | "tropical";

/** Which half of the world the user dresses in — it decides what season "today" is. */
export type Hemisphere = "northern" | "southern";

export interface StyleProfile {
  displayName: string;
  styles: StyleId[];
  favoriteColors: string[];
  avoidColors: string[];
  occasions: Occasion[];
  city?: string;
  climate?: Climate;
  /** Defaults to northern when unset, which is what the seasons assumed before this existed. */
  hemisphere?: Hemisphere;
  fit: "relaxed" | "tailored" | "mixed";
  /** 1 = style over comfort … 5 = comfort first */
  comfort: number;
  notes?: string;
  onboarded: boolean;
  /** User consent to send photos to a cloud AI provider for tagging. */
  cloudAi: boolean;
  bgModel: "small" | "medium";
}

export interface WardrobeSnapshot {
  version: 1;
  exportedAt: string;
  items: ClothingItem[];
  outfits: Outfit[];
  planner: PlannerEntry[];
  wear: WearLog[];
  profile: StyleProfile | null;
}

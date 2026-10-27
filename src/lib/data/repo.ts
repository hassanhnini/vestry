import type { ClothingItem, Outfit, PlannerEntry, StyleProfile, WardrobeSnapshot, WearLog } from "../types";

/**
 * Storage abstraction. The UI only talks to this interface, so the same app runs on
 * on-device storage (demo mode, IndexedDB) or on Supabase (Postgres + private Storage).
 */
export interface Repo {
  readonly mode: "local" | "cloud";

  listItems(): Promise<ClothingItem[]>;
  saveItem(item: ClothingItem): Promise<void>;
  deleteItem(id: string): Promise<void>;

  listOutfits(): Promise<Outfit[]>;
  saveOutfit(outfit: Outfit): Promise<void>;
  deleteOutfit(id: string): Promise<void>;

  listPlanner(): Promise<PlannerEntry[]>;
  savePlanner(entry: PlannerEntry): Promise<void>;
  deletePlanner(id: string): Promise<void>;

  listWear(): Promise<WearLog[]>;
  saveWear(log: WearLog): Promise<void>;
  deleteWear(id: string): Promise<void>;

  getProfile(): Promise<StyleProfile | null>;
  saveProfile(profile: StyleProfile): Promise<void>;

  /** Store an image blob under a repo-relative key such as `<itemId>/cutout.png`. Returns the storage path. */
  putImage(key: string, blob: Blob): Promise<string>;
  /** Resolve a storage path to a URL the browser can display. */
  getImageUrl(path: string): Promise<string>;
  getImageBlob(path: string): Promise<Blob | null>;
  deleteImage(path: string): Promise<void>;

  exportAll(): Promise<WardrobeSnapshot>;
  /** Remove every record and image belonging to the current user. */
  clearAll(): Promise<void>;
}

export const DEFAULT_PROFILE: StyleProfile = {
  displayName: "",
  styles: [],
  favoriteColors: [],
  avoidColors: [],
  occasions: [],
  fit: "mixed",
  comfort: 3,
  onboarded: false,
  cloudAi: false,
  bgModel: "medium",
};

export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

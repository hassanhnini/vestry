// Demo-mode storage: everything (records and image blobs) lives in this browser's IndexedDB.
// Nothing is uploaded anywhere; data does not sync between devices.
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ClothingItem, Outfit, PlannerEntry, StyleProfile, WardrobeSnapshot, WearLog } from "../types";
import type { Repo } from "./repo";

interface VestryDB extends DBSchema {
  items: { key: string; value: ClothingItem };
  outfits: { key: string; value: Outfit };
  planner: { key: string; value: PlannerEntry; indexes: { byDate: string } };
  wear: { key: string; value: WearLog };
  kv: { key: string; value: unknown };
  images: { key: string; value: Blob };
}

const DB_NAME = "vestry-local";

export class LocalRepo implements Repo {
  readonly mode = "local" as const;
  private dbp: Promise<IDBPDatabase<VestryDB>>;
  private urls = new Map<string, string>();

  constructor(name = DB_NAME) {
    this.dbp = openDB<VestryDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore("items", { keyPath: "id" });
        db.createObjectStore("outfits", { keyPath: "id" });
        const planner = db.createObjectStore("planner", { keyPath: "id" });
        planner.createIndex("byDate", "date");
        db.createObjectStore("wear", { keyPath: "id" });
        db.createObjectStore("kv");
        db.createObjectStore("images");
      },
    });
  }

  async listItems() {
    return (await this.dbp).getAll("items");
  }
  async saveItem(item: ClothingItem) {
    await (await this.dbp).put("items", item);
  }
  async deleteItem(id: string) {
    const db = await this.dbp;
    const item = await db.get("items", id);
    const tx = db.transaction(["items", "images"], "readwrite");
    await tx.objectStore("items").delete(id);
    if (item) {
      for (const p of [item.imageOriginal, item.imageCutout]) if (p) await tx.objectStore("images").delete(p);
    }
    await tx.done;
    if (item) [item.imageOriginal, item.imageCutout].forEach((p) => p && this.revoke(p));
  }

  async listOutfits() {
    return (await this.dbp).getAll("outfits");
  }
  async saveOutfit(outfit: Outfit) {
    await (await this.dbp).put("outfits", outfit);
  }
  async deleteOutfit(id: string) {
    await (await this.dbp).delete("outfits", id);
  }

  async listPlanner() {
    return (await this.dbp).getAll("planner");
  }
  async savePlanner(entry: PlannerEntry) {
    await (await this.dbp).put("planner", entry);
  }
  async deletePlanner(id: string) {
    await (await this.dbp).delete("planner", id);
  }

  async listWear() {
    return (await this.dbp).getAll("wear");
  }
  async saveWear(log: WearLog) {
    await (await this.dbp).put("wear", log);
  }
  async deleteWear(id: string) {
    await (await this.dbp).delete("wear", id);
  }

  async getProfile() {
    return ((await (await this.dbp).get("kv", "profile")) as StyleProfile | undefined) ?? null;
  }
  async saveProfile(profile: StyleProfile) {
    await (await this.dbp).put("kv", profile, "profile");
  }

  async putImage(key: string, blob: Blob) {
    const path = `local/${key}`;
    await (await this.dbp).put("images", blob, path);
    this.revoke(path);
    return path;
  }
  async getImageBlob(path: string) {
    return (await (await this.dbp).get("images", path)) ?? null;
  }
  cachedImageUrl(path: string) {
    return this.urls.get(path) ?? null;
  }
  async refreshImageUrl(path: string) {
    // Object URLs do not expire, but the blob behind one can have been replaced.
    this.revoke(path);
    return this.getImageUrl(path);
  }
  async getImageUrl(path: string) {
    const cached = this.urls.get(path);
    if (cached) return cached;
    const blob = await this.getImageBlob(path);
    if (!blob) throw new Error("Image not found");
    const url = URL.createObjectURL(blob);
    this.urls.set(path, url);
    return url;
  }
  async deleteImage(path: string) {
    await (await this.dbp).delete("images", path);
    this.revoke(path);
  }
  private revoke(path: string) {
    const u = this.urls.get(path);
    if (u) URL.revokeObjectURL(u);
    this.urls.delete(path);
  }

  async exportAll(): Promise<WardrobeSnapshot> {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: await this.listItems(),
      outfits: await this.listOutfits(),
      planner: await this.listPlanner(),
      wear: await this.listWear(),
      profile: await this.getProfile(),
    };
  }

  async clearAll() {
    const db = await this.dbp;
    const tx = db.transaction(["items", "outfits", "planner", "wear", "kv", "images"], "readwrite");
    await Promise.all(["items", "outfits", "planner", "wear", "kv", "images"].map((s) => tx.objectStore(s as "items").clear()));
    await tx.done;
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls.clear();
  }
}

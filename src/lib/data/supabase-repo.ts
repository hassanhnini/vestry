// Cloud storage: Supabase Postgres (RLS-protected) + a private Storage bucket.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClothingItem, Outfit, PlannerEntry, StyleProfile, WardrobeSnapshot, WearLog } from "../types";
import type { Repo } from "./repo";

const BUCKET = "wardrobe";
const SIGNED_URL_TTL = 60 * 60; // seconds

type Row = Record<string, unknown>;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const itemToRow = (i: ClothingItem, userId: string): Row => ({
  id: i.id,
  user_id: userId,
  name: i.name,
  category: i.category,
  colors: i.colors,
  color_hex: i.colorHex,
  pattern: i.pattern,
  material: i.material ?? null,
  fit: i.fit ?? null,
  styles: i.styles,
  seasons: i.seasons,
  occasions: i.occasions,
  formality: i.formality,
  brand: i.brand ?? null,
  notes: i.notes ?? null,
  favorite: i.favorite,
  archived: i.archived,
  image_original: i.imageOriginal,
  image_cutout: i.imageCutout,
  image_hash: i.imageHash ?? null,
  ai: i.ai,
  wear_count: i.wearCount,
  last_worn_at: i.lastWornAt ?? null,
  created_at: i.createdAt,
});

const rowToItem = (r: Row): ClothingItem => ({
  id: r.id as string,
  name: r.name as string,
  category: r.category as ClothingItem["category"],
  colors: (r.colors as string[]) ?? [],
  colorHex: (r.color_hex as string[]) ?? [],
  pattern: r.pattern as ClothingItem["pattern"],
  material: (r.material as string) ?? undefined,
  fit: (r.fit as ClothingItem["fit"]) ?? undefined,
  styles: (r.styles as ClothingItem["styles"]) ?? [],
  seasons: (r.seasons as ClothingItem["seasons"]) ?? [],
  occasions: (r.occasions as ClothingItem["occasions"]) ?? [],
  formality: r.formality as number,
  brand: (r.brand as string) ?? undefined,
  notes: (r.notes as string) ?? undefined,
  favorite: r.favorite as boolean,
  archived: r.archived as boolean,
  imageOriginal: r.image_original as string,
  imageCutout: (r.image_cutout as string) ?? null,
  imageHash: (r.image_hash as string) ?? undefined,
  ai: r.ai as ClothingItem["ai"],
  wearCount: r.wear_count as number,
  lastWornAt: (r.last_worn_at as string) ?? undefined,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export class SupabaseRepo implements Repo {
  readonly mode = "cloud" as const;
  private urls = new Map<string, { url: string; expires: number }>();

  constructor(private sb: SupabaseClient, private userId: string) {}

  async listItems() {
    const data = check(await this.sb.from("clothing_items").select("*").order("created_at", { ascending: false }));
    const items = (data as Row[]).map(rowToItem);
    await this.prefetchUrls(items.flatMap((i) => [i.imageCutout, i.imageOriginal]).filter(Boolean) as string[]);
    return items;
  }
  async saveItem(item: ClothingItem) {
    check(await this.sb.from("clothing_items").upsert(itemToRow(item, this.userId)));
  }
  async deleteItem(id: string) {
    const rows = check(await this.sb.from("clothing_items").select("image_original,image_cutout").eq("id", id)) as Row[];
    check(await this.sb.from("clothing_items").delete().eq("id", id));
    const paths = rows.flatMap((r) => [r.image_original, r.image_cutout]).filter(Boolean) as string[];
    if (paths.length) await this.sb.storage.from(BUCKET).remove(paths);
  }

  async listOutfits() {
    const data = check(
      await this.sb.from("outfits").select("*, outfit_items(item_id, position)").order("created_at", { ascending: false }),
    ) as Row[];
    return data.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      itemIds: ((r.outfit_items as { item_id: string; position: number }[]) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((x) => x.item_id),
      style: (r.style as string) ?? undefined,
      occasion: (r.occasion as string) ?? undefined,
      explanation: r.explanation as string,
      notes: (r.notes as string) ?? undefined,
      favorite: r.favorite as boolean,
      source: r.source as Outfit["source"],
      wearCount: r.wear_count as number,
      lastWornAt: (r.last_worn_at as string) ?? undefined,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));
  }
  async saveOutfit(o: Outfit) {
    check(
      await this.sb.from("outfits").upsert({
        id: o.id,
        user_id: this.userId,
        name: o.name,
        style: o.style ?? null,
        occasion: o.occasion ?? null,
        explanation: o.explanation,
        notes: o.notes ?? null,
        favorite: o.favorite,
        source: o.source,
        wear_count: o.wearCount,
        last_worn_at: o.lastWornAt ?? null,
        created_at: o.createdAt,
      }),
    );
    check(await this.sb.from("outfit_items").delete().eq("outfit_id", o.id));
    if (o.itemIds.length)
      check(
        await this.sb
          .from("outfit_items")
          .insert(o.itemIds.map((item_id, position) => ({ outfit_id: o.id, item_id, position, user_id: this.userId }))),
      );
  }
  async deleteOutfit(id: string) {
    check(await this.sb.from("outfits").delete().eq("id", id));
  }

  async listPlanner() {
    const data = check(await this.sb.from("planner_entries").select("*").order("date")) as Row[];
    return data.map((r) => ({
      id: r.id as string,
      date: r.date as string,
      outfitId: r.outfit_id as string,
      event: (r.event as string) ?? undefined,
      worn: r.worn as boolean,
      createdAt: r.created_at as string,
    }));
  }
  async savePlanner(e: PlannerEntry) {
    check(
      await this.sb.from("planner_entries").upsert({
        id: e.id,
        user_id: this.userId,
        date: e.date,
        outfit_id: e.outfitId,
        event: e.event ?? null,
        worn: e.worn,
        created_at: e.createdAt,
      }),
    );
  }
  async deletePlanner(id: string) {
    check(await this.sb.from("planner_entries").delete().eq("id", id));
  }

  async listWear() {
    const data = check(await this.sb.from("wear_logs").select("*").order("date", { ascending: false })) as Row[];
    return data.map((r) => ({
      id: r.id as string,
      date: r.date as string,
      outfitId: (r.outfit_id as string) ?? undefined,
      itemIds: (r.item_ids as string[]) ?? [],
      createdAt: r.created_at as string,
    }));
  }
  async saveWear(w: WearLog) {
    check(
      await this.sb.from("wear_logs").upsert({
        id: w.id,
        user_id: this.userId,
        date: w.date,
        outfit_id: w.outfitId ?? null,
        item_ids: w.itemIds,
        created_at: w.createdAt,
      }),
    );
  }
  async deleteWear(id: string) {
    check(await this.sb.from("wear_logs").delete().eq("id", id));
  }

  async getProfile() {
    const data = check(await this.sb.from("profiles").select("display_name, style_profile").eq("id", this.userId).maybeSingle()) as Row | null;
    if (!data || !data.style_profile || Object.keys(data.style_profile as object).length === 0) return null;
    return { ...(data.style_profile as StyleProfile), displayName: (data.display_name as string) ?? "" };
  }
  async saveProfile(p: StyleProfile) {
    check(
      await this.sb.from("profiles").upsert({ id: this.userId, display_name: p.displayName.slice(0, 80), style_profile: p }),
    );
  }

  async putImage(key: string, blob: Blob) {
    const path = `${this.userId}/${key}`;
    check(
      await this.sb.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type || "image/png", cacheControl: "3600" }),
    );
    this.urls.delete(path);
    return path;
  }
  private async prefetchUrls(paths: string[]) {
    const missing = paths.filter((p) => !this.fresh(p));
    if (!missing.length) return;
    const { data } = await this.sb.storage.from(BUCKET).createSignedUrls(missing, SIGNED_URL_TTL);
    for (const d of data ?? []) if (d.signedUrl && d.path) this.urls.set(d.path, { url: d.signedUrl, expires: Date.now() + (SIGNED_URL_TTL - 120) * 1000 });
  }
  private fresh(path: string) {
    const c = this.urls.get(path);
    return c && c.expires > Date.now() ? c.url : null;
  }
  cachedImageUrl(path: string) {
    return this.fresh(path);
  }
  async refreshImageUrl(path: string) {
    this.urls.delete(path);
    return this.getImageUrl(path);
  }
  async getImageUrl(path: string) {
    const cached = this.fresh(path);
    if (cached) return cached;
    const data = check(await this.sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL));
    if (!data) throw new Error("Image not found");
    this.urls.set(path, { url: data.signedUrl, expires: Date.now() + (SIGNED_URL_TTL - 120) * 1000 });
    return data.signedUrl;
  }
  async getImageBlob(path: string) {
    const { data, error } = await this.sb.storage.from(BUCKET).download(path);
    if (error) return null;
    return data;
  }
  async deleteImage(path: string) {
    await this.sb.storage.from(BUCKET).remove([path]);
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
    // Rows cascade from outfits/items; storage objects are removed explicitly.
    for (const t of ["planner_entries", "wear_logs", "outfits", "clothing_items"]) {
      check(await this.sb.from(t).delete().eq("user_id", this.userId));
    }
    await this.sb.from("profiles").update({ style_profile: {} }).eq("id", this.userId);
    const folders = check(await this.sb.storage.from(BUCKET).list(this.userId, { limit: 1000 }));
    for (const f of folders ?? []) {
      const files = check(await this.sb.storage.from(BUCKET).list(`${this.userId}/${f.name}`, { limit: 100 }));
      const paths = (files ?? []).map((x) => `${this.userId}/${f.name}/${x.name}`);
      if (paths.length) await this.sb.storage.from(BUCKET).remove(paths);
    }
  }
}

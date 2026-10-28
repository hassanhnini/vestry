"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { LocalRepo } from "./data/local-repo";
import { SupabaseRepo } from "./data/supabase-repo";
import { DEFAULT_PROFILE, newId, nowIso, type Repo } from "./data/repo";
import { removeItemFromOutfits } from "./outfits";
import { supabase } from "./supabase/client";
import type { ClothingItem, Outfit, PlannerEntry, StyleProfile, WearLog } from "./types";
import { localDate } from "./dates";

interface WardrobeState {
  repo: Repo | null;
  ready: boolean;
  error: string | null;
  items: ClothingItem[];
  outfits: Outfit[];
  planner: PlannerEntry[];
  wear: WearLog[];
  profile: StyleProfile;
  hasProfile: boolean;
  reload(): Promise<void>;
  saveItem(item: ClothingItem): Promise<void>;
  updateItem(id: string, patch: Partial<ClothingItem>): Promise<void>;
  deleteItem(id: string): Promise<{ removedOutfits: number }>;
  saveOutfit(o: Omit<Outfit, "id" | "createdAt" | "updatedAt" | "wearCount" | "favorite"> & Partial<Outfit>): Promise<Outfit>;
  updateOutfit(id: string, patch: Partial<Outfit>): Promise<void>;
  deleteOutfit(id: string): Promise<void>;
  planOutfit(date: string, outfitId: string, event?: string): Promise<PlannerEntry>;
  updatePlanner(id: string, patch: Partial<PlannerEntry>): Promise<void>;
  removePlanner(id: string): Promise<void>;
  logWear(itemIds: string[], date?: string, outfitId?: string): Promise<void>;
  removeWear(id: string): Promise<void>;
  saveProfile(p: Partial<StyleProfile>): Promise<void>;
}

const Ctx = createContext<WardrobeState | null>(null);

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const { status, user, mode } = useAuth();
  const userId = user?.id ?? null;
  // Keyed on the user id so token refreshes don't rebuild the repository and reload everything.
  const repo = useMemo<Repo | null>(
    () => (status === "signed-in" && userId ? (mode === "cloud" ? new SupabaseRepo(supabase(), userId) : new LocalRepo()) : null),
    [status, userId, mode],
  );
  const [loadedFor, setLoadedFor] = useState<Repo | null>(null);
  const ready = !!repo && loadedFor === repo;
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [planner, setPlanner] = useState<PlannerEntry[]>([]);
  const [wear, setWear] = useState<WearLog[]>([]);
  const [profile, setProfile] = useState<StyleProfile>(DEFAULT_PROFILE);
  const [hasProfile, setHasProfile] = useState(false);
  const stateRef = useRef({ items, outfits, planner, wear, profile });
  useEffect(() => {
    stateRef.current = { items, outfits, planner, wear, profile };
  }, [items, outfits, planner, wear, profile]);

  const load = useCallback((r: Repo) => {
    return Promise.all([r.listItems(), r.listOutfits(), r.listPlanner(), r.listWear(), r.getProfile()])
      .then(([i, o, p, w, prof]) => {
        setError(null);
        setItems(i.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setOutfits(o.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setPlanner(p);
        setWear(w.sort((a, b) => b.date.localeCompare(a.date)));
        setProfile({ ...DEFAULT_PROFILE, ...(prof ?? {}) });
        setHasProfile(!!prof);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your wardrobe."))
      .finally(() => setLoadedFor(r));
  }, []);

  useEffect(() => {
    if (repo) load(repo);
  }, [repo, load]);

  const reload = useCallback(async () => {
    if (repo) await load(repo);
  }, [repo, load]);

  const need = useCallback(() => {
    if (!repo) throw new Error("Not signed in");
    return repo;
  }, [repo]);

  const saveItem = useCallback(async (item: ClothingItem) => {
    await need().saveItem(item);
    setItems((xs) => [item, ...xs.filter((x) => x.id !== item.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [need]);

  const updateItem = useCallback(async (id: string, patch: Partial<ClothingItem>) => {
    const cur = stateRef.current.items.find((i) => i.id === id);
    if (!cur) throw new Error("Item not found");
    const next = { ...cur, ...patch, updatedAt: nowIso() };
    await need().saveItem(next);
    setItems((xs) => xs.map((x) => (x.id === id ? next : x)));
  }, [need]);

  const deleteOutfitInternal = useCallback(async (r: Repo, id: string) => {
    for (const p of stateRef.current.planner.filter((p) => p.outfitId === id)) await r.deletePlanner(p.id);
    await r.deleteOutfit(id);
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const r = need();
    // Safe deletion: outfits left unwearable go, and the rest are rewritten so nothing they say
    // refers to a garment the user no longer owns.
    const { updated, deleted } = removeItemFromOutfits(id, stateRef.current.outfits, stateRef.current.items, stateRef.current.profile, nowIso());
    for (const outfitId of deleted) await deleteOutfitInternal(r, outfitId);
    for (const outfit of updated) await r.saveOutfit(outfit);
    await r.deleteItem(id);
    const removedIds = new Set(deleted);
    const byId = new Map(updated.map((o) => [o.id, o]));
    setItems((xs) => xs.filter((x) => x.id !== id));
    setOutfits((os) => os.filter((o) => !removedIds.has(o.id)).map((o) => byId.get(o.id) ?? o));
    setPlanner((ps) => ps.filter((p) => !removedIds.has(p.outfitId)));
    return { removedOutfits: deleted.length };
  }, [need, deleteOutfitInternal]);

  const saveOutfit: WardrobeState["saveOutfit"] = useCallback(async (o) => {
    const ts = nowIso();
    const outfit: Outfit = {
      id: o.id ?? newId(),
      name: o.name,
      itemIds: o.itemIds,
      style: o.style,
      occasion: o.occasion,
      explanation: o.explanation,
      notes: o.notes,
      favorite: o.favorite ?? false,
      source: o.source,
      wearCount: o.wearCount ?? 0,
      lastWornAt: o.lastWornAt,
      createdAt: o.createdAt ?? ts,
      updatedAt: ts,
    };
    await need().saveOutfit(outfit);
    setOutfits((os) => [outfit, ...os.filter((x) => x.id !== outfit.id)]);
    return outfit;
  }, [need]);

  const updateOutfit = useCallback(async (id: string, patch: Partial<Outfit>) => {
    const cur = stateRef.current.outfits.find((o) => o.id === id);
    if (!cur) throw new Error("Outfit not found");
    const next = { ...cur, ...patch, updatedAt: nowIso() };
    await need().saveOutfit(next);
    setOutfits((os) => os.map((o) => (o.id === id ? next : o)));
  }, [need]);

  const deleteOutfit = useCallback(async (id: string) => {
    await deleteOutfitInternal(need(), id);
    setOutfits((os) => os.filter((o) => o.id !== id));
    setPlanner((ps) => ps.filter((p) => p.outfitId !== id));
  }, [need, deleteOutfitInternal]);

  const planOutfit = useCallback(async (date: string, outfitId: string, event?: string) => {
    const entry: PlannerEntry = { id: newId(), date, outfitId, event: event?.slice(0, 120) || undefined, worn: false, createdAt: nowIso() };
    await need().savePlanner(entry);
    setPlanner((ps) => [...ps, entry]);
    return entry;
  }, [need]);

  const updatePlanner = useCallback(async (id: string, patch: Partial<PlannerEntry>) => {
    const cur = stateRef.current.planner.find((p) => p.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    await need().savePlanner(next);
    setPlanner((ps) => ps.map((p) => (p.id === id ? next : p)));
  }, [need]);

  const removePlanner = useCallback(async (id: string) => {
    await need().deletePlanner(id);
    setPlanner((ps) => ps.filter((p) => p.id !== id));
  }, [need]);

  const logWear = useCallback(async (itemIds: string[], date = localDate(new Date()), outfitId?: string) => {
    const r = need();
    const log: WearLog = { id: newId(), date, outfitId, itemIds, createdAt: nowIso() };
    await r.saveWear(log);
    const s = stateRef.current;
    const changedItems: ClothingItem[] = [];
    for (const id of itemIds) {
      const it = s.items.find((i) => i.id === id);
      if (!it) continue;
      const next = { ...it, wearCount: it.wearCount + 1, lastWornAt: !it.lastWornAt || it.lastWornAt < date ? date : it.lastWornAt, updatedAt: nowIso() };
      await r.saveItem(next);
      changedItems.push(next);
    }
    let changedOutfit: Outfit | null = null;
    if (outfitId) {
      const o = s.outfits.find((x) => x.id === outfitId);
      if (o) {
        changedOutfit = { ...o, wearCount: o.wearCount + 1, lastWornAt: !o.lastWornAt || o.lastWornAt < date ? date : o.lastWornAt, updatedAt: nowIso() };
        await r.saveOutfit(changedOutfit);
      }
    }
    setWear((ws) => [log, ...ws].sort((a, b) => b.date.localeCompare(a.date)));
    setItems((xs) => xs.map((x) => changedItems.find((c) => c.id === x.id) ?? x));
    if (changedOutfit) setOutfits((os) => os.map((o) => (o.id === changedOutfit!.id ? changedOutfit! : o)));
  }, [need]);

  const removeWear = useCallback(async (id: string) => {
    const r = need();
    const log = stateRef.current.wear.find((w) => w.id === id);
    if (!log) return;
    await r.deleteWear(id);
    const changedItems: ClothingItem[] = [];
    for (const iid of log.itemIds) {
      const it = stateRef.current.items.find((i) => i.id === iid);
      if (!it) continue;
      const next = { ...it, wearCount: Math.max(0, it.wearCount - 1), updatedAt: nowIso() };
      await r.saveItem(next);
      changedItems.push(next);
    }
    if (log.outfitId) {
      const o = stateRef.current.outfits.find((x) => x.id === log.outfitId);
      if (o) {
        const next = { ...o, wearCount: Math.max(0, o.wearCount - 1), updatedAt: nowIso() };
        await r.saveOutfit(next);
        setOutfits((os) => os.map((x) => (x.id === next.id ? next : x)));
      }
    }
    setWear((ws) => ws.filter((w) => w.id !== id));
    setItems((xs) => xs.map((x) => changedItems.find((c) => c.id === x.id) ?? x));
  }, [need]);

  const saveProfile = useCallback(async (p: Partial<StyleProfile>) => {
    const next = { ...stateRef.current.profile, ...p };
    await need().saveProfile(next);
    setProfile(next);
    setHasProfile(true);
  }, [need]);

  const value = useMemo<WardrobeState>(
    () => ({
      repo, ready, error, items, outfits, planner, wear, profile, hasProfile, reload,
      saveItem, updateItem, deleteItem, saveOutfit, updateOutfit, deleteOutfit,
      planOutfit, updatePlanner, removePlanner, logWear, removeWear, saveProfile,
    }),
    [repo, ready, error, items, outfits, planner, wear, profile, hasProfile, reload, saveItem, updateItem, deleteItem, saveOutfit, updateOutfit, deleteOutfit, planOutfit, updatePlanner, removePlanner, logWear, removeWear, saveProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWardrobe() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWardrobe outside WardrobeProvider");
  return c;
}

/** Resolve a storage path to a displayable URL (object URL in demo mode, signed URL in cloud mode). */
/** How many times one image may be resolved again after the browser failed to load it. */
const IMAGE_RETRIES = 1;

export function useImageUrl(path: string | null | undefined) {
  const { repo } = useWardrobe();
  const [state, setState] = useState<{ path: string; url: string | null; failed: boolean } | null>(null);
  const [retry, setRetry] = useState({ path: "", n: 0 });
  const attempts = useRef({ path: "", n: 0 });

  useEffect(() => {
    if (!path || !repo) return;
    let alive = true;
    // Cloud image links are signed and expire, so a retry asks the repository to sign a new one
    // rather than handing back the link the browser has just refused.
    const resolving = retry.path === path && retry.n > 0 ? repo.refreshImageUrl(path) : repo.getImageUrl(path);
    resolving
      .then((url) => alive && setState({ path, url, failed: false }))
      .catch(() => alive && setState({ path, url: null, failed: true }));
    return () => {
      alive = false;
    };
  }, [path, repo, retry]);

  /** The browser could not load the link. False once there is nothing left to try. */
  const reload = useCallback(() => {
    if (!path) return false;
    if (attempts.current.path !== path) attempts.current = { path, n: 0 };
    if (attempts.current.n >= IMAGE_RETRIES) return false;
    attempts.current = { path, n: attempts.current.n + 1 };
    setRetry(attempts.current);
    return true;
  }, [path]);

  if (!path) return { url: null, failed: false, reload };
  if (state?.path === path) return { url: state.url, failed: state.failed, reload };
  // Nothing resolved for this path yet: paint a link the repository knows is still good.
  return { url: repo?.cachedImageUrl(path) ?? null, failed: false, reload };
}

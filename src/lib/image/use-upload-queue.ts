"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWardrobe } from "../store";
import { useAuth } from "../auth";
import { useAiStatus } from "../ai/status";
import { analyseLocally, defaultOccasions, itemName } from "../ai/local-analyze";
import type { Analysis, GarmentAnalysis } from "../ai/schema";
import { CATEGORIES } from "../taxonomy";
import { newId, nowIso } from "../data/repo";
import type { ClothingItem } from "../types";
import type { ItemForm } from "@/components/closet/item-editor";
import {
  PipelineError,
  aiPreview,
  finaliseCutout,
  normaliseOriginal,
  removeBackground,
  samplePixels,
  sha256,
  validateFile,
  type Adjustments,
} from "./pipeline";

export type DraftStatus = "queued" | "preparing" | "removing" | "analyzing" | "ready" | "error" | "saving" | "saved";

export interface Draft {
  key: string;
  file: File;
  status: DraftStatus;
  stage: string;
  progress: number | null;
  error?: string;
  errorCode?: PipelineError["code"];
  adjustments: Adjustments;
  original?: Blob;
  originalUrl?: string;
  sourceUrl: string;
  cutout?: Blob | null;
  cutoutUrl?: string;
  coverage?: number;
  hash?: string;
  duplicateOf?: string;
  analysis?: Analysis;
  aiNote?: string;
  form?: ItemForm;
  savedId?: string;
}

/**
 * Cut-outs for photos already processed, so adding the same picture twice never runs the model
 * again. Capped, because a bulk add of thirty photos on a phone should not hold thirty cut-outs
 * in memory for the rest of the session.
 */
const CUTOUT_CACHE_MAX = 8;
const cutoutCache = new Map<string, Blob>();

function rememberCutout(hash: string, blob: Blob) {
  cutoutCache.delete(hash);
  cutoutCache.set(hash, blob);
  while (cutoutCache.size > CUTOUT_CACHE_MAX) {
    const oldest = cutoutCache.keys().next().value;
    if (oldest === undefined) break;
    cutoutCache.delete(oldest);
  }
}

function recallCutout(hash: string) {
  const blob = cutoutCache.get(hash);
  if (blob) rememberCutout(hash, blob);
  return blob ?? null;
}

function releaseUrls(d: Pick<Draft, "sourceUrl" | "originalUrl" | "cutoutUrl">) {
  for (const u of [d.sourceUrl, d.originalUrl, d.cutoutUrl]) if (u) URL.revokeObjectURL(u);
}

function analysisToForm(a: Analysis): ItemForm {
  return {
    name: a.name,
    category: a.category,
    colors: a.colors,
    colorHex: a.colorHex,
    pattern: a.pattern,
    material: a.material,
    fit: a.fit,
    styles: a.styles,
    seasons: a.seasons,
    occasions: a.occasions,
    formality: a.formality,
  };
}

/** Merge a cloud result with on-device measurements (measured swatches are always kept). */
function mergeCloud(local: Analysis, cloud: GarmentAnalysis & { provider: "claude" | "gemini" }): Analysis {
  const info = CATEGORIES[cloud.category] ?? CATEGORIES[local.category];
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const formality = Math.round(Math.max(1, Math.min(5, cloud.formality || info.formality)));
  return {
    category: cloud.category,
    name: cloud.name?.trim().slice(0, 120) || itemName(cloud.category, cloud.colors),
    colors: cloud.colors.length ? cloud.colors.slice(0, 3) : local.colors,
    colorHex: local.colorHex,
    pattern: cloud.pattern,
    material: cloud.material ?? undefined,
    fit: cloud.fit ?? undefined,
    styles: cloud.styles.slice(0, 3),
    seasons: cloud.seasons.length ? cloud.seasons : info.seasons,
    occasions: cloud.occasions.length ? cloud.occasions : defaultOccasions(formality),
    formality,
    confidence: {
      category: clamp(cloud.confidence.category),
      colors: clamp(cloud.confidence.colors),
      pattern: clamp(cloud.confidence.pattern),
      material: clamp(cloud.confidence.material),
      seasons: 0.6,
      occasions: 0.55,
      styles: 0.5,
      formality: 0.6,
    },
    source: cloud.provider,
    notes: cloud.notes ?? undefined,
  };
}

export function useUploadQueue() {
  const { items, profile, repo, saveItem } = useWardrobe();
  const { getToken } = useAuth();
  const { status: ai } = useAiStatus();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const running = useRef(false);
  const draftsRef = useRef(drafts);
  const itemsRef = useRef(items);
  useEffect(() => {
    draftsRef.current = drafts;
    itemsRef.current = items;
  }, [drafts, items]);

  const patch = useCallback((key: string, p: Partial<Draft>) => {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...p } : d)));
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).slice(0, 30);
    const next: Draft[] = list.map((file) => {
      const d: Draft = {
        key: newId(),
        file,
        status: "queued",
        stage: "Waiting",
        progress: null,
        adjustments: {},
        sourceUrl: URL.createObjectURL(file),
      };
      try {
        validateFile(file);
      } catch (e) {
        d.status = "error";
        d.error = (e as Error).message;
        d.errorCode = (e as PipelineError).code;
      }
      return d;
    });
    setDrafts((ds) => [...ds, ...next]);
    return next.length;
  }, []);

  const processOne = useCallback(
    async (d: Draft) => {
      const key = d.key;
      try {
        patch(key, { status: "preparing", stage: "Preparing photo", progress: null, error: undefined });
        const { blob: original } = await normaliseOriginal(d.file, d.adjustments);
        const hash = await sha256(original);
        const dup = itemsRef.current.find((i) => i.imageHash === hash);
        patch(key, { original, originalUrl: URL.createObjectURL(original), hash, duplicateOf: dup?.id });

        // Avoid reprocessing the exact same photo: reuse an existing cutout when we have one.
        let cutoutBlob: Blob | null = recallCutout(hash);
        if (!cutoutBlob && dup?.imageCutout && repo) cutoutBlob = await repo.getImageBlob(dup.imageCutout);
        let coverage = 0.5;
        if (!cutoutBlob) {
          patch(key, { status: "removing", stage: "Removing background", progress: null });
          const png = await removeBackground(original, {
            provider: localStorageProvider(ai?.bgServer),
            model: profile.bgModel,
            authToken: await getToken(),
            onProgress: (stage, fraction) => patch(key, { stage, progress: fraction }),
          });
          const cut = await finaliseCutout(png);
          cutoutBlob = cut.blob;
          coverage = cut.coverage;
          rememberCutout(hash, cutoutBlob);
        }
        patch(key, { cutout: cutoutBlob, cutoutUrl: URL.createObjectURL(cutoutBlob), coverage, status: "analyzing", stage: "Reading colours and details", progress: null });

        const px = await samplePixels(cutoutBlob);
        let analysis = analyseLocally(px, d.file.name);
        let aiNote: string | undefined;
        if (profile.cloudAi && ai?.provider) {
          try {
            patch(key, { stage: "Asking the AI stylist to tag it" });
            const token = await getToken();
            const res = await fetch("/api/ai/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ image: await aiPreview(cutoutBlob), hint: d.file.name.replace(/\.[^.]+$/, "") }),
              signal: AbortSignal.timeout(70_000),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error ?? `AI service error (${res.status})`);
            if (body.isClothing === false) aiNote = "The AI isn't sure this photo shows clothing — please check the details.";
            analysis = mergeCloud(analysis, body);
          } catch (e) {
            aiNote = `Cloud AI unavailable (${(e as Error).message}). Showing on-device estimates instead.`;
          }
        }
        if (coverage < 0.03) aiNote = "Only a very small area was kept — the background removal may have missed the garment. Check the preview.";
        if (coverage > 0.97) aiNote = "The background may not have been removed fully. Try a photo on a plain contrasting background.";
        patch(key, { status: "ready", stage: "Ready", progress: 1, analysis, form: analysisToForm(analysis), aiNote });
      } catch (e) {
        const err = e instanceof PipelineError ? e : new PipelineError((e as Error).message || "Processing failed.", "bg-failed");
        patch(key, { status: "error", error: err.message, errorCode: err.code, stage: "Needs attention" });
      }
    },
    [patch, repo, profile.bgModel, profile.cloudAi, ai, getToken],
  );

  // Sequential worker: keeps memory use predictable on phones.
  useEffect(() => {
    if (running.current) return;
    const next = drafts.find((d) => d.status === "queued");
    if (!next) return;
    running.current = true;
    let started = false;
    const t = setTimeout(() => {
      started = true;
      processOne(next).finally(() => {
        running.current = false;
        setDrafts((ds) => [...ds]); // re-trigger the effect for the next queued draft
      });
    });
    return () => {
      // Only release the lock if the job never started; a running job releases it when it finishes.
      if (!started) {
        clearTimeout(t);
        running.current = false;
      }
    };
  }, [drafts, processOne]);

  const retry = useCallback((key: string, adjustments?: Adjustments) => {
    const d = draftsRef.current.find((x) => x.key === key);
    if (d?.hash && adjustments) cutoutCache.delete(d.hash);
    patch(key, { status: "queued", stage: "Waiting", error: undefined, ...(adjustments ? { adjustments } : {}) });
  }, [patch]);

  /** When background removal fails, the user can keep the original photo instead. */
  const useOriginal = useCallback(async (key: string) => {
    const d = draftsRef.current.find((x) => x.key === key);
    if (!d) return;
    try {
      const original = d.original ?? (await normaliseOriginal(d.file, d.adjustments)).blob;
      const px = await samplePixels(original);
      const analysis = analyseLocally(px, d.file.name);
      analysis.colorHex = [];
      analysis.confidence.colors = 0.2;
      patch(key, {
        original,
        originalUrl: d.originalUrl ?? URL.createObjectURL(original),
        cutout: null,
        status: "ready",
        stage: "Ready",
        analysis,
        form: { ...analysisToForm(analysis), colorHex: [] },
        aiNote: "Saved without background removal. Colours were estimated from the whole photo, so please check them.",
      });
    } catch (e) {
      patch(key, { error: (e as Error).message });
    }
  }, [patch]);

  const remove = useCallback((key: string) => {
    const gone = draftsRef.current.find((d) => d.key === key);
    if (gone) releaseUrls(gone);
    setDrafts((ds) => ds.filter((d) => d.key !== key));
  }, []);
  const updateForm = useCallback((key: string, form: ItemForm) => patch(key, { form }), [patch]);

  const save = useCallback(
    async (key: string): Promise<ClothingItem | null> => {
      const d = draftsRef.current.find((x) => x.key === key);
      if (!d || !d.form || !d.original || !repo || d.status !== "ready") return null;
      patch(key, { status: "saving" });
      try {
        const id = newId();
        const originalPath = await repo.putImage(`${id}/original.jpg`, d.original);
        const cutoutPath = d.cutout ? await repo.putImage(`${id}/cutout.${d.cutout.type === "image/webp" ? "webp" : "png"}`, d.cutout) : null;
        const ts = nowIso();
        const item: ClothingItem = {
          id,
          ...d.form,
          name: d.form.name.trim(),
          favorite: false,
          archived: false,
          imageOriginal: originalPath,
          imageCutout: cutoutPath,
          imageHash: d.hash,
          ai: {
            source: d.analysis?.source ?? "manual",
            confidence: d.analysis?.confidence ?? {},
            reviewed: true,
            notes: d.analysis?.notes,
          },
          wearCount: 0,
          createdAt: ts,
          updatedAt: ts,
        };
        await saveItem(item);
        patch(key, { status: "saved", savedId: id });
        return item;
      } catch (e) {
        patch(key, { status: "ready", aiNote: `Couldn't save: ${(e as Error).message}. Please try again.` });
        return null;
      }
    },
    [repo, saveItem, patch],
  );

  useEffect(
    () => () => {
      for (const d of draftsRef.current) releaseUrls(d);
      cutoutCache.clear();
    },
    [],
  );

  return { drafts, addFiles, retry, useOriginal, remove, updateForm, save };
}

/** The server provider (remove.bg) is chosen in Settings and remembered per device. */
function localStorageProvider(serverAvailable?: boolean): "local" | "server" {
  try {
    return serverAvailable && localStorage.getItem("vestry.bgProvider") === "server" ? "server" : "local";
  } catch {
    return "local";
  }
}

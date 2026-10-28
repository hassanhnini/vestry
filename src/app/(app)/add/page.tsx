"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Check, Crop, ImagePlus, Info, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useUploadQueue, type Draft } from "@/lib/image/use-upload-queue";
import { isModelWarm } from "@/lib/image/pipeline";
import { useWardrobe } from "@/lib/store";
import { useAiStatus } from "@/lib/ai/status";
import { ItemEditor, validateItemForm } from "@/components/closet/item-editor";
import { PhotoAdjuster } from "@/components/closet/photo-adjuster";
import { Badge, Button, Card, PageHeader, ProgressBar, cx } from "@/components/ui/primitives";
import { useOverlay } from "@/components/ui/overlay";

const SOURCE_LABEL: Record<string, string> = {
  claude: "Tagged by Claude",
  gemini: "Tagged by Gemini",
  "on-device": "On-device estimate",
  manual: "Manual",
};

export default function AddPage() {
  const q = useUploadQueue();
  const { profile } = useWardrobe();
  const { status: ai } = useAiStatus();
  const { toast } = useOverlay();
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [adjusting, setAdjusting] = useState<Draft | null>(null);

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const n = q.addFiles(files);
    if (n > 1) toast(`${n} photos added — processing one at a time.`, "info");
  };

  const ready = q.drafts.filter((d) => d.status === "ready");
  const saved = q.drafts.filter((d) => d.status === "saved");
  const busy = q.drafts.some((d) => ["queued", "preparing", "removing", "analyzing", "saving"].includes(d.status));

  const saveAll = async () => {
    let ok = 0;
    for (const d of ready) {
      const err = d.form && validateItemForm(d.form);
      if (err) {
        toast(`${d.form?.name || "An item"}: ${err}`, "error");
        continue;
      }
      if (await q.save(d.key)) ok++;
    }
    if (ok) toast(`${ok} piece${ok > 1 ? "s" : ""} added to your closet.`);
  };

  const saveOne = async (d: Draft) => {
    const err = d.form && validateItemForm(d.form);
    if (err) return toast(err, "error");
    const item = await q.save(d.key);
    if (item) toast(`${item.name} added to your closet.`, "success", { label: "View", onClick: () => router.push(`/closet/${item.id}`) });
  };

  const pickers = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" multiple className="sr-only" tabIndex={-1} aria-hidden data-testid="gallery-input" onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
    </>
  );

  return (
    <div className="mx-auto max-w-3xl">
      {pickers}
      <PageHeader eyebrow="Digitise your wardrobe" title="Add clothes" subtitle="One item per photo. We'll cut it out and suggest the details." />

      {q.drafts.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
          className={cx("animate-fade-up rounded-[1.75rem] border-2 border-dashed p-6 transition sm:p-10", dragging ? "border-clay bg-clay-soft/40" : "border-line bg-paper/70")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => cameraRef.current?.click()} className="group flex flex-col items-center gap-3 rounded-2xl bg-ink px-6 py-8 text-paper transition active:scale-[0.99]">
              <Camera className="size-8" aria-hidden />
              <span className="text-lg font-medium">Take a photo</span>
              <span className="text-[0.8125rem] text-paper/70">Uses your camera on phones</span>
            </button>
            <button onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-3 rounded-2xl bg-paper px-6 py-8 ring-1 ring-line transition hover:ring-taupe-soft active:scale-[0.99]">
              <ImagePlus className="size-8 text-ink" aria-hidden />
              <span className="text-lg font-medium">Choose from gallery</span>
              <span className="text-[0.8125rem] text-ink-soft">Select several at once</span>
            </button>
          </div>
          <p className="mt-5 hidden text-center text-sm text-ink-soft sm:block">
            <Upload className="mr-1 inline size-4" aria-hidden /> Or drag and drop photos here
          </p>
          <ul className="mx-auto mt-6 grid max-w-xl gap-2 text-[0.8125rem] text-ink-soft sm:grid-cols-3">
            <li className="rounded-xl bg-ivory px-3 py-2.5">Lay flat or hang it up</li>
            <li className="rounded-xl bg-ivory px-3 py-2.5">Plain, contrasting background</li>
            <li className="rounded-xl bg-ivory px-3 py-2.5">Soft daylight, whole item in frame</li>
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line/70 bg-ivory/92 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
            <p className="text-sm text-ink-soft" aria-live="polite">
              {busy ? "Processing…" : `${ready.length} ready`} · {saved.length} saved · {q.drafts.length} total
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" icon={<ImagePlus className="size-4" />} onClick={() => galleryRef.current?.click()}>
                Add more
              </Button>
              {ready.length > 1 && (
                <Button size="sm" onClick={saveAll}>
                  Save all ({ready.length})
                </Button>
              )}
              {!ready.length && saved.length > 0 && !busy && (
                <Button size="sm" onClick={() => router.push("/closet")}>
                  Done
                </Button>
              )}
            </div>
          </div>
          {q.drafts.map((d) => (
            <DraftCard key={d.key} d={d} q={q} onSave={() => saveOne(d)} onAdjust={() => setAdjusting(d)} />
          ))}
        </div>
      )}

      <div className="mt-8 space-y-2 text-[0.8125rem] leading-relaxed text-ink-soft">
        <p className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sage" aria-hidden />
          Background removal runs privately on this device{!isModelWarm() && " — the first photo downloads a one-time model (about 45–90 MB), later ones are fast"}.
        </p>
        <p className="flex gap-2">
          <Info className="mt-0.5 size-4 shrink-0 text-taupe" aria-hidden />
          {profile.cloudAi && ai?.provider
            ? `Tagging uses ${ai.provider === "claude" ? "Claude" : "Gemini"}: a small preview of the cut-out is sent for analysis. You can turn this off in Settings.`
            : ai?.provider
              ? <>Colours are measured on-device and the category is estimated. For smarter tagging, enable cloud AI in <Link className="underline" href="/settings">Settings</Link>.</>
              : "Colours are measured on-device and the category is estimated from the shape — you can correct everything. No cloud AI is configured on this server."}
        </p>
      </div>

      {adjusting && (
        <PhotoAdjuster
          open
          src={adjusting.sourceUrl}
          onClose={() => setAdjusting(null)}
          onApply={(a) => {
            q.retry(adjusting.key, a);
            setAdjusting(null);
          }}
        />
      )}
    </div>
  );
}

function DraftCard({ d, q, onSave, onAdjust }: { d: Draft; q: ReturnType<typeof useUploadQueue>; onSave: () => void; onAdjust: () => void }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const processing = ["queued", "preparing", "removing", "analyzing"].includes(d.status);
  const preview = showOriginal ? d.originalUrl ?? d.sourceUrl : d.cutoutUrl ?? d.originalUrl ?? d.sourceUrl;

  return (
    <Card className="animate-fade-up overflow-hidden" data-testid="draft-card" data-status={d.status}>
      <div className={cx("grid gap-0", d.status === "ready" && "md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        <div className={cx("relative", d.status === "ready" ? "p-4 md:p-5" : "flex items-center gap-4 p-4")}>
          <div className={cx("garment-stage relative overflow-hidden rounded-2xl", d.status === "ready" ? "aspect-[4/5] w-full p-[8%]" : "size-24 shrink-0 p-2")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={d.form?.name ?? d.file.name} className={cx("size-full object-contain", d.cutoutUrl && !showOriginal && "cutout-shadow", processing && "opacity-60")} />
            {processing && <div className="skeleton absolute inset-0 opacity-40" aria-hidden />}
          </div>
          {d.status !== "ready" && (
            <div className="min-w-0 flex-1 space-y-2">
              <p className="truncate text-sm font-medium">{d.status === "saved" ? d.form?.name : d.file.name}</p>
              {processing && (
                <>
                  <p className="text-[0.8125rem] text-ink-soft" aria-live="polite">{d.stage}…</p>
                  <ProgressBar value={d.progress} label={d.stage} />
                </>
              )}
              {d.status === "saving" && <p className="text-[0.8125rem] text-ink-soft">Saving…</p>}
              {d.status === "saved" && (
                <p className="flex items-center gap-2 text-[0.8125rem] text-sage">
                  <Check className="size-4" aria-hidden /> Added to your closet ·{" "}
                  <Link className="font-medium text-ink underline underline-offset-2" href={`/closet/${d.savedId}`}>
                    View
                  </Link>
                </p>
              )}
              {d.status === "error" && (
                <div role="alert" className="space-y-2.5">
                  <p className="flex gap-2 text-[0.8125rem] text-danger">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {d.error}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {d.errorCode !== "type" && d.errorCode !== "size" && d.errorCode !== "decode" && (
                      <>
                        <Button size="sm" icon={<RefreshCw className="size-3.5" />} onClick={() => q.retry(d.key)}>
                          Retry
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => q.useOriginal(d.key)}>
                          Keep original photo
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => q.remove(d.key)}>
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {d.status === "ready" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {d.cutoutUrl && (
                <Button size="sm" variant="secondary" onClick={() => setShowOriginal((v) => !v)} aria-pressed={showOriginal}>
                  {showOriginal ? "Show cut-out" : "Compare original"}
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={<Crop className="size-3.5" />} onClick={onAdjust}>
                Crop / rotate
              </Button>
            </div>
          )}
        </div>

        {d.status === "ready" && d.form && d.analysis && (
          <div className="border-t border-line/70 p-4 md:border-l md:border-t-0 md:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={d.analysis.source === "on-device" ? "warn" : "accent"}>{SOURCE_LABEL[d.analysis.source]}</Badge>
              {d.duplicateOf && <Badge tone="warn">Looks like a photo you already added</Badge>}
            </div>
            {(d.aiNote || d.analysis.notes) && (
              <p className="mb-4 rounded-xl bg-ivory px-3 py-2.5 text-[0.8125rem] leading-relaxed text-ink-soft">{d.aiNote ?? d.analysis.notes}</p>
            )}
            <ItemEditor form={d.form} onChange={(f) => q.updateForm(d.key, f)} ai={{ source: d.analysis.source, confidence: d.analysis.confidence, reviewed: false }} compact />
            <div className="mt-6 flex gap-2">
              <Button className="flex-1" onClick={onSave}>
                Save to closet
              </Button>
              <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => q.remove(d.key)} aria-label="Discard">
                <span className="sr-only sm:not-sr-only">Discard</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, Camera, Check, Heart, Pencil, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useWardrobe } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { COLOR_BY_ID, OCCASIONS, PATTERNS, SEASONS, STYLE_BY_ID, categoryLabel } from "@/lib/taxonomy";
import { finaliseCutout, normaliseOriginal, removeBackground, sha256, validateFile, PipelineError } from "@/lib/image/pipeline";
import { localDate, formatDay } from "@/lib/dates";
import { ItemImage } from "@/components/closet/item-image";
import { ItemEditor, formFromItem, validateItemForm, type ItemForm } from "@/components/closet/item-editor";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { Badge, Button, ButtonLink, Card, EmptyState, IconButton, ProgressBar, cx } from "@/components/ui/primitives";
import { useOverlay } from "@/components/ui/overlay";

function versionedKey(id: string, ext: string) {
  return `${id}/cutout-${Date.now().toString(36)}.${ext}`;
}

const SOURCE: Record<string, string> = { claude: "Tagged with Claude", gemini: "Tagged with Gemini", "on-device": "Tagged on-device", manual: "Added manually" };

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { items, outfits, repo, profile, updateItem, deleteItem, logWear } = useWardrobe();
  const { getToken } = useAuth();
  const { toast, confirm } = useOverlay();
  const item = items.find((i) => i.id === id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ItemForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"cutout" | "original">("cutout");
  const [work, setWork] = useState<{ stage: string; progress: number | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!item) {
    return (
      <EmptyState
        title="This piece isn't in your closet"
        body="It may have been deleted."
        action={<ButtonLink href="/closet" variant="secondary">Back to closet</ButtonLink>}
      />
    );
  }
  const inOutfits = outfits.filter((o) => o.itemIds.includes(item.id));

  const startEdit = () => {
    setForm(formFromItem(item));
    setEditing(true);
  };
  const save = async () => {
    if (!form) return;
    const err = validateItemForm(form);
    if (err) return toast(err, "error");
    setSaving(true);
    try {
      await updateItem(item.id, { ...form, name: form.name.trim(), ai: { ...item.ai, reviewed: true } });
      setEditing(false);
      toast("Changes saved.");
    } catch (e) {
      toast(`Couldn't save: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  /** Re-run background removal from the stored original, or from a newly chosen photo. */
  const process = async (source: Blob | null) => {
    if (!repo) return;
    try {
      setWork({ stage: "Preparing photo", progress: null });
      let original: Blob;
      if (source) {
        original = (await normaliseOriginal(source)).blob;
      } else {
        const stored = await repo.getImageBlob(item.imageOriginal);
        if (!stored) throw new Error("The original photo is missing.");
        original = stored;
      }
      const png = await removeBackground(original, {
        provider: "local",
        model: profile.bgModel,
        authToken: await getToken(),
        onProgress: (stage, progress) => setWork({ stage, progress }),
      });
      const cut = await finaliseCutout(png);
      setWork({ stage: "Saving", progress: null });
      const patch: Parameters<typeof updateItem>[1] = {};
      if (source) {
        patch.imageOriginal = await repo.putImage(`${item.id}/original.jpg`, original);
        patch.imageHash = await sha256(original);
      }
      const ext = cut.blob.type === "image/webp" ? "webp" : "png";
      const path = versionedKey(item.id, ext);
      patch.imageCutout = await repo.putImage(path, cut.blob);
      const old = item.imageCutout;
      await updateItem(item.id, patch);
      if (old && old !== patch.imageCutout) repo.deleteImage(old).catch(() => {});
      setView("cutout");
      toast(source ? "Photo replaced." : "Background removed again.");
    } catch (e) {
      toast(e instanceof PipelineError ? e.message : `Couldn't process the photo: ${(e as Error).message}`, "error");
    } finally {
      setWork(null);
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${item.name}?`,
      body: inOutfits.length ? (
        <>
          It appears in {inOutfits.length} saved outfit{inOutfits.length > 1 ? "s" : ""}. It will be taken out of {inOutfits.length > 1 ? "them" : "it"}: a look left without a top and a bottom (or a dress) is deleted, and one that survives is renamed and re-described to match what remains. If you might wear it again, consider <strong>archiving</strong> instead.
        </>
      ) : (
        "The photo and its details will be permanently removed."
      ),
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      const { removedOutfits } = await deleteItem(item.id);
      toast(removedOutfits ? `Deleted. ${removedOutfits} outfit${removedOutfits > 1 ? "s were" : " was"} removed too.` : "Deleted.");
      router.replace("/closet");
    } catch (e) {
      toast(`Couldn't delete: ${(e as Error).message}`, "error");
    }
  };

  const facts: [string, React.ReactNode][] = [
    ["Category", categoryLabel(item.category)],
    [
      "Colours",
      <span key="c" className="flex flex-wrap items-center gap-2">
        {item.colors.map((c, i) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: item.colorHex[i] ?? COLOR_BY_ID[c]?.hex }} aria-hidden />
            {COLOR_BY_ID[c]?.label ?? c}
          </span>
        ))}
      </span>,
    ],
    ["Pattern", PATTERNS.find((p) => p.id === item.pattern)?.label],
    ["Material", item.material],
    ["Fit", item.fit && item.fit[0].toUpperCase() + item.fit.slice(1)],
    ["Seasons", item.seasons.map((s) => SEASONS.find((x) => x.id === s)?.label).join(", ")],
    ["Occasions", item.occasions.map((o) => OCCASIONS.find((x) => x.id === o)?.label).join(", ")],
    ["Style", item.styles.map((s) => STYLE_BY_ID[s]?.label).join(", ")],
    ["Formality", `${item.formality} / 5`],
    ["Brand", item.brand],
    ["Worn", item.wearCount ? `${item.wearCount} time${item.wearCount > 1 ? "s" : ""}${item.lastWornAt ? ` · last ${formatDay(item.lastWornAt)}` : ""}` : "Not logged yet"],
    ["Notes", item.notes],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            validateFile(f);
            process(f);
          } catch (err) {
            toast((err as Error).message, "error");
          }
        }}
      />
      <div className="mb-3 flex items-center justify-between">
        <Link href="/closet" className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Closet
        </Link>
        <IconButton
          label={item.favorite ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={item.favorite}
          onClick={() => updateItem(item.id, { favorite: !item.favorite })}
        >
          <Heart className={cx("size-5", item.favorite && "fill-clay text-clay")} />
        </IconButton>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="garment-stage relative aspect-[4/5] overflow-hidden rounded-[1.75rem] p-[10%]">
            {view === "original" ? (
              <ItemImage item={{ ...item, imageCutout: null }} className="size-full" priority />
            ) : (
              <ItemImage item={item} className="size-full" priority />
            )}
            {work && (
              <div className="absolute inset-x-5 bottom-5 space-y-2 rounded-2xl bg-paper/95 p-4 shadow-[var(--shadow-soft)]" role="status">
                <p className="text-sm">{work.stage}…</p>
                <ProgressBar value={work.progress} label={work.stage} />
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.imageCutout && (
              <Button size="sm" variant="secondary" onClick={() => setView(view === "cutout" ? "original" : "cutout")}>
                {view === "cutout" ? "View original photo" : "View cut-out"}
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={<Wand2 className="size-3.5" />} disabled={!!work} onClick={() => process(null)}>
              {item.imageCutout ? "Redo background removal" : "Remove background"}
            </Button>
            <Button size="sm" variant="secondary" icon={<Camera className="size-3.5" />} disabled={!!work} onClick={() => fileRef.current?.click()}>
              Replace photo
            </Button>
          </div>
        </div>

        <div>
          {editing && form ? (
            <Card className="p-5 sm:p-6">
              <h1 className="mb-5 font-display text-2xl">Edit details</h1>
              <ItemEditor form={form} onChange={setForm} ai={{ ...item.ai, reviewed: true }} />
              <div className="mt-6 flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
                <Button className="flex-1" loading={saving} onClick={save} icon={<Check className="size-4" />}>Save changes</Button>
              </div>
            </Card>
          ) : (
            <>
              <p className="eyebrow">{categoryLabel(item.category)}</p>
              <h1 className="mt-1.5 font-display text-[2.25rem] leading-tight">{item.name}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={item.ai.source === "on-device" ? "neutral" : item.ai.source === "manual" ? "neutral" : "accent"}>{SOURCE[item.ai.source]}</Badge>
                {item.archived && <Badge tone="warn">Archived</Badge>}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <ButtonLink href={`/stylist?anchor=${item.id}`} icon={<Sparkles className="size-4" />}>Style this piece</ButtonLink>
                <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={startEdit}>Edit</Button>
                <Button
                  variant="secondary"
                  icon={<RefreshCw className="size-4" />}
                  onClick={() => logWear([item.id], localDate(new Date())).then(() => toast("Logged as worn today."))}
                >
                  Wore it today
                </Button>
              </div>
              <dl className="mt-8 divide-y divide-line/80 border-y border-line/80">
                {facts
                  .filter(([, v]) => v !== undefined && v !== "" && v !== null)
                  .map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[7.5rem_1fr] gap-3 py-3 text-[0.9375rem]">
                      <dt className="text-ink-soft">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  icon={item.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  onClick={() =>
                    updateItem(item.id, { archived: !item.archived }).then(() =>
                      toast(item.archived ? "Restored to your closet." : "Archived. It won't appear in outfit suggestions."),
                    )
                  }
                >
                  {item.archived ? "Unarchive" : "Archive"}
                </Button>
                <Button variant="ghost" className="text-danger hover:bg-danger-soft" icon={<Trash2 className="size-4" />} onClick={onDelete}>
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl">Outfits with this piece</h2>
        {inOutfits.length ? (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {inOutfits.map((o) => (
              <li key={o.id}>
                <Link href={`/outfits/${o.id}`} className="group block">
                  <OutfitBoard items={o.itemIds.map((x) => items.find((i) => i.id === x)!).filter(Boolean)} className="transition group-hover:shadow-[var(--shadow-soft)]" />
                  <p className="mt-2 truncate text-sm font-medium">{o.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.9375rem] text-ink-soft">
            Not in any saved outfits yet.{" "}
            <Link href={`/stylist?anchor=${item.id}`} className="font-medium text-clay underline-offset-2 hover:underline">
              Create one around it
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}

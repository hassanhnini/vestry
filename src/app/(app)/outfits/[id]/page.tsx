"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Check, Download, Heart, Pencil, Shirt, Trash2 } from "lucide-react";
import { useWardrobe } from "@/lib/store";
import { CATEGORIES } from "@/lib/taxonomy";
import { localDate, formatDay } from "@/lib/dates";
import { explainOutfit, isWearable } from "@/lib/stylist/engine";
import type { ClothingItem } from "@/lib/types";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { ItemImage } from "@/components/closet/item-image";
import { ItemPicker } from "@/components/closet/item-picker";
import { renderCollage } from "@/components/outfit/collage";
import { Badge, Button, ButtonLink, EmptyState, Field, IconButton, Input, Textarea, cx } from "@/components/ui/primitives";
import { Sheet, useOverlay } from "@/components/ui/overlay";

const SOURCE = { rules: "On-device stylist", claude: "Styled with Claude", gemini: "Styled with Gemini", manual: "Your edit" } as const;

export default function OutfitDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { outfits, items, planner, repo, updateOutfit, deleteOutfit, logWear, planOutfit } = useWardrobe();
  const { toast, confirm } = useOverlay();
  const outfit = outfits.find((o) => o.id === id);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [date, setDate] = useState(localDate(new Date()));
  const [event, setEvent] = useState("");
  const [editPieces, setEditPieces] = useState(false);
  const [pieces, setPieces] = useState<string[]>([]);
  const [notes, setNotes] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  if (!outfit) return <EmptyState title="Outfit not found" body="It may have been deleted." action={<ButtonLink href="/outfits" variant="secondary">Saved outfits</ButtonLink>} />;
  const its = outfit.itemIds.map((x) => items.find((i) => i.id === x)).filter(Boolean) as ClothingItem[];
  const upcoming = planner.filter((p) => p.outfitId === outfit.id && p.date >= localDate(new Date())).sort((a, b) => a.date.localeCompare(b.date));

  const download = async () => {
    if (!repo) return;
    setExporting(true);
    try {
      const blob = await renderCollage(its, repo, outfit.name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${outfit.name.replace(/[^\w\- ]+/g, "").trim() || "outfit"}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      toast(`Couldn't create the collage: ${(e as Error).message}`, "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/outfits" className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Saved outfits
        </Link>
        <IconButton label={outfit.favorite ? "Unfavourite" : "Favourite"} aria-pressed={outfit.favorite} onClick={() => updateOutfit(outfit.id, { favorite: !outfit.favorite })}>
          <Heart className={cx("size-5", outfit.favorite && "fill-clay text-clay")} />
        </IconButton>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <OutfitBoard items={its} interactive className="shadow-[var(--shadow-soft)]" />
        <div>
          {renaming ? (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim()) return toast("Please enter a name.", "error");
                await updateOutfit(outfit.id, { name: name.trim().slice(0, 80) });
                setRenaming(false);
                toast("Renamed.");
              }}
            >
              <Input aria-label="Outfit name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus />
              <Button type="submit" icon={<Check className="size-4" />}>Save</Button>
            </form>
          ) : (
            <div className="flex items-start gap-2">
              <h1 className="font-display text-[2.25rem] leading-tight">{outfit.name}</h1>
              <IconButton label="Rename outfit" onClick={() => { setName(outfit.name); setRenaming(true); }} className="mt-1 shrink-0">
                <Pencil className="size-4" />
              </IconButton>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={outfit.source === "rules" ? "neutral" : "accent"}>{SOURCE[outfit.source]}</Badge>
            {outfit.occasion && <Badge>{outfit.occasion}</Badge>}
            {outfit.style && <Badge>{outfit.style}</Badge>}
            {outfit.wearCount > 0 && <Badge tone="success">Worn {outfit.wearCount}×{outfit.lastWornAt ? ` · last ${formatDay(outfit.lastWornAt)}` : ""}</Badge>}
          </div>
          <p className="mt-5 text-[1rem] leading-relaxed text-ink-soft">{outfit.explanation}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button icon={<CalendarPlus className="size-4" />} onClick={() => setPlanOpen(true)}>Add to planner</Button>
            <Button variant="secondary" icon={<Shirt className="size-4" />} onClick={() => logWear(outfit.itemIds, localDate(new Date()), outfit.id).then(() => toast("Logged as worn today."))}>
              Wore it today
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" />} loading={exporting} onClick={download}>Collage</Button>
          </div>
          {upcoming.length > 0 && (
            <p className="mt-4 text-sm text-ink-soft">
              Planned for {upcoming.map((p) => formatDay(p.date)).join(", ")} ·{" "}
              <Link href="/planner" className="font-medium text-ink underline underline-offset-2">Planner</Link>
            </p>
          )}

          <h2 className="mt-8 eyebrow">In this look</h2>
          <ul className="mt-3 space-y-1">
            {its.map((i) => (
              <li key={i.id}>
                <Link href={`/closet/${i.id}`} className="flex items-center gap-3 rounded-2xl p-1.5 hover:bg-shell/50">
                  <ItemImage item={i} className="garment-stage size-14 shrink-0 rounded-xl p-1.5" />
                  <span>
                    <span className="block text-[0.9375rem] font-medium">{i.name}</span>
                    <span className="text-[0.75rem] text-taupe">{CATEGORIES[i.category].label}</span>
                  </span>
                </Link>
              </li>
            ))}
            {its.length < outfit.itemIds.length && <li className="text-sm text-taupe">Some pieces were removed from your closet.</li>}
          </ul>

          <div className="mt-6">
            <Field label="Notes" htmlFor="outfit-notes">
              <Textarea
                id="outfit-notes"
                maxLength={1000}
                placeholder="Add a note — e.g. 'tuck the shirt, roll the sleeves'"
                value={notes ?? outfit.notes ?? ""}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => notes !== null && notes !== (outfit.notes ?? "") && updateOutfit(outfit.id, { notes: notes || undefined }).then(() => toast("Note saved."))}
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-line/70 pt-5">
            <Button variant="ghost" icon={<Pencil className="size-4" />} onClick={() => { setPieces(outfit.itemIds); setEditPieces(true); }}>Edit pieces</Button>
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger-soft"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                const ok = await confirm({ title: "Delete this outfit?", body: upcoming.length ? "It will also be removed from your planner." : "Your clothes stay in your closet.", confirmLabel: "Delete", destructive: true });
                if (!ok) return;
                await deleteOutfit(outfit.id);
                toast("Outfit deleted.");
                router.replace("/outfits");
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Add to planner" size="sm">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await planOutfit(date, outfit.id, event);
            setPlanOpen(false);
            setEvent("");
            toast(`Planned for ${formatDay(date)}.`, "success", { label: "Planner", onClick: () => router.push("/planner") });
          }}
        >
          <Field label="Date" htmlFor="plan-date">
            <Input id="plan-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Event or trip (optional)" htmlFor="plan-event">
            <Input id="plan-event" maxLength={120} placeholder="e.g. Lisbon trip, Sam's birthday" value={event} onChange={(e) => setEvent(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">Add to {formatDay(date)}</Button>
        </form>
      </Sheet>

      <ItemPicker
        open={editPieces}
        title="Pieces in this outfit"
        items={items.filter((i) => !i.archived || outfit.itemIds.includes(i.id))}
        selected={pieces}
        onChange={setPieces}
        max={8}
        onClose={async () => {
          setEditPieces(false);
          if (pieces.join() === outfit.itemIds.join()) return;
          const chosen = pieces.map((x) => items.find((i) => i.id === x)!).filter(Boolean);
          if (!isWearable(chosen)) return toast("An outfit needs a top and a bottom, or a dress. Changes not saved.", "error");
          await updateOutfit(outfit.id, { itemIds: pieces, source: "manual", explanation: explainOutfit(chosen) || outfit.explanation });
          toast("Outfit updated.");
        }}
      />
    </div>
  );
}

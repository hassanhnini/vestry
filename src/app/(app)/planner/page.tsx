"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, Sparkles, Trash2, Undo2 } from "lucide-react";
import { useWardrobe } from "@/lib/store";
import { addDays, formatDay, localDate, weekStart } from "@/lib/dates";
import type { Outfit, PlannerEntry } from "@/lib/types";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { Badge, Button, ButtonLink, Card, EmptyState, Field, IconButton, Input, PageHeader, cx } from "@/components/ui/primitives";
import { Sheet, useOverlay } from "@/components/ui/overlay";

export default function PlannerPage() {
  const { planner, outfits, items, wear, planOutfit, updatePlanner, removePlanner, logWear, removeWear } = useWardrobe();
  const { toast, confirm } = useOverlay();
  const [anchor, setAnchor] = useState(() => weekStart(new Date()));
  const [adding, setAdding] = useState<string | null>(null);
  const today = localDate(new Date());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => localDate(addDays(anchor, i))), [anchor]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const outfitById = useMemo(() => new Map(outfits.map((o) => [o.id, o])), [outfits]);
  const rangeLabel = `${formatDay(days[0], { day: "numeric", month: "short" })} – ${formatDay(days[6], { day: "numeric", month: "short", year: "numeric" })}`;

  const markWorn = async (e: PlannerEntry, o: Outfit) => {
    if (e.worn) {
      await updatePlanner(e.id, { worn: false });
      const log = wear.find((w) => w.outfitId === o.id && w.date === e.date);
      if (log) await removeWear(log.id);
      return;
    }
    await updatePlanner(e.id, { worn: true });
    await logWear(o.itemIds, e.date, o.id);
    toast("Marked as worn.");
  };

  if (!outfits.length) {
    return (
      <>
        <PageHeader eyebrow="Planner" title="Your week" />
        <EmptyState
          icon={<CalendarDays className="size-7" />}
          title="Plan your week in outfits"
          body="Save a few outfits first, then map them to days, trips and events."
          action={<ButtonLink href="/stylist" icon={<Sparkles className="size-4" />}>Create an outfit</ButtonLink>}
        />
      </>
    );
  }

  const upcomingEvents = planner.filter((p) => p.event && p.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const eventGroups = [...new Set(upcomingEvents.map((p) => p.event!))].slice(0, 4);

  return (
    <div>
      <PageHeader eyebrow="Planner" title="Your week" subtitle="Assign saved outfits to days, trips and events." />
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton label="Previous week" onClick={() => setAnchor(addDays(anchor, -7))}>
            <ChevronLeft className="size-5" />
          </IconButton>
          <IconButton label="Next week" onClick={() => setAnchor(addDays(anchor, 7))}>
            <ChevronRight className="size-5" />
          </IconButton>
          <p className="ml-1 text-sm font-medium" aria-live="polite">{rangeLabel}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAnchor(weekStart(new Date()))}>
          This week
        </Button>
      </div>

      {eventGroups.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {eventGroups.map((ev) => {
            const entries = upcomingEvents.filter((p) => p.event === ev);
            return (
              <Badge key={ev} tone="accent">
                {ev} · {entries.length} look{entries.length > 1 ? "s" : ""} from {formatDay(entries[0].date, { day: "numeric", month: "short" })}
              </Badge>
            );
          })}
        </div>
      )}

      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {days.map((d) => {
          const entries = planner.filter((p) => p.date === d);
          const isToday = d === today;
          return (
            <li key={d}>
              <Card className={cx("flex h-full flex-col p-3", isToday && "ring-2 ring-clay/60")}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-sm">
                    <span className="font-semibold">{formatDay(d, { weekday: "short" })}</span>{" "}
                    <span className="text-ink-soft">{formatDay(d, { day: "numeric", month: "short" })}</span>
                  </p>
                  {isToday && <Badge tone="accent">Today</Badge>}
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  {entries.map((e) => {
                    const o = outfitById.get(e.outfitId);
                    if (!o) return null;
                    return (
                      <div key={e.id} className="flex gap-3 rounded-2xl bg-ivory/70 p-2 xl:block">
                        <Link href={`/outfits/${o.id}`} className="block w-24 shrink-0 sm:w-28 xl:w-auto">
                          <OutfitBoard items={o.itemIds.map((id) => byId.get(id)!).filter(Boolean)} className="!rounded-xl" />
                        </Link>
                        <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/outfits/${o.id}`} className="block">
                          <p className="mt-1 truncate px-1 text-[0.875rem] font-medium xl:mt-2">{o.name}</p>
                        </Link>
                        {e.event && <p className="truncate px-1 text-[0.75rem] text-clay">{e.event}</p>}
                        <div className="mt-auto flex items-center justify-between pt-1.5">
                          {d <= today ? (
                            <Button size="sm" variant={e.worn ? "secondary" : "ghost"} onClick={() => markWorn(e, o)} icon={e.worn ? <Undo2 className="size-3.5" /> : <Check className="size-3.5" />}>
                              {e.worn ? "Worn" : "Mark worn"}
                            </Button>
                          ) : (
                            <span />
                          )}
                          <IconButton
                            label={`Remove ${o.name} from ${formatDay(d)}`}
                            className="size-9"
                            onClick={async () => {
                              if (await confirm({ title: "Remove from planner?", body: "The outfit stays saved.", confirmLabel: "Remove" })) {
                                await removePlanner(e.id);
                                toast("Removed from planner.");
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        </div>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setAdding(d)}
                    className="flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line text-sm text-ink-soft transition hover:border-taupe-soft hover:text-ink"
                    aria-label={`Plan an outfit for ${formatDay(d)}`}
                  >
                    <Plus className="size-4" aria-hidden /> {entries.length ? "Add another" : "Plan"}
                  </button>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <section className="mt-12">
        <h2 className="font-display text-2xl">Recently worn</h2>
        {wear.length === 0 ? (
          <p className="mt-2 text-[0.9375rem] text-ink-soft">Tap “Mark worn” on a planned day or “Wore it today” on any outfit or piece to keep a wear history. It’s optional and helps the stylist surface forgotten pieces.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/80">
            {wear.slice(0, 12).map((w) => {
              const o = w.outfitId ? outfitById.get(w.outfitId) : undefined;
              const names = w.itemIds.map((id) => byId.get(id)?.name).filter(Boolean);
              return (
                <li key={w.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[0.9375rem] font-medium">{o?.name ?? names.join(", ") ?? "Outfit"}</p>
                    <p className="text-[0.8125rem] text-taupe">{formatDay(w.date, { weekday: "long", day: "numeric", month: "long" })}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeWear(w.id).then(() => toast("Wear record removed."))}>
                    Undo
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddSheet
        date={adding}
        outfits={outfits}
        byId={byId}
        onClose={() => setAdding(null)}
        onPick={async (outfitId, event, until) => {
          if (!adding) return;
          let n = 0;
          for (let d = adding; d <= (until || adding); d = localDate(addDays(new Date(d + "T12:00:00"), 1))) {
            await planOutfit(d, outfitId, event);
            if (++n > 31) break;
          }
          toast(n > 1 ? `Planned for ${n} days.` : `Planned for ${formatDay(adding)}.`);
          setAdding(null);
        }}
      />
    </div>
  );
}

function AddSheet({
  date,
  outfits,
  byId,
  onClose,
  onPick,
}: {
  date: string | null;
  outfits: Outfit[];
  byId: Map<string, import("@/lib/types").ClothingItem>;
  onClose: () => void;
  onPick: (outfitId: string, event: string, until: string) => void;
}) {
  const [event, setEvent] = useState("");
  const [until, setUntil] = useState("");
  return (
    <Sheet open={!!date} onClose={onClose} title={date ? `Plan ${formatDay(date)}` : "Plan"} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event or trip (optional)" htmlFor="ev">
          <Input id="ev" maxLength={120} placeholder="e.g. Weekend in Paris" value={event} onChange={(e) => setEvent(e.target.value)} />
        </Field>
        <Field label="Repeat until (optional)" htmlFor="until" hint="Wear the same look across a short trip.">
          <Input id="until" type="date" min={date ?? undefined} value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      </div>
      <p className="mb-3 mt-6 text-sm font-medium">Choose an outfit</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {outfits.map((o) => (
          <li key={o.id}>
            <button onClick={() => onPick(o.id, event, until)} className="group block w-full text-left">
              <OutfitBoard items={o.itemIds.map((id) => byId.get(id)!).filter(Boolean)} className="transition group-hover:shadow-[var(--shadow-soft)]" />
              <p className="mt-1.5 truncate text-[0.8125rem] font-medium">{o.name}</p>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

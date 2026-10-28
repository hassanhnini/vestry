"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, CalendarDays, Camera, Plus, Shirt, Shuffle, Sparkles } from "lucide-react";
import { useWardrobe } from "@/lib/store";
import { generateOutfits, roleOf, seasonFor } from "@/lib/stylist/engine";
import { localDate } from "@/lib/dates";
import { computeInsights } from "@/lib/insights";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { ItemCard } from "@/components/closet/item-card";
import { ItemImage } from "@/components/closet/item-image";
import { Badge, Button, ButtonLink, Card } from "@/components/ui/primitives";
import { useOverlay } from "@/components/ui/overlay";

function greeting(d: Date) {
  const h = d.getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const router = useRouter();
  const { items, outfits, planner, wear, profile, hasProfile, saveOutfit, planOutfit } = useWardrobe();
  const { toast } = useOverlay();
  const [shuffle, setShuffle] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);
  const today = localDate(now);

  useEffect(() => {
    if (!hasProfile && !profile.onboarded) router.replace("/onboarding");
  }, [hasProfile, profile.onboarded, router]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const planned = planner.find((p) => p.date === today);
  const plannedOutfit = planned ? outfits.find((o) => o.id === planned.outfitId) : undefined;
  const daySeed = Number(today.replace(/-/g, "")) + shuffle * 101;
  const suggestion = useMemo(() => {
    if (plannedOutfit) return null;
    const r = generateOutfits(items, { count: 1, seed: daySeed, season: seasonFor(now, profile) }, { profile });
    return r.outfits[0] ?? null;
  }, [items, plannedOutfit, daySeed, now, profile]);
  const insights = useMemo(() => computeInsights(items, outfits, wear, now), [items, outfits, wear, now]);
  const forgotten = insights.dormant[0] ?? insights.neverStyled.find((i) => roleOf(i) !== "accessory");
  const recent = items.filter((i) => !i.archived).slice(0, 8);
  const name = profile.displayName?.trim();

  const ootdItems = plannedOutfit ? plannedOutfit.itemIds.map((id) => byId.get(id)!).filter(Boolean) : suggestion ? suggestion.itemIds.map((id) => byId.get(id)!).filter(Boolean) : [];

  return (
    <div className="space-y-12">
      <header className="animate-fade-up pt-2">
        <p className="eyebrow">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="mt-2 font-display text-[2.4rem] leading-[1.05] sm:text-[3rem]">
          {greeting(now)}
          {name ? `, ${name}` : ""}.
        </h1>
      </header>

      {items.length === 0 ? (
        <Card className="animate-fade-up overflow-hidden">
          <div className="grid gap-0 md:grid-cols-2">
            <div className="p-7 sm:p-10">
              <p className="eyebrow text-clay">Step 1 of 3</p>
              <h2 className="mt-2 font-display text-[1.9rem] leading-tight">Let&apos;s build your closet</h2>
              <ol className="mt-5 space-y-3 text-[0.9375rem] text-ink-soft">
                <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs text-paper">1</span>Photograph a few favourite pieces — tops, bottoms, shoes.</li>
                <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-shell text-xs">2</span>We cut them out and suggest the details; you confirm.</li>
                <li className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-shell text-xs">3</span>Ask the stylist for outfits made from what you own.</li>
              </ol>
              <ButtonLink href="/add" size="lg" className="mt-7" icon={<Camera className="size-4" />}>
                Add your first pieces
              </ButtonLink>
            </div>
            <div className="garment-stage hidden items-center justify-center p-10 md:flex">
              <Shirt className="size-28 text-taupe-soft" strokeWidth={0.8} aria-hidden />
            </div>
          </div>
        </Card>
      ) : (
        <section aria-labelledby="ootd" className="animate-fade-up">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="ootd" className="font-display text-[1.75rem]">{plannedOutfit ? "Today's plan" : "Outfit of the day"}</h2>
            {plannedOutfit && <Badge tone="accent">Planned{planned?.event ? ` · ${planned.event}` : ""}</Badge>}
          </div>
          {ootdItems.length ? (
            <Card className="grid overflow-hidden md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <div className="p-3">
                <OutfitBoard items={ootdItems} interactive />
              </div>
              <div className="flex flex-col p-6 md:p-8">
                <h3 className="font-display text-2xl leading-tight">{plannedOutfit?.name ?? suggestion?.name}</h3>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{plannedOutfit?.explanation ?? suggestion?.explanation}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {ootdItems.map((i) => (
                    <li key={i.id}>
                      <Link href={`/closet/${i.id}`} className="flex items-center gap-2 rounded-full bg-ivory py-1 pl-1 pr-3 text-[0.8125rem] hover:bg-shell">
                        <ItemImage item={i} className="size-7 rounded-full bg-paper p-0.5" />
                        {i.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  {plannedOutfit ? (
                    <ButtonLink href={`/outfits/${plannedOutfit.id}`} variant="secondary">Open outfit</ButtonLink>
                  ) : (
                    suggestion && (
                      <>
                        <Button
                          icon={<Bookmark className="size-4" />}
                          disabled={!!savedId}
                          onClick={async () => {
                            const o = await saveOutfit({ name: suggestion.name, itemIds: suggestion.itemIds, explanation: suggestion.explanation, source: "rules" });
                            setSavedId(o.id);
                            await planOutfit(today, o.id);
                            toast("Saved and planned for today.");
                          }}
                        >
                          {savedId ? "Planned for today" : "Wear this today"}
                        </Button>
                        <Button variant="secondary" icon={<Shuffle className="size-4" />} onClick={() => { setShuffle((s) => s + 1); setSavedId(null); }}>
                          Shuffle
                        </Button>
                      </>
                    )
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-7">
              <p className="text-ink-soft">
                Add {items.some((i) => roleOf(i) === "top") ? "a bottom" : "a top"} (or a dress) so we can put together your first outfit.
              </p>
              <ButtonLink href="/add" className="mt-4" icon={<Plus className="size-4" />}>Add clothes</ButtonLink>
            </Card>
          )}
        </section>
      )}

      <section aria-label="Quick actions" className="grid grid-cols-3 gap-3">
        {[
          { href: "/add", label: "Add clothes", icon: Camera },
          { href: "/stylist", label: "Create outfit", icon: Sparkles },
          { href: "/planner", label: "Plan week", icon: CalendarDays },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-[1.25rem] bg-paper px-2 py-5 text-center text-[0.8125rem] font-medium ring-1 ring-line/70 transition hover:shadow-[var(--shadow-soft)] active:scale-[0.98] sm:flex-row sm:justify-center sm:text-sm">
            <Icon className="size-5 text-clay" aria-hidden /> {label}
          </Link>
        ))}
      </section>

      {forgotten && items.length >= 4 && (
        <section className="animate-fade-up">
          <Card className="flex items-center gap-5 p-4 sm:p-5">
            <ItemImage item={forgotten} className="garment-stage size-20 shrink-0 rounded-2xl p-2" />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Rediscover</p>
              <p className="mt-1 text-[0.9375rem]">
                Your <strong className="font-semibold">{forgotten.name.toLowerCase()}</strong> {insights.dormant.includes(forgotten) ? "hasn't been worn in a while" : "isn't in any outfits yet"}.
              </p>
            </div>
            <ButtonLink href={`/stylist?anchor=${forgotten.id}`} size="sm" variant="secondary" icon={<ArrowRight className="size-4" />}>
              Style it
            </ButtonLink>
          </Card>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-[1.75rem]">Recently added</h2>
            <Link href="/closet" className="text-sm font-medium text-ink-soft hover:text-ink">View closet</Link>
          </div>
          <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {recent.slice(0, 6).map((i) => (
              <li key={i.id} className="w-36 shrink-0 sm:w-auto">
                <ItemCard item={i} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {outfits.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-[1.75rem]">Saved looks</h2>
            <Link href="/outfits" className="text-sm font-medium text-ink-soft hover:text-ink">All outfits</Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {outfits.slice(0, 4).map((o) => (
              <li key={o.id}>
                <Link href={`/outfits/${o.id}`} className="group block">
                  <OutfitBoard items={o.itemIds.map((id) => byId.get(id)!).filter(Boolean)} className="transition group-hover:shadow-[var(--shadow-soft)]" />
                  <p className="mt-2 truncate text-sm font-medium">{o.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

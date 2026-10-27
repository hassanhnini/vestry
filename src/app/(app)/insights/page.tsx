"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lightbulb, ShoppingBag } from "lucide-react";
import { useWardrobe } from "@/lib/store";
import { computeInsights } from "@/lib/insights";
import { ItemCard } from "@/components/closet/item-card";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui/primitives";

export default function InsightsPage() {
  const { items, outfits, wear } = useWardrobe();
  const ins = useMemo(() => computeInsights(items, outfits, wear), [items, outfits, wear]);
  const [showGaps, setShowGaps] = useState(false);
  const max = Math.max(1, ...ins.byGroup.map((g) => g.count));
  const maxC = Math.max(1, ...ins.topColors.map((c) => c.count));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/profile" className="-ml-2 mb-2 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Profile
      </Link>
      <PageHeader eyebrow="Insights" title="Your wardrobe at a glance" />
      {ins.total === 0 ? (
        <EmptyState title="Nothing to analyse yet" body="Add a few pieces and insights will appear here." action={<ButtonLink href="/add">Add clothes</ButtonLink>} />
      ) : (
        <div className="space-y-10">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-6">
              <h2 className="eyebrow">By category · {ins.total} pieces</h2>
              <ul className="mt-4 space-y-3">
                {ins.byGroup.map((g) => (
                  <li key={g.id} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
                    <span>{g.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-shell">
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${(g.count / max) * 100}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-ink-soft">{g.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-6">
              <h2 className="eyebrow">Most common colours</h2>
              <ul className="mt-4 space-y-3">
                {ins.topColors.map((c) => (
                  <li key={c.id} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} aria-hidden />
                      {c.label}
                    </span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-shell">
                      <span className="block h-full rounded-full" style={{ width: `${(c.count / maxC) * 100}%`, background: c.hex }} />
                    </span>
                    <span className="text-right tabular-nums text-ink-soft">{c.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {ins.versatile.length > 0 && (
            <section>
              <h2 className="font-display text-2xl">Your most versatile pieces</h2>
              <p className="mt-1 text-sm text-ink-soft">Appearing in the most saved outfits.</p>
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {ins.versatile.map(({ item, outfits: n }) => (
                  <li key={item.id}>
                    <ItemCard item={item} />
                    <p className="mt-0.5 px-0.5 text-[0.75rem] text-clay">{n} outfit{n > 1 ? "s" : ""}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="font-display text-2xl">{ins.tracksWear ? "Waiting to be worn" : "Not styled yet"}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {ins.tracksWear ? "Not worn in the last 60 days — tap one to build a fresh outfit around it." : "These pieces aren't in any saved outfit. Tap one to style it. (Log what you wear in the planner to see dormant pieces.)"}
            </p>
            {(ins.tracksWear ? ins.dormant : ins.neverStyled).length ? (
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {(ins.tracksWear ? ins.dormant : ins.neverStyled).slice(0, 12).map((i) => (
                  <li key={i.id}>
                    <ItemCard item={i} href={`/stylist?anchor=${i.id}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-sage">Everything is getting worn. Lovely.</p>
            )}
          </section>

          <section>
            <h2 className="flex items-center gap-2 font-display text-2xl">
              <Lightbulb className="size-5 text-clay" aria-hidden /> New combinations
            </h2>
            <p className="mt-1 text-sm text-ink-soft">Ask the stylist to mix pieces you rarely pair together.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink href="/stylist?rare=1" variant="secondary">Outfits with rarely worn pieces</ButtonLink>
              {ins.neverStyled[0] && <ButtonLink href={`/stylist?anchor=${ins.neverStyled[0].id}`} variant="secondary">Style my {ins.neverStyled[0].name.toLowerCase()}</ButtonLink>}
            </div>
          </section>

          <section>
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-xl">
                    <ShoppingBag className="size-5 text-taupe" aria-hidden /> Wardrobe gap ideas
                  </h2>
                  <p className="mt-1 text-sm text-ink-soft">Optional observations — never a reason to shop. Off by default.</p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={showGaps} onChange={(e) => setShowGaps(e.target.checked)} className="size-4 accent-[#97492f]" />
                  Show
                </label>
              </div>
              {showGaps && (
                <ul className="mt-4 space-y-3">
                  {ins.gaps.length ? (
                    ins.gaps.map((g) => (
                      <li key={g.id} className="rounded-2xl bg-ivory px-4 py-3">
                        <p className="text-[0.9375rem] font-medium">{g.title}</p>
                        <p className="text-sm text-ink-soft">{g.body}</p>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-sage">Your closet is nicely balanced.</li>
                  )}
                  <li className="text-[0.75rem] text-taupe">Check what you already own before buying anything — you may simply not have photographed it yet.</li>
                </ul>
              )}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}

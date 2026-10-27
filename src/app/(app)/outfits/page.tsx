"use client";
import { useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, Sparkles } from "lucide-react";
import { useWardrobe } from "@/lib/store";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { ButtonLink, EmptyState, PageHeader, cx } from "@/components/ui/primitives";

export default function OutfitsPage() {
  const { outfits, items, updateOutfit } = useWardrobe();
  const [tab, setTab] = useState<"all" | "fav" | "worn">("all");
  const byId = new Map(items.map((i) => [i.id, i]));
  const list = outfits.filter((o) => (tab === "fav" ? o.favorite : tab === "worn" ? o.wearCount > 0 : true));

  return (
    <div>
      <PageHeader
        eyebrow="Lookbook"
        title="Saved outfits"
        subtitle={`${outfits.length} look${outfits.length === 1 ? "" : "s"}`}
        actions={<ButtonLink href="/stylist" size="sm" icon={<Sparkles className="size-4" />}>New outfit</ButtonLink>}
      />
      {outfits.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="size-7" />}
          title="No saved outfits yet"
          body="Ask the stylist for ideas and save the looks you love — they'll live here and in your planner."
          action={<ButtonLink href="/stylist" icon={<Sparkles className="size-4" />}>Create an outfit</ButtonLink>}
        />
      ) : (
        <>
          <div className="mb-5 flex gap-2" role="tablist">
            {([["all", "All"], ["fav", "Favourites"], ["worn", "Worn"]] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cx("h-10 rounded-full px-4 text-sm", tab === id ? "bg-ink text-paper" : "text-ink-soft hover:bg-shell")}>
                {label}
              </button>
            ))}
          </div>
          {list.length === 0 && <p className="py-10 text-center text-ink-soft">Nothing here yet.</p>}
          <ul className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-3 xl:grid-cols-4">
            {list.map((o) => (
              <li key={o.id} className="group relative animate-fade-up">
                <Link href={`/outfits/${o.id}`} className="block">
                  <OutfitBoard items={o.itemIds.map((id) => byId.get(id)!).filter(Boolean)} className="transition group-hover:shadow-[var(--shadow-soft)]" />
                  <p className="mt-2.5 truncate font-display text-[1.05rem]">{o.name}</p>
                  <p className="text-[0.75rem] text-taupe">
                    {o.itemIds.length} pieces{o.occasion ? ` · ${o.occasion}` : ""}{o.wearCount ? ` · worn ${o.wearCount}×` : ""}
                  </p>
                </Link>
                <button
                  onClick={() => updateOutfit(o.id, { favorite: !o.favorite })}
                  aria-label={o.favorite ? `Unfavourite ${o.name}` : `Favourite ${o.name}`}
                  aria-pressed={o.favorite}
                  className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-full bg-paper/70 backdrop-blur transition hover:bg-paper"
                >
                  <Heart className={cx("size-4", o.favorite && "fill-clay text-clay")} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

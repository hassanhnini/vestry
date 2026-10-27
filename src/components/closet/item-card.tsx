"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import type { ClothingItem } from "@/lib/types";
import { categoryLabel } from "@/lib/taxonomy";
import { ItemImage } from "./item-image";
import { cx } from "../ui/primitives";

export function ItemCard({ item, onToggleFavorite, href, selected, onSelect }: {
  item: ClothingItem;
  onToggleFavorite?: () => void;
  href?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <div className="garment-stage relative aspect-[4/5] overflow-hidden rounded-[1.1rem] p-[12%] transition duration-300 group-hover:shadow-[var(--shadow-soft)]">
        <ItemImage item={item} className="size-full transition duration-500 group-hover:scale-[1.03]" />
        {item.archived && <span className="absolute left-2.5 top-2.5 rounded-full bg-paper/90 px-2 py-0.5 text-[0.6875rem] font-medium text-ink-soft">Archived</span>}
        {!item.ai.reviewed && !item.archived && <span className="absolute left-2.5 top-2.5 rounded-full bg-clay-soft px-2 py-0.5 text-[0.6875rem] font-medium text-clay">Check details</span>}
        {selected && <span className="absolute inset-0 rounded-[1.1rem] ring-2 ring-ink ring-inset" aria-hidden />}
      </div>
      <div className="mt-2 px-0.5">
        <p className="truncate text-[0.875rem] font-medium leading-tight">{item.name}</p>
        <p className="mt-0.5 truncate text-[0.75rem] text-taupe">{categoryLabel(item.category)}</p>
      </div>
    </>
  );
  return (
    <div className="group relative">
      {onSelect ? (
        <button type="button" onClick={onSelect} aria-pressed={selected} className="block w-full text-left">
          {body}
        </button>
      ) : (
        <Link href={href ?? `/closet/${item.id}`} className="block">
          {body}
        </Link>
      )}
      {onToggleFavorite && (
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={item.favorite ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
          aria-pressed={item.favorite}
          className="absolute right-1.5 top-1.5 flex size-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-paper/80"
        >
          <Heart className={cx("size-[1.1rem]", item.favorite && "fill-clay text-clay")} aria-hidden />
        </button>
      )}
    </div>
  );
}

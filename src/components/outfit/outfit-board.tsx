"use client";
import Link from "next/link";
import type { ClothingItem } from "@/lib/types";
import { ItemImage } from "../closet/item-image";
import { composeBoard } from "./layout";
import { cx } from "../ui/primitives";

/** Editorial composition of the user's real garment cutouts. */
export function OutfitBoard({ items, interactive = false, className, label }: { items: ClothingItem[]; interactive?: boolean; className?: string; label?: string }) {
  const slots = composeBoard(items);
  return (
    <div
      className={cx("garment-stage relative aspect-[4/5] w-full overflow-hidden rounded-[1.4rem]", className)}
      role="img"
      aria-label={label ?? `Outfit: ${items.map((i) => i.name).join(", ")}`}
    >
      {slots.map(({ item, x, y, w, h, z }) => {
        const style = { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, zIndex: z };
        const img = <ItemImage item={item} className="size-full" />;
        return interactive ? (
          <Link key={item.id} href={`/closet/${item.id}`} style={style} className="absolute transition duration-300 hover:scale-[1.03] focus-visible:scale-[1.03]" aria-label={`Open ${item.name}`}>
            {img}
          </Link>
        ) : (
          <div key={item.id} style={style} className="absolute" aria-hidden>
            {img}
          </div>
        );
      })}
    </div>
  );
}

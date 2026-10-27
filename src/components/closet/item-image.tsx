"use client";
import { ImageOff } from "lucide-react";
import { useImageUrl } from "@/lib/store";
import type { ClothingItem } from "@/lib/types";
import { cx } from "../ui/primitives";

/** Displays an item's transparent cutout (or its original photo when no cutout exists). */
export function ItemImage({ item, className, imgClassName, priority }: { item: ClothingItem; className?: string; imgClassName?: string; priority?: boolean }) {
  const path = item.imageCutout ?? item.imageOriginal;
  const { url, failed } = useImageUrl(path);
  return (
    <div className={cx("relative flex items-center justify-center overflow-hidden", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={item.name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          className={cx("h-full w-full object-contain", item.imageCutout ? "cutout-shadow" : "rounded-xl object-cover", imgClassName)}
        />
      ) : failed ? (
        <div className="flex flex-col items-center gap-1 text-taupe">
          <ImageOff className="size-6" aria-hidden />
          <span className="text-xs">Image unavailable</span>
        </div>
      ) : (
        <div className="skeleton size-full rounded-xl" aria-hidden />
      )}
    </div>
  );
}

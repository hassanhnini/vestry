"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { useImageUrl } from "@/lib/store";
import type { ClothingItem } from "@/lib/types";
import { cx } from "../ui/primitives";

/** Displays an item's transparent cutout (or its original photo when no cutout exists). */
export function ItemImage({ item, className, imgClassName, priority }: { item: ClothingItem; className?: string; imgClassName?: string; priority?: boolean }) {
  const path = item.imageCutout ?? item.imageOriginal;
  const { url, failed, reload } = useImageUrl(path);
  // A signed link can expire while the page is open; ask for a fresh one before giving up.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const broken = !!url && brokenUrl === url;
  return (
    <div className={cx("relative flex items-center justify-center overflow-hidden", className)}>
      {url && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={item.name}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => !reload() && setBrokenUrl(url)}
          className={cx("h-full w-full object-contain", item.imageCutout ? "cutout-shadow" : "rounded-xl object-cover", imgClassName)}
        />
      ) : failed || broken ? (
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

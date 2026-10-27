"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ClothingItem } from "@/lib/types";
import { EMPTY_FILTER, filterItems } from "@/lib/closet-filter";
import { GROUPS } from "@/lib/taxonomy";
import { ItemCard } from "./item-card";
import { Button, Input, cx } from "../ui/primitives";
import { Sheet } from "../ui/overlay";

export function ItemPicker({
  open,
  onClose,
  title,
  items,
  selected,
  onChange,
  max = 99,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  items: ClothingItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]["id"] | "all">("all");
  const list = useMemo(() => filterItems(items, { ...EMPTY_FILTER, query, group }), [items, query, group]);
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (max === 1) onChange([id]);
    else if (selected.length < max) onChange([...selected, id]);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <div className="flex gap-2 pb-1">
          {selected.length > 0 && (
            <Button variant="secondary" onClick={() => onChange([])}>
              Clear
            </Button>
          )}
          <Button className="flex-1" onClick={onClose}>
            Done{selected.length ? ` (${selected.length})` : ""}
          </Button>
        </div>
      }
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-taupe" aria-hidden />
        <Input type="search" aria-label="Search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
      </div>
      <div className="scrollbar-none -mx-6 mt-3 flex gap-1.5 overflow-x-auto px-6">
        {[{ id: "all" as const, label: "All" }, ...GROUPS].map((g) => (
          <button key={g.id} onClick={() => setGroup(g.id)} aria-pressed={group === g.id} className={cx("h-9 shrink-0 rounded-full px-3.5 text-sm", group === g.id ? "bg-ink text-paper" : "text-ink-soft hover:bg-shell")}>
            {g.label}
          </button>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {list.map((i) => (
          <li key={i.id}>
            <ItemCard item={i} selected={selected.includes(i.id)} onSelect={() => toggle(i.id)} />
          </li>
        ))}
      </ul>
      {!list.length && <p className="py-8 text-center text-sm text-ink-soft">No pieces match.</p>}
    </Sheet>
  );
}

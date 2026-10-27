"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Shirt, SlidersHorizontal, X } from "lucide-react";
import { useWardrobe } from "@/lib/store";
import { EMPTY_FILTER, activeFilterCount, filterItems, type ClosetFilter, type SortKey } from "@/lib/closet-filter";
import { COLORS, GROUPS, OCCASIONS, SEASONS, STYLES } from "@/lib/taxonomy";
import { ItemCard } from "@/components/closet/item-card";
import { Button, ButtonLink, Chip, EmptyState, Input, PageHeader, Select, cx } from "@/components/ui/primitives";
import { Sheet, useOverlay } from "@/components/ui/overlay";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "recent", label: "Recently added" },
  { id: "category", label: "Category" },
  { id: "color", label: "Colour" },
  { id: "favorites", label: "Favourites first" },
  { id: "least-worn", label: "Least worn" },
  { id: "name", label: "Name" },
];

const STORAGE_KEY = "vestry.closetFilter";

export default function ClosetPage() {
  const { items, updateItem } = useWardrobe();
  const { toast } = useOverlay();
  const [f, setF] = useState<ClosetFilter>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? { ...EMPTY_FILTER, ...JSON.parse(saved), query: "" } : EMPTY_FILTER;
    } catch {
      return EMPTY_FILTER;
    }
  });
  const [sheet, setSheet] = useState(false);

  // Remember the last view for this tab (a convenience only).
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f));
    } catch {}
  }, [f]);

  const results = useMemo(() => filterItems(items, f), [items, f]);
  const counts = useMemo(() => {
    const visible = items.filter((i) => f.showArchived || !i.archived);
    return Object.fromEntries(GROUPS.map((g) => [g.id, filterItems(visible, { ...EMPTY_FILTER, group: g.id, showArchived: true }).length]));
  }, [items, f.showArchived]);
  const nActive = activeFilterCount(f);
  const toggle = <K extends "colors" | "seasons" | "styles" | "occasions">(k: K, v: ClosetFilter[K][number]) =>
    setF((x) => ({ ...x, [k]: (x[k] as string[]).includes(v) ? (x[k] as string[]).filter((y) => y !== v) : [...(x[k] as string[]), v] }));

  if (items.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Closet" title="My closet" />
        <EmptyState
          icon={<Shirt className="size-7" />}
          title="Your closet is waiting"
          body="Start with five to ten favourites — a few tops, bottoms and a pair of shoes are enough for your first outfits."
          action={<ButtonLink href="/add" icon={<Plus className="size-4" />}>Add your first piece</ButtonLink>}
        />
      </>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Closet"
        title="My closet"
        subtitle={`${items.filter((i) => !i.archived).length} pieces`}
      />
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-taupe" aria-hidden />
          <Input
            type="search"
            aria-label="Search your closet"
            placeholder="Search by name, colour, brand…"
            value={f.query}
            onChange={(e) => setF({ ...f, query: e.target.value })}
            className="pl-10"
          />
        </div>
        <Button variant="secondary" onClick={() => setSheet(true)} icon={<SlidersHorizontal className="size-4" />} aria-label={`Filters and sorting${nActive ? `, ${nActive} active` : ""}`} className="h-12 shrink-0">
          <span className="hidden sm:inline">Filter</span>
          {nActive > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-clay text-[0.6875rem] text-paper">{nActive}</span>}
        </Button>
      </div>

      <div className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Categories">
        {[{ id: "all" as const, label: "All" }, ...GROUPS].map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={f.group === g.id}
            onClick={() => setF({ ...f, group: g.id })}
            className={cx(
              "h-10 shrink-0 rounded-full px-4 text-sm transition",
              f.group === g.id ? "bg-ink text-paper" : "text-ink-soft hover:bg-shell",
            )}
          >
            {g.label}
            {g.id !== "all" && counts[g.id] > 0 && <span className="ml-1.5 text-[0.75rem] opacity-60">{counts[g.id]}</span>}
          </button>
        ))}
      </div>

      {nActive > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.8125rem]">
          {[...f.colors.map((c) => ["colors", c] as const), ...f.seasons.map((c) => ["seasons", c] as const), ...f.styles.map((c) => ["styles", c] as const), ...f.occasions.map((c) => ["occasions", c] as const)].map(([k, v]) => (
            <button key={k + v} onClick={() => toggle(k, v as never)} className="inline-flex items-center gap-1 rounded-full bg-shell px-3 py-1 text-ink-soft hover:text-ink">
              {COLORS.find((c) => c.id === v)?.label ?? STYLES.find((s) => s.id === v)?.label ?? OCCASIONS.find((o) => o.id === v)?.label ?? SEASONS.find((s) => s.id === v)?.label}
              <X className="size-3" aria-label="remove filter" />
            </button>
          ))}
          {f.favoritesOnly && <span className="rounded-full bg-shell px-3 py-1 text-ink-soft">Favourites</span>}
          {f.showArchived && <span className="rounded-full bg-shell px-3 py-1 text-ink-soft">Including archived</span>}
          <button onClick={() => setF({ ...EMPTY_FILTER, query: f.query, group: f.group, sort: f.sort })} className="font-medium text-clay underline-offset-2 hover:underline">
            Clear all
          </button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">{results.length} items shown</p>
      {results.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title="Nothing matches"
          body="Try a different search or clear your filters."
          action={<Button variant="secondary" onClick={() => setF({ ...EMPTY_FILTER, sort: f.sort })}>Clear search & filters</Button>}
        />
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((item, idx) => (
            <li key={item.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}>
              <ItemCard
                item={item}
                onToggleFavorite={() =>
                  updateItem(item.id, { favorite: !item.favorite }).catch((e) => toast(`Couldn't update: ${e.message}`, "error"))
                }
              />
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter & sort"
        footer={
          <div className="flex gap-2 pb-1">
            <Button variant="secondary" className="flex-1" onClick={() => setF({ ...EMPTY_FILTER, query: f.query, group: f.group })}>
              Reset
            </Button>
            <Button className="flex-1" onClick={() => setSheet(false)}>
              Show {results.length} pieces
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label htmlFor="sort" className="mb-2 block text-sm font-medium">Sort by</label>
            <Select id="sort" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as SortKey })}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </div>
          <FilterGroup title="Colour">
            {COLORS.map((c) => (
              <Chip key={c.id} size="sm" swatch={c.hex} selected={f.colors.includes(c.id)} onClick={() => toggle("colors", c.id)}>{c.label}</Chip>
            ))}
          </FilterGroup>
          <FilterGroup title="Season">
            {SEASONS.map((s) => (
              <Chip key={s.id} size="sm" selected={f.seasons.includes(s.id)} onClick={() => toggle("seasons", s.id)}>{s.label}</Chip>
            ))}
          </FilterGroup>
          <FilterGroup title="Style">
            {STYLES.map((s) => (
              <Chip key={s.id} size="sm" selected={f.styles.includes(s.id)} onClick={() => toggle("styles", s.id)}>{s.label}</Chip>
            ))}
          </FilterGroup>
          <FilterGroup title="Occasion">
            {OCCASIONS.map((o) => (
              <Chip key={o.id} size="sm" selected={f.occasions.includes(o.id)} onClick={() => toggle("occasions", o.id)}>{o.label}</Chip>
            ))}
          </FilterGroup>
          <FilterGroup title="More">
            <Chip size="sm" selected={f.favoritesOnly} onClick={() => setF({ ...f, favoritesOnly: !f.favoritesOnly })}>Favourites only</Chip>
            <Chip size="sm" selected={f.showArchived} onClick={() => setF({ ...f, showArchived: !f.showArchived })}>Show archived</Chip>
          </FilterGroup>
        </div>
      </Sheet>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

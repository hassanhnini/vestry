"use client";
import { useId, useState, type ReactNode } from "react";
import { CATEGORIES, COLORS, FITS, GROUPS, OCCASIONS, PATTERNS, SEASONS, STYLES } from "@/lib/taxonomy";
import type { AiMeta, Category, ClothingItem, Fit, Occasion, Pattern, Season, StyleId } from "@/lib/types";
import { Chip, ConfidenceBadge, Field, Input, Select, Textarea, cx } from "../ui/primitives";

export type ItemForm = Pick<
  ClothingItem,
  "name" | "category" | "colors" | "colorHex" | "pattern" | "material" | "fit" | "styles" | "seasons" | "occasions" | "formality" | "brand" | "notes"
>;

export function validateItemForm(f: ItemForm): string | null {
  if (!f.name.trim()) return "Please give this piece a name.";
  if (f.name.length > 120) return "Name is too long (120 characters max).";
  if (!CATEGORIES[f.category]) return "Please choose a category.";
  if (f.formality < 1 || f.formality > 5) return "Formality must be between 1 and 5.";
  return null;
}

function toggle<T>(xs: T[], x: T, max = 99) {
  return xs.includes(x) ? xs.filter((y) => y !== x) : xs.length >= max ? xs : [...xs, x];
}

function Label({ children, conf, ai, measured }: { children: ReactNode; conf?: number; ai: AiMeta; measured?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {children}
      {!ai.reviewed && <ConfidenceBadge value={conf} source={ai.source} measured={measured} />}
    </span>
  );
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function ItemEditor({ form, onChange, ai, compact }: { form: ItemForm; onChange: (f: ItemForm) => void; ai: AiMeta; compact?: boolean }) {
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => onChange({ ...form, [k]: v });
  const c = ai.confidence;
  const [allColors, setAllColors] = useState(false);
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;
  const visibleColors = allColors ? COLORS : COLORS.filter((col) => form.colors.includes(col.id) || ["black", "white", "grey", "navy", "beige", "camel", "denim", "brown"].includes(col.id));
  return (
    <div className={cx("space-y-6", compact && "space-y-5")}>
      <Field label="Name" htmlFor={fid("name")}>
        <Input id={fid("name")} value={form.name} maxLength={120} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Navy wool blazer" />
      </Field>

      <div className="space-y-1.5">
        <label htmlFor={fid("category")} className="block text-sm font-medium">
          <Label conf={c.category} ai={ai}>Category</Label>
        </label>
        <Select
          id={fid("category")}
          value={form.category}
          onChange={(e) => {
            const cat = e.target.value as Category;
            onChange({ ...form, category: cat, formality: form.formality || CATEGORIES[cat].formality });
          }}
        >
          {GROUPS.map((g) => (
            <optgroup key={g.id} label={g.label}>
              {(Object.keys(CATEGORIES) as Category[])
                .filter((k) => CATEGORIES[k].group === g.id)
                .map((k) => (
                  <option key={k} value={k}>
                    {CATEGORIES[k].label}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">
          <Label conf={c.colors} ai={ai} measured={form.colorHex.length > 0}>Colours</Label>
        </legend>
        {form.colorHex.length > 0 && (
          <p className="flex items-center gap-2 text-[0.8125rem] text-ink-soft">
            Measured from your photo:
            {form.colorHex.map((h) => (
              <span key={h} className="size-5 rounded-full ring-1 ring-black/10" style={{ background: h }} title={h} />
            ))}
          </p>
        )}
        <ChipRow>
          {visibleColors.map((col) => (
            <Chip key={col.id} size="sm" swatch={col.hex} selected={form.colors.includes(col.id)} onClick={() => set("colors", toggle(form.colors, col.id, 3))}>
              {col.label}
              {form.colors[0] === col.id && <span className="text-[0.625rem] uppercase tracking-wider opacity-70">main</span>}
            </Chip>
          ))}
          <button type="button" onClick={() => setAllColors((v) => !v)} aria-expanded={allColors} className="h-8 rounded-full px-3 text-[0.8125rem] font-medium text-clay underline-offset-2 hover:underline">
            {allColors ? "Fewer colours" : `All ${COLORS.length} colours`}
          </button>
        </ChipRow>
        <p className="text-[0.75rem] text-taupe">Choose up to three; the first is the main colour.</p>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={fid("pattern")} className="block text-sm font-medium">
            <Label conf={c.pattern} ai={ai}>Pattern</Label>
          </label>
          <Select id={fid("pattern")} value={form.pattern} onChange={(e) => set("pattern", e.target.value as Pattern)}>
            {PATTERNS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <Field label="Material (optional)" htmlFor={fid("material")}>
          <Input id={fid("material")} value={form.material ?? ""} maxLength={60} onChange={(e) => set("material", e.target.value || undefined)} placeholder="e.g. wool, denim, silk" />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Fit</legend>
        <ChipRow>
          {FITS.map((f) => (
            <Chip key={f.id} size="sm" selected={form.fit === f.id} onClick={() => set("fit", form.fit === f.id ? undefined : (f.id as Fit))}>
              {f.label}
            </Chip>
          ))}
        </ChipRow>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Seasons</legend>
        <ChipRow>
          {SEASONS.map((s) => (
            <Chip key={s.id} size="sm" selected={form.seasons.includes(s.id)} onClick={() => set("seasons", toggle(form.seasons, s.id as Season))}>
              {s.label}
            </Chip>
          ))}
        </ChipRow>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Occasions</legend>
        <ChipRow>
          {OCCASIONS.map((o) => (
            <Chip key={o.id} size="sm" selected={form.occasions.includes(o.id)} onClick={() => set("occasions", toggle(form.occasions, o.id as Occasion))}>
              {o.label}
            </Chip>
          ))}
        </ChipRow>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Style</legend>
        <ChipRow>
          {STYLES.map((s) => (
            <Chip key={s.id} size="sm" selected={form.styles.includes(s.id)} onClick={() => set("styles", toggle(form.styles, s.id as StyleId, 4))}>
              {s.label}
            </Chip>
          ))}
        </ChipRow>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Formality</legend>
        <div className="flex overflow-hidden rounded-full border border-line bg-paper" role="radiogroup" aria-label="Formality">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={form.formality === n}
              onClick={() => set("formality", n)}
              className={cx("h-10 flex-1 text-sm transition", form.formality === n ? "bg-ink text-paper" : "text-ink-soft hover:bg-shell/60")}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[0.75rem] text-taupe">
          <span>Very casual</span>
          <span>Formal</span>
        </div>
      </fieldset>

      {!compact && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Brand (optional)" htmlFor={fid("brand")}>
            <Input id={fid("brand")} value={form.brand ?? ""} maxLength={80} onChange={(e) => set("brand", e.target.value || undefined)} />
          </Field>
          <Field label="Notes (optional)" htmlFor={fid("notes")}>
            <Textarea id={fid("notes")} value={form.notes ?? ""} maxLength={1000} onChange={(e) => set("notes", e.target.value || undefined)} className="min-h-12" />
          </Field>
        </div>
      )}
    </div>
  );
}

export function formFromItem(i: ClothingItem): ItemForm {
  return {
    name: i.name,
    category: i.category,
    colors: i.colors,
    colorHex: i.colorHex,
    pattern: i.pattern,
    material: i.material,
    fit: i.fit,
    styles: i.styles,
    seasons: i.seasons,
    occasions: i.occasions,
    formality: i.formality,
    brand: i.brand,
    notes: i.notes,
  };
}

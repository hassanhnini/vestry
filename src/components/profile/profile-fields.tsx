"use client";
import { COLORS, OCCASIONS, STYLES } from "@/lib/taxonomy";
import type { Climate, Hemisphere, Occasion, StyleId, StyleProfile } from "@/lib/types";
import { Chip, cx } from "../ui/primitives";

type P = Pick<StyleProfile, "styles" | "favoriteColors" | "avoidColors" | "occasions" | "climate" | "hemisphere" | "fit" | "comfort">;
const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export function StylesField({ value, onChange }: { value: P; onChange: (p: Partial<P>) => void }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {STYLES.map((s) => {
        const on = value.styles.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange({ styles: toggle(value.styles, s.id as StyleId) })}
            className={cx("rounded-2xl border p-4 text-left transition active:scale-[0.99]", on ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-taupe-soft")}
          >
            <span className="block font-medium">{s.label}</span>
            <span className={cx("mt-0.5 block text-[0.8125rem]", on ? "text-paper/75" : "text-ink-soft")}>{s.blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ColorsField({ value, onChange, kind }: { value: P; onChange: (p: Partial<P>) => void; kind: "favoriteColors" | "avoidColors" }) {
  const other = kind === "favoriteColors" ? "avoidColors" : "favoriteColors";
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <Chip
          key={c.id}
          size="sm"
          swatch={c.hex}
          selected={value[kind].includes(c.id)}
          onClick={() => onChange({ [kind]: toggle(value[kind], c.id), [other]: value[other].filter((x) => x !== c.id) } as Partial<P>)}
        >
          {c.label}
        </Chip>
      ))}
    </div>
  );
}

export function OccasionsField({ value, onChange }: { value: P; onChange: (p: Partial<P>) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {OCCASIONS.map((o) => (
        <Chip key={o.id} selected={value.occasions.includes(o.id)} onClick={() => onChange({ occasions: toggle(value.occasions, o.id as Occasion) })}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

const CLIMATES: { id: Climate; label: string }[] = [
  { id: "cold", label: "Cold" },
  { id: "temperate", label: "Temperate" },
  { id: "warm", label: "Warm" },
  { id: "tropical", label: "Tropical" },
];

const HEMISPHERES: { id: Hemisphere; label: string }[] = [
  { id: "northern", label: "Northern" },
  { id: "southern", label: "Southern" },
];

export function ClimateField({ value, onChange }: { value: P; onChange: (p: Partial<P>) => void }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {CLIMATES.map((c) => (
          <Chip key={c.id} selected={value.climate === c.id} onClick={() => onChange({ climate: value.climate === c.id ? undefined : c.id })}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div>
        <p className="mb-2.5 text-sm font-medium">Hemisphere</p>
        <p className="mb-2.5 text-[0.8125rem] text-ink-soft">So that &ldquo;today&rsquo;s season&rdquo; matches yours. Northern unless you say otherwise.</p>
        <div className="flex flex-wrap gap-2">
          {HEMISPHERES.map((h) => (
            <Chip key={h.id} selected={(value.hemisphere ?? "northern") === h.id} onClick={() => onChange({ hemisphere: h.id })}>
              {h.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FitComfortField({ value, onChange }: { value: P; onChange: (p: Partial<P>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2.5 text-sm font-medium">Preferred fit</p>
        <div className="flex flex-wrap gap-2">
          {(["tailored", "mixed", "relaxed"] as const).map((f) => (
            <Chip key={f} selected={value.fit === f} onClick={() => onChange({ fit: f })}>
              {f === "tailored" ? "Tailored & structured" : f === "relaxed" ? "Relaxed & easy" : "A mix of both"}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="comfort-pref" className="mb-2.5 block text-sm font-medium">Comfort vs. statement</label>
        <input id="comfort-pref" type="range" min={1} max={5} value={value.comfort} onChange={(e) => onChange({ comfort: Number(e.target.value) })} className="w-full accent-[#97492f]" />
        <div className="flex justify-between text-[0.75rem] text-taupe">
          <span>I&apos;ll suffer for style</span>
          <span>Comfort always</span>
        </div>
      </div>
    </div>
  );
}

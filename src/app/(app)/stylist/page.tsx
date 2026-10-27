"use client";
import { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkCheck, ChevronDown, Cloud, CloudRain, Repeat, Shuffle, Snowflake, Sparkles, Sun, ThermometerSun, X, Wind } from "lucide-react";
import { useWardrobe } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useAiStatus } from "@/lib/ai/status";
import { OCCASIONS, STYLES, CATEGORIES } from "@/lib/taxonomy";
import { alternativesFor, explainOutfit, roleOf, signatureOf, type DressCode, type PalettePref, type SilhouettePref, type StyleRequest, type Weather } from "@/lib/stylist/engine";
import { runStylist, type ResultOutfit } from "@/lib/stylist/client";
import type { ClothingItem, Occasion, Role, StyleId } from "@/lib/types";
import { OutfitBoard } from "@/components/outfit/outfit-board";
import { ItemImage } from "@/components/closet/item-image";
import { ItemPicker } from "@/components/closet/item-picker";
import { Badge, Button, ButtonLink, Card, Chip, EmptyState, Input, PageHeader, cx } from "@/components/ui/primitives";
import { Sheet, useOverlay } from "@/components/ui/overlay";

const WEATHER: { id: Weather | null; label: string; icon: typeof Sun }[] = [
  { id: null, label: "Auto", icon: Wind },
  { id: "cold", label: "Cold", icon: Snowflake },
  { id: "mild", label: "Mild", icon: Cloud },
  { id: "warm", label: "Warm", icon: Sun },
  { id: "hot", label: "Hot", icon: ThermometerSun },
  { id: "rainy", label: "Rainy", icon: CloudRain },
];
const PALETTES: { id: PalettePref; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "neutral", label: "Neutrals" },
  { id: "tonal", label: "Tonal" },
  { id: "contrast", label: "High contrast" },
  { id: "colorful", label: "Colourful" },
];
const SILHOUETTES: { id: SilhouettePref; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "balanced", label: "Balanced" },
  { id: "relaxed", label: "Relaxed" },
  { id: "fitted", label: "Fitted" },
];
const DRESS_CODES: { id: DressCode; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "casual", label: "Casual" },
  { id: "smart-casual", label: "Smart casual" },
  { id: "business", label: "Business" },
  { id: "formal", label: "Formal" },
];
const SOURCE_LABEL = { rules: "On-device stylist", claude: "Styled with Claude", gemini: "Styled with Gemini", manual: "Your edit" } as const;
const ROLE_LABEL: Record<Role, string> = { top: "top", bottom: "bottom", "one-piece": "dress", outer: "layer", shoes: "shoes", bag: "bag", accessory: "accessory" };

export default function StylistPage() {
  return (
    <Suspense>
      <StylistRoute />
    </Suspense>
  );
}

function StylistRoute() {
  const params = useSearchParams();
  // Remount when the requested anchor changes so the form starts from it.
  return <Stylist key={params.get("anchor") ?? ""} initialAnchor={params.get("anchor")} initialRare={params.get("rare") === "1"} />;
}

function Stylist({ initialAnchor, initialRare }: { initialAnchor: string | null; initialRare: boolean }) {
  const router = useRouter();
  const { items, outfits: saved, profile, saveOutfit } = useWardrobe();
  const { getToken } = useAuth();
  const { status: ai } = useAiStatus();
  const { toast } = useOverlay();
  const active = useMemo(() => items.filter((i) => !i.archived), [items]);

  const [style, setStyle] = useState<StyleId | null>(null);
  const [customStyle, setCustomStyle] = useState("");
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [customOccasion, setCustomOccasion] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [palette, setPalette] = useState<PalettePref>("any");
  const [silhouette, setSilhouette] = useState<SilhouettePref>("any");
  const [dressCode, setDressCode] = useState<DressCode>("any");
  const [comfort, setComfort] = useState(profile.comfort ?? 3);
  const [rarely, setRarely] = useState(initialRare);
  const [anchors, setAnchors] = useState<string[]>(() => (initialAnchor ? [initialAnchor] : []));
  const [exclude, setExclude] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [picker, setPicker] = useState<"anchor" | "exclude" | null>(null);
  const [engineChoice, setEngine] = useState<"ai" | "rules" | null>(null);
  const engine = engineChoice ?? (ai?.provider && profile.cloudAi ? "ai" : "rules");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultOutfit[]>([]);
  const [notice, setNotice] = useState<string | undefined>();
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const [swap, setSwap] = useState<{ key: string; role: Role } | null>(null);
  const seed = useRef(0);
  const shown = useRef<string[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);


  const req: StyleRequest = {
    style,
    customStyle: customStyle.trim() || undefined,
    occasion,
    customOccasion: customOccasion.trim() || undefined,
    weather,
    palette,
    silhouette,
    dressCode,
    comfort,
    preferRarelyWorn: rarely,
    anchorItemIds: anchors,
    excludeItemIds: exclude,
    count: 4,
  };

  const generate = async (fresh: boolean) => {
    setLoading(true);
    if (fresh) shown.current = [];
    seed.current = seed.current ? seed.current + 7919 : Date.now() % 100000;
    try {
      const run = await runStylist({
        items: active,
        req: { ...req, seed: seed.current },
        profile,
        avoidSignatures: [...shown.current, ...saved.map((o) => signatureOf(o.itemIds))],
        engine,
        token: await getToken(),
      });
      if (run.fallbackReason) toast(`AI stylist unavailable (${run.fallbackReason}) — showing on-device suggestions.`, "info");
      shown.current.push(...run.outfits.map((o) => o.signature));
      setResults(run.outfits);
      setNotice(run.notice);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } finally {
      setLoading(false);
    }
  };

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const resolve = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as ClothingItem[];

  const save = async (o: ResultOutfit) => {
    if (savedMap[o.key]) return;
    try {
      const out = await saveOutfit({
        name: o.name,
        itemIds: o.itemIds,
        explanation: o.explanation,
        source: o.source,
        style: style ? STYLES.find((s) => s.id === style)?.label : customStyle || undefined,
        occasion: occasion ? OCCASIONS.find((x) => x.id === occasion)?.label : customOccasion || undefined,
      });
      setSavedMap((m) => ({ ...m, [o.key]: out.id }));
      toast("Outfit saved.", "success", { label: "View", onClick: () => router.push(`/outfits/${out.id}`) });
    } catch (e) {
      toast(`Couldn't save: ${(e as Error).message}`, "error");
    }
  };

  const applySwap = (key: string, role: Role, replacement: ClothingItem) => {
    setResults((rs) =>
      rs.map((o) => {
        if (o.key !== key) return o;
        const kept = resolve(o.itemIds).filter((i) => roleOf(i) !== role);
        const next = [...kept, replacement];
        return { ...o, itemIds: next.map((i) => i.id), explanation: explainOutfit(next, req, { profile }) || o.explanation, source: o.source === "rules" ? "rules" : "manual", signature: signatureOf(next.map((i) => i.id)) };
      }),
    );
    setSavedMap((m) => {
      const n = { ...m };
      delete n[key];
      return n;
    });
    setSwap(null);
  };

  const hasBase = active.some((i) => roleOf(i) === "one-piece") || (active.some((i) => roleOf(i) === "top") && active.some((i) => roleOf(i) === "bottom"));
  if (!hasBase) {
    return (
      <>
        <PageHeader eyebrow="Stylist" title="Create an outfit" />
        <EmptyState
          icon={<Sparkles className="size-7" />}
          title="A few more pieces first"
          body="Your stylist only uses clothes you own. Add at least one top and one bottom (or a dress) — plus shoes — to unlock outfit ideas."
          action={<ButtonLink href="/add">Add clothes</ButtonLink>}
        />
      </>
    );
  }

  const anchorItems = resolve(anchors);
  return (
    <div>
      <PageHeader eyebrow="Stylist" title="Create an outfit" subtitle="Every look is built only from pieces in your closet." />
      <Card className="space-y-6 p-5 sm:p-7">
        <section>
          <h2 className="mb-2.5 text-sm font-medium">Style around a piece <span className="font-normal text-taupe">(optional)</span></h2>
          <div className="flex flex-wrap items-center gap-2">
            {anchorItems.map((i) => (
              <span key={i.id} className="inline-flex items-center gap-2 rounded-full bg-shell py-1 pl-1 pr-2 text-sm">
                <ItemImage item={i} className="size-8 rounded-full bg-paper p-0.5" />
                {i.name}
                <button onClick={() => setAnchors((a) => a.filter((x) => x !== i.id))} aria-label={`Remove ${i.name}`} className="rounded-full p-1 hover:bg-paper">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setPicker("anchor")}>
              {anchorItems.length ? "Change" : "Choose a piece"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRarely((v) => !v)} aria-pressed={rarely} className={cx(rarely && "bg-clay-soft text-clay")}>
              <Repeat className="size-3.5" /> Rarely worn
            </Button>
          </div>
        </section>

        <section>
          <h2 className="mb-2.5 text-sm font-medium">Style</h2>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <Chip key={s.id} size="sm" selected={style === s.id} onClick={() => setStyle(style === s.id ? null : s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
          <Input className="mt-2.5 h-10 text-sm" placeholder="Or describe it — e.g. 'coastal grandmother'" value={customStyle} maxLength={200} onChange={(e) => setCustomStyle(e.target.value)} aria-label="Custom style" />
        </section>

        <section>
          <h2 className="mb-2.5 text-sm font-medium">Occasion</h2>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <Chip key={o.id} size="sm" selected={occasion === o.id} onClick={() => setOccasion(occasion === o.id ? null : o.id)}>
                {o.label}
              </Chip>
            ))}
          </div>
          <Input className="mt-2.5 h-10 text-sm" placeholder="Or your own — e.g. 'gallery opening'" value={customOccasion} maxLength={200} onChange={(e) => setCustomOccasion(e.target.value)} aria-label="Custom occasion" />
        </section>

        <section>
          <h2 className="mb-2.5 text-sm font-medium">Weather</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Weather">
            {WEATHER.map(({ id, label, icon: Icon }) => (
              <button
                key={label}
                role="radio"
                aria-checked={weather === id}
                onClick={() => setWeather(id)}
                className={cx("flex h-14 flex-col items-center justify-center gap-1 rounded-2xl border text-[0.8125rem] transition", weather === id ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-taupe-soft")}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </section>

        <button onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
          More preferences <ChevronDown className={cx("size-4 transition", more && "rotate-180")} aria-hidden />
        </button>
        {more && (
          <div className="grid animate-fade-in gap-6 sm:grid-cols-2">
            <Segment label="Colour palette" options={PALETTES} value={palette} onChange={setPalette} />
            <Segment label="Silhouette" options={SILHOUETTES} value={silhouette} onChange={setSilhouette} />
            <Segment label="Dress code" options={DRESS_CODES} value={dressCode} onChange={setDressCode} />
            <div>
              <label htmlFor="comfort" className="mb-2.5 block text-sm font-medium">
                Comfort level
              </label>
              <input id="comfort" type="range" min={1} max={5} value={comfort} onChange={(e) => setComfort(Number(e.target.value))} className="w-full accent-[#97492f]" />
              <div className="flex justify-between text-[0.75rem] text-taupe">
                <span>Style first</span>
                <span>Comfort first</span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <h3 className="mb-2.5 text-sm font-medium">Leave out</h3>
              <div className="flex flex-wrap items-center gap-2">
                {resolve(exclude).map((i) => (
                  <span key={i.id} className="inline-flex items-center gap-1 rounded-full bg-shell px-3 py-1 text-sm">
                    {i.name}
                    <button onClick={() => setExclude((x) => x.filter((y) => y !== i.id))} aria-label={`Allow ${i.name} again`} className="rounded-full p-0.5 hover:bg-paper">
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
                <Button size="sm" variant="secondary" onClick={() => setPicker("exclude")}>
                  Choose pieces to skip
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-line/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-ink-soft" role="radiogroup" aria-label="Stylist engine">
            <Chip size="sm" selected={engine === "rules"} onClick={() => setEngine("rules")}>
              On-device stylist
            </Chip>
            <Chip size="sm" selected={engine === "ai"} onClick={() => (ai?.provider ? setEngine("ai") : toast("No cloud AI is configured on this server. The on-device stylist is always available.", "info"))}>
              {ai?.provider ? `AI stylist (${ai.provider === "claude" ? "Claude" : "Gemini"})` : "AI stylist · not configured"}
            </Chip>
          </div>
          <Button size="lg" loading={loading} onClick={() => generate(true)} icon={!loading && <Sparkles className="size-4" />}>
            {loading ? "Styling…" : "Create outfits"}
          </Button>
        </div>
      </Card>

      <div ref={resultsRef} className="scroll-mt-4">
        {loading && results.length === 0 && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2" aria-hidden>
            {[0, 1].map((i) => (
              <div key={i} className="skeleton aspect-[4/5] rounded-[1.4rem]" />
            ))}
          </div>
        )}
        {results.length > 0 && (
          <section className="mt-10" aria-live="polite">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="font-display text-[1.75rem]">Your looks</h2>
              <Button variant="secondary" size="sm" icon={<Shuffle className="size-4" />} loading={loading} onClick={() => generate(false)}>
                More ideas
              </Button>
            </div>
            {notice && <p className="mb-4 rounded-2xl bg-paper px-4 py-3 text-[0.875rem] text-ink-soft ring-1 ring-line">{notice}</p>}
            <ul className="grid gap-6 md:grid-cols-2">
              {results.map((o, idx) => {
                const its = resolve(o.itemIds);
                const isSaved = !!savedMap[o.key];
                return (
                  <li key={o.key} className="animate-fade-up" style={{ animationDelay: `${idx * 70}ms` }}>
                    <Card className="overflow-hidden" data-testid="outfit-result">
                      <div className="p-3">
                        <OutfitBoard items={its} interactive />
                      </div>
                      <div className="px-5 pb-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-display text-xl leading-tight">{o.name}</h3>
                            <Badge className="mt-1.5" tone={o.source === "rules" ? "neutral" : "accent"}>{SOURCE_LABEL[o.source]}</Badge>
                          </div>
                          <Button size="sm" variant={isSaved ? "secondary" : "primary"} onClick={() => save(o)} icon={isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}>
                            {isSaved ? "Saved" : "Save"}
                          </Button>
                        </div>
                        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{o.explanation}</p>
                        <ul className="mt-4 space-y-1.5">
                          {its.map((i) => (
                            <li key={i.id} className="flex items-center gap-3">
                              <Link href={`/closet/${i.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 hover:bg-shell/50">
                                <ItemImage item={i} className="garment-stage size-11 shrink-0 rounded-xl p-1" />
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium">{i.name}</span>
                                  <span className="block text-[0.75rem] text-taupe">{CATEGORIES[i.category].label}</span>
                                </span>
                              </Link>
                              <Button size="sm" variant="ghost" onClick={() => setSwap({ key: o.key, role: roleOf(i) })} aria-label={`Swap the ${ROLE_LABEL[roleOf(i)]}`}>
                                Swap
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      <ItemPicker open={picker === "anchor"} onClose={() => setPicker(null)} title="Style around…" items={active} selected={anchors} onChange={setAnchors} max={2} />
      <ItemPicker open={picker === "exclude"} onClose={() => setPicker(null)} title="Leave out" items={active} selected={exclude} onChange={setExclude} />
      {swap && <SwapSheet swap={swap} outfit={results.find((r) => r.key === swap.key)!} items={active} req={req} onClose={() => setSwap(null)} onPick={(it) => applySwap(swap.key, swap.role, it)} />}
    </div>
  );
}

function Segment<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div>
      <h3 className="mb-2.5 text-sm font-medium">{label}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.id} size="sm" selected={value === o.id} onClick={() => onChange(o.id)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function SwapSheet({ swap, outfit, items, req, onClose, onPick }: { swap: { role: Role }; outfit: ResultOutfit; items: ClothingItem[]; req: StyleRequest; onClose: () => void; onPick: (i: ClothingItem) => void }) {
  const { profile } = useWardrobe();
  const alts = alternativesFor(items, outfit.itemIds, swap.role, req, { profile }, 9);
  return (
    <Sheet open onClose={onClose} title={`Swap the ${ROLE_LABEL[swap.role]}`} size="lg">
      {alts.length ? (
        <>
          <p className="mb-4 text-sm text-ink-soft">Ranked by how well each piece works with the rest of this look.</p>
          <ul className="grid grid-cols-3 gap-3">
            {alts.map(({ item }, idx) => (
              <li key={item.id}>
                <button onClick={() => onPick(item)} className="group block w-full text-left">
                  <div className="garment-stage relative aspect-square rounded-2xl p-[14%] transition group-hover:shadow-[var(--shadow-soft)]">
                    <ItemImage item={item} className="size-full" />
                    {idx === 0 && <Badge tone="accent" className="absolute left-2 top-2">Best match</Badge>}
                  </div>
                  <p className="mt-1.5 truncate text-[0.8125rem] font-medium">{item.name}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-ink-soft">There are no other {ROLE_LABEL[swap.role]} options in your closet yet.</p>
      )}
    </Sheet>
  );
}

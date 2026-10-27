// Rules-based stylist. Always available, runs entirely on-device, and is the fallback whenever a
// cloud model is unconfigured or unreachable. It only ever combines items passed in from the
// user's closet — it cannot invent garments.
import { CATEGORIES, COLOR_BY_ID, OCCASIONS, PATTERNS, STYLE_BY_ID, STYLES, colorLabel } from "../taxonomy";
import { chroma, colorLab, hueAngle, hueDistance, isNeutral } from "../color";
import type { ClothingItem, Fit, Occasion, Role, Season, StyleId, StyleProfile } from "../types";

export type Weather = "cold" | "mild" | "warm" | "hot" | "rainy";
export type PalettePref = "any" | "neutral" | "tonal" | "contrast" | "colorful";
export type SilhouettePref = "any" | "relaxed" | "fitted" | "balanced";
export type DressCode = "any" | "casual" | "smart-casual" | "business" | "formal";

export interface StyleRequest {
  style?: StyleId | null;
  customStyle?: string;
  occasion?: Occasion | null;
  customOccasion?: string;
  season?: Season | null;
  weather?: Weather | null;
  palette?: PalettePref;
  silhouette?: SilhouettePref;
  /** 1 = style over comfort … 5 = comfort first */
  comfort?: number;
  dressCode?: DressCode;
  /** Items that must appear in every outfit. */
  anchorItemIds?: string[];
  /** Items that must never appear. */
  excludeItemIds?: string[];
  preferRarelyWorn?: boolean;
  count?: number;
  seed?: number;
}

export interface StylistContext {
  profile?: StyleProfile | null;
  /** Signatures (sorted item ids) of outfits already suggested or saved — avoided when possible. */
  avoidSignatures?: string[];
  now?: Date;
}

export interface SuggestedOutfit {
  itemIds: string[];
  name: string;
  explanation: string;
  reasons: string[];
  score: number;
  signature: string;
}

export interface StylistResult {
  outfits: SuggestedOutfit[];
  /** Human-readable reason when fewer outfits than requested could be built. */
  notice?: string;
}

const CORE_ROLES: Role[] = ["top", "bottom", "one-piece", "outer", "shoes"];
const HIGH_LOW_STYLES: StyleId[] = ["elevated-high-street", "trendy", "smart-casual", "streetwear", "chic-casual"];
const FIT_VOLUME: Record<Fit, number> = { fitted: 0, regular: 1, relaxed: 2, oversized: 3 };

export function signatureOf(ids: string[]) {
  return [...ids].sort().join("|");
}

export function roleOf(item: ClothingItem): Role {
  return CATEGORIES[item.category]?.role ?? "accessory";
}

function defaultFit(item: ClothingItem): Fit {
  if (item.fit) return item.fit;
  switch (item.category) {
    case "wide-leg-trousers":
    case "sweatshirt":
    case "cardigan":
      return "relaxed";
    case "leggings":
    case "tank-top":
      return "fitted";
    default:
      return "regular";
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seasonFor(date: Date, climate?: StyleProfile["climate"]): Season {
  const m = date.getMonth(); // northern-hemisphere default; the user can always pick a season explicitly
  const s: Season = m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn";
  if (climate === "tropical") return "summer";
  if (climate === "cold" && s === "autumn") return "winter";
  return s;
}

function weatherFromSeason(season: Season): Weather {
  return season === "winter" ? "cold" : season === "summer" ? "warm" : "mild";
}

function seasonFromWeather(w: Weather): Season | null {
  return w === "cold" ? "winter" : w === "hot" || w === "warm" ? "summer" : null;
}

function formalityTarget(req: StyleRequest): [number, number] {
  switch (req.dressCode) {
    case "casual":
      return [1, 2];
    case "smart-casual":
      return [2, 4];
    case "business":
      return [3, 5];
    case "formal":
      return [4, 5];
  }
  const occ = OCCASIONS.find((o) => o.id === req.occasion);
  if (occ) return occ.formality;
  if (req.style) return STYLE_BY_ID[req.style].formality;
  return [1, 5];
}

function primaryLab(item: ClothingItem) {
  return colorLab(item.colorHex[0] ?? item.colors[0] ?? "#888888");
}

function primaryColorId(item: ClothingItem) {
  return item.colors[0] ?? "grey";
}

const isBold = (item: ClothingItem) => PATTERNS.find((p) => p.id === item.pattern)?.bold ?? false;

interface Scored {
  total: number;
  parts: Record<string, number>;
  reasons: { weight: number; text: string }[];
}

interface Resolved {
  season: Season;
  weather: Weather;
  formality: [number, number];
  styles: StyleId[];
  palette: PalettePref;
  comfort: number;
}

function resolve(req: StyleRequest, ctx: StylistContext): Resolved {
  const now = ctx.now ?? new Date();
  const season = req.season ?? (req.weather ? seasonFromWeather(req.weather) : null) ?? seasonFor(now, ctx.profile?.climate);
  const weather = req.weather ?? weatherFromSeason(season);
  const styles: StyleId[] = req.style ? [req.style] : ctx.profile?.styles?.length ? ctx.profile.styles : [];
  const palette =
    req.palette && req.palette !== "any"
      ? req.palette
      : req.style
        ? STYLE_BY_ID[req.style].palette
        : "any";
  return {
    season,
    weather,
    formality: formalityTarget(req),
    styles,
    palette,
    comfort: req.comfort ?? ctx.profile?.comfort ?? 3,
  };
}

/** Score a (possibly partial) outfit. Higher is better; roughly −5 … +5. */
export function scoreOutfit(items: ClothingItem[], req: StyleRequest, ctx: StylistContext, r = resolve(req, ctx)): Scored {
  const parts: Record<string, number> = {};
  const reasons: { weight: number; text: string }[] = [];
  const core = items.filter((i) => CORE_ROLES.includes(roleOf(i)));
  const byRole = (role: Role) => items.find((i) => roleOf(i) === role);
  const name = (i: ClothingItem) => i.name.toLowerCase();

  // ---- Colour harmony -------------------------------------------------------
  const colorItems = items.filter((i) => roleOf(i) !== "accessory");
  const accents = colorItems.filter((i) => !isNeutral(primaryColorId(i)));
  const accentIds = [...new Set(accents.map(primaryColorId))];
  let color = 0;
  if (accentIds.length === 0) {
    color = r.palette === "colorful" ? 0.1 : 0.6;
    const labs = core.map(primaryLab);
    const lightness = labs.map((l) => l[0]);
    const spread = lightness.length ? Math.max(...lightness) - Math.min(...lightness) : 0;
    const names = [...new Set(core.map(primaryColorId))].slice(0, 3).map(colorLabel).map((s) => s.toLowerCase());
    if (spread < 28 && core.length > 1) {
      color += r.palette === "tonal" ? 0.5 : 0.25;
      reasons.push({ weight: 0.7, text: `A tonal palette of ${listJoin(names)} looks considered and quietly expensive.` });
    } else if (spread > 55) {
      color += r.palette === "contrast" ? 0.5 : 0.2;
      reasons.push({ weight: 0.6, text: `Crisp contrast between ${listJoin(names)} keeps the neutrals sharp rather than flat.` });
    } else {
      reasons.push({ weight: 0.4, text: `An all-neutral base of ${listJoin(names)} — easy to wear and hard to get wrong.` });
    }
    if (r.palette === "neutral") color += 0.3;
  } else if (accentIds.length === 1) {
    color = r.palette === "neutral" || r.palette === "tonal" ? 0.4 : 0.85;
    const accent = accents[0];
    const sameAccentCount = accents.length;
    reasons.push({
      weight: 0.8,
      text:
        sameAccentCount > 1
          ? `Repeating ${colorLabel(primaryColorId(accent)).toLowerCase()} across ${sameAccentCount} pieces ties the look together.`
          : `The ${name(accent)} is the single pop of colour against neutrals — intentional, not busy.`,
    });
  } else {
    const hues = accents.map((a) => hueAngle(primaryLab(a)));
    const chromas = accents.map((a) => chroma(primaryLab(a)));
    let worst = 0;
    for (let i = 0; i < hues.length; i++)
      for (let j = i + 1; j < hues.length; j++) worst = Math.max(worst, hueDistance(hues[i], hues[j]));
    const labels = accentIds.map(colorLabel).map((s) => s.toLowerCase());
    if (worst <= 40) {
      color = r.palette === "colorful" ? 0.8 : 0.5;
      reasons.push({ weight: 0.7, text: `${cap(listJoin(labels))} sit side by side on the colour wheel, so they blend softly.` });
    } else if (worst >= 150 && accentIds.length === 2) {
      color = r.palette === "colorful" || r.palette === "contrast" ? 0.7 : 0.15;
      reasons.push({ weight: 0.6, text: `${cap(listJoin(labels))} is a confident complementary pairing.` });
    } else if (Math.min(...chromas) < 25) {
      // muted colours forgive more
      color = 0.2;
    } else {
      color = -0.6;
    }
    if (accentIds.length >= 3 && r.palette !== "colorful") color -= 0.5;
  }
  const avoid = ctx.profile?.avoidColors ?? [];
  const fav = ctx.profile?.favoriteColors ?? [];
  let profileScore = 0;
  for (const i of items) {
    const c = primaryColorId(i);
    if (avoid.includes(c)) profileScore -= 0.8;
    if (fav.includes(c)) profileScore += 0.15;
  }
  parts.color = color;
  parts.profile = profileScore;

  // ---- Pattern ----------------------------------------------------------------
  const bold = items.filter((i) => roleOf(i) !== "accessory" && isBold(i));
  const stripes = items.filter((i) => i.pattern === "striped");
  let pattern = 0.2;
  if (bold.length === 1) {
    pattern = 0.45;
    reasons.push({ weight: 0.5, text: `One statement print — the ${name(bold[0])} — with calm pieces around it keeps the focus.` });
  } else if (bold.length >= 2) pattern = -0.7;
  if (stripes.length >= 2) pattern -= 0.3;
  const top = byRole("top"), bottom = byRole("bottom");
  if (top?.pattern === "denim" && bottom?.pattern === "denim") pattern -= 0.15;
  parts.pattern = pattern;

  // ---- Formality ----------------------------------------------------------------
  const [lo, hi] = r.formality;
  let formality = 0;
  for (const i of items) {
    const w = roleOf(i) === "accessory" || roleOf(i) === "bag" ? 0.4 : 1;
    const f = i.formality;
    if (f < lo) formality -= (lo - f) * 0.35 * w;
    if (f > hi) formality -= (f - hi) * 0.35 * w;
  }
  const coreF = core.map((i) => i.formality);
  if (coreF.length >= 2) {
    const spreadF = Math.max(...coreF) - Math.min(...coreF);
    const highLow = r.styles.some((s) => HIGH_LOW_STYLES.includes(s));
    if (spreadF >= 3) formality -= 0.5;
    else if (spreadF === 2) {
      if (highLow) {
        formality += 0.15;
        const casual = core.reduce((a, b) => (a.formality <= b.formality ? a : b));
        const smart = core.reduce((a, b) => (a.formality >= b.formality ? a : b));
        reasons.push({ weight: 0.55, text: `The ${name(casual)} dresses down the ${name(smart)} for a modern high–low mix.` });
      } else formality -= 0.1;
    }
  }
  parts.formality = formality / Math.max(1, items.length / 3);

  // ---- Season & warmth ----------------------------------------------------------
  let season = 0;
  for (const i of core) if (i.seasons.length && !i.seasons.includes(r.season)) season -= 0.35;
  const warmth = items.reduce((s, i) => s + (CATEGORIES[i.category]?.warmth ?? 0), 0);
  const target = r.weather === "cold" ? [5, 9] : r.weather === "hot" ? [0, 2] : r.weather === "warm" ? [0, 3] : [2, 6];
  if (warmth < target[0]) season -= (target[0] - warmth) * 0.25;
  if (warmth > target[1]) season -= (warmth - target[1]) * 0.25;
  const shoes = byRole("shoes");
  if (r.weather === "rainy") {
    if (shoes && ["boots", "sneakers"].includes(shoes.category)) season += 0.2;
    if (shoes && ["sandals", "heels"].includes(shoes.category)) season -= 0.4;
  }
  parts.season = season;

  // ---- Aesthetic -----------------------------------------------------------------
  let style = 0;
  if (r.styles.length) {
    const per = r.styles.map((sid) => {
      const s = STYLE_BY_ID[sid];
      if (!s) return 0;
      let sum = 0;
      for (const i of items) {
        let v = 0;
        if (s.categories.includes(i.category)) v += 0.25;
        if (s.colors.includes(primaryColorId(i))) v += 0.15;
        if (s.patterns.includes(i.pattern)) v += 0.1;
        if (i.styles.includes(sid)) v += 0.25;
        sum += v;
      }
      return sum / Math.max(1, items.length);
    });
    style = Math.max(...per) * 2 - 0.3;
  }
  parts.style = style;

  // ---- Occasion -------------------------------------------------------------------
  let occasion = 0;
  if (req.occasion) {
    for (const i of core) {
      if (i.occasions.includes(req.occasion)) occasion += 0.2;
      else if (i.occasions.length) occasion -= 0.05;
    }
    occasion /= Math.max(1, core.length / 2);
  }
  parts.occasion = occasion;

  // ---- Silhouette / proportion -----------------------------------------------------------
  let silhouette = 0;
  if (top && bottom) {
    const tv = FIT_VOLUME[defaultFit(top)], bv = FIT_VOLUME[defaultFit(bottom)];
    const pref = req.silhouette ?? "any";
    if (Math.abs(tv - bv) >= 2) {
      silhouette = pref === "balanced" || pref === "any" ? 0.35 : 0.1;
      const [loose, slim] = tv > bv ? [top, bottom] : [bottom, top];
      reasons.push({ weight: 0.5, text: `The relaxed ${name(loose)} balances the sleeker ${name(slim)}, keeping proportions sharp.` });
    } else if (tv >= 2 && bv >= 2) {
      silhouette = pref === "relaxed" ? 0.4 : -0.1;
      if (pref === "relaxed") reasons.push({ weight: 0.4, text: `Volume on volume gives a relaxed, of-the-moment line.` });
    } else if (tv === 0 && bv === 0) {
      silhouette = pref === "fitted" ? 0.4 : 0;
    } else {
      silhouette = pref === "relaxed" && (tv >= 2 || bv >= 2) ? 0.2 : 0.1;
    }
  }
  parts.silhouette = silhouette;

  // ---- Comfort ---------------------------------------------------------------------------
  let comfort = 0;
  if (shoes) {
    if (shoes.category === "heels") comfort -= (r.comfort - 2) * 0.25;
    if (["sneakers", "flats", "loafers"].includes(shoes.category)) comfort += (r.comfort - 3) * 0.12;
  }
  parts.comfort = comfort;

  // ---- Novelty (rarely worn) ---------------------------------------------------------------
  let novelty = 0;
  if (req.preferRarelyWorn) {
    const rare = items.filter((i) => i.wearCount <= 1);
    novelty = (rare.length / Math.max(1, items.length)) * 0.8;
    if (rare.length) {
      const pick = rare.find((i) => roleOf(i) !== "accessory") ?? rare[0];
      reasons.push({ weight: 0.65, text: `Gives your ${name(pick)} a fresh outing — it has ${pick.wearCount === 0 ? "not been logged as worn yet" : "only been worn once"}.` });
    }
  }
  parts.novelty = novelty;

  // ---- Shoes & finishing reasons -----------------------------------------------------------
  if (shoes && core.length > 1) {
    const occLabel = req.occasion ? OCCASIONS.find((o) => o.id === req.occasion)?.label.toLowerCase() : null;
    if (shoes.formality >= 3 && lo >= 3) reasons.push({ weight: 0.35, text: `The ${name(shoes)} keep it polished${occLabel ? ` for ${occLabel}` : ""}.` });
    else if (shoes.formality <= 2 && r.comfort >= 4) reasons.push({ weight: 0.3, text: `The ${name(shoes)} keep you comfortable all day.` });
  }
  const outer = byRole("outer");
  if (outer && r.weather === "cold") reasons.push({ weight: 0.45, text: `The ${name(outer)} adds warmth and frames everything underneath.` });
  else if (outer && outer.formality >= 4) reasons.push({ weight: 0.35, text: `Layering the ${name(outer)} instantly sharpens the base.` });
  const bag = byRole("bag");
  if (bag) {
    const echo = items.find((i) => i !== bag && primaryColorId(i) === primaryColorId(bag));
    if (echo) reasons.push({ weight: 0.4, text: `The ${name(bag)} echoes the ${name(echo)}, which makes the outfit feel finished.` });
  }

  const weights = { color: 1.2, pattern: 0.8, formality: 1.0, season: 1.0, style: 0.9, occasion: 0.6, silhouette: 0.5, comfort: 0.5, profile: 0.6, novelty: 0.5 };
  const total = Object.entries(weights).reduce((s, [k, w]) => s + (parts[k] ?? 0) * w, 0);
  return { total, parts, reasons };
}

function listJoin(xs: string[]) {
  if (xs.length <= 1) return xs[0] ?? "";
  return xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
}
function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const OCCASION_SUFFIX: Partial<Record<Occasion, string>> = {
  work: "office edit",
  university: "campus edit",
  date: "date night",
  dinner: "dinner look",
  travel: "travel uniform",
  weekend: "weekend ease",
  party: "party look",
  formal: "black-tie edit",
  everyday: "everyday edit",
  sport: "active edit",
};

export function nameOutfit(items: ClothingItem[], req: StyleRequest): string {
  const hero =
    items.find((i) => roleOf(i) === "one-piece") ??
    items.find((i) => roleOf(i) === "outer" && i.formality >= 3) ??
    items.find((i) => !isNeutral(primaryColorId(i)) && roleOf(i) !== "accessory") ??
    items.find((i) => roleOf(i) === "top") ??
    items[0];
  const label = (i: ClothingItem) => `${COLOR_BY_ID[primaryColorId(i)]?.label ?? ""} ${CATEGORIES[i.category].label.toLowerCase()}`.trim();
  const heroName = hero ? label(hero) : "Outfit";
  const suffix = req.occasion ? OCCASION_SUFFIX[req.occasion] : req.style ? STYLE_BY_ID[req.style].label.toLowerCase() : null;
  if (suffix) return `${cap(heroName)}, ${suffix}`;
  // No occasion or style chosen: name the look after its two key pieces.
  const partner = items.find((i) => i !== hero && ["bottom", "top", "outer", "shoes"].includes(roleOf(i)));
  return partner ? `${cap(heroName)} & ${label(partner).toLowerCase()}` : cap(heroName);
}

interface Pools {
  top: ClothingItem[];
  bottom: ClothingItem[];
  "one-piece": ClothingItem[];
  outer: ClothingItem[];
  shoes: ClothingItem[];
  bag: ClothingItem[];
  accessory: ClothingItem[];
}

function pools(items: ClothingItem[]): Pools {
  const p: Pools = { top: [], bottom: [], "one-piece": [], outer: [], shoes: [], bag: [], accessory: [] };
  for (const i of items) p[roleOf(i)].push(i);
  return p;
}

function jaccard(a: string[], b: string[]) {
  const A = new Set(a), B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter || 1);
}

/** Generate outfit suggestions from the user's own closet. */
export function generateOutfits(closet: ClothingItem[], req: StyleRequest, ctx: StylistContext = {}): StylistResult {
  const count = Math.max(1, Math.min(req.count ?? 4, 8));
  const rand = mulberry32(req.seed ?? 42);
  const exclude = new Set(req.excludeItemIds ?? []);
  const available = closet.filter((i) => !i.archived && !exclude.has(i.id));
  const anchors = (req.anchorItemIds ?? []).map((id) => available.find((i) => i.id === id)).filter(Boolean) as ClothingItem[];
  const r = resolve(req, ctx);
  const p = pools(available);

  // Anchors pin their slot.
  for (const a of anchors) {
    const role = roleOf(a);
    p[role] = [a];
    if (role === "one-piece") { p.top = []; p.bottom = []; }
    if (role === "top" || role === "bottom") p["one-piece"] = [];
  }

  type Base = { items: ClothingItem[]; score: number };
  const bases: Base[] = [];
  for (const d of p["one-piece"]) bases.push({ items: [d], score: 0 });
  for (const t of p.top) for (const b of p.bottom) bases.push({ items: [t, b], score: 0 });

  if (bases.length === 0) {
    return {
      outfits: [],
      notice:
        anchors.length
          ? "There aren't enough other pieces to style around that item yet. Add a matching top, bottom or shoes."
          : "To build an outfit, add at least one top and one bottom — or a dress — to your closet.",
    };
  }

  for (const b of bases) b.score = scoreOutfit(b.items, req, ctx, r).total + (rand() - 0.5) * 0.5;
  bases.sort((a, b) => b.score - a.score);
  const shortlist = bases.slice(0, Math.max(count * 4, 12));

  const needsOuter = r.weather === "cold" || r.weather === "rainy";
  const anchorOuter = anchors.some((a) => roleOf(a) === "outer");

  const pickBest = (base: ClothingItem[], pool: ClothingItem[], jitter = 0.3) => {
    let best: ClothingItem | null = null;
    let bestScore = -Infinity;
    for (const c of pool) {
      if (base.includes(c)) continue;
      const s = scoreOutfit([...base, c], req, ctx, r).total + (rand() - 0.5) * jitter;
      if (s > bestScore) { bestScore = s; best = c; }
    }
    return { best, bestScore };
  };

  const candidates: { items: ClothingItem[]; scored: Scored }[] = [];
  for (const base of shortlist) {
    let items = [...base.items];
    if (p.shoes.length) items.push(pickBest(items, p.shoes).best!);
    if (p.outer.length) {
      const current = scoreOutfit(items, req, ctx, r).total;
      const { best, bestScore } = pickBest(items, p.outer);
      if (best && (needsOuter || anchorOuter || bestScore > current + 0.05)) items.push(best);
    }
    if (p.bag.length) {
      const current = scoreOutfit(items, req, ctx, r).total;
      const { best, bestScore } = pickBest(items, p.bag, 0.2);
      if (best && bestScore > current - 0.15) items.push(best);
    }
    const maxAcc = req.occasion === "party" || req.occasion === "dinner" ? 2 : 1;
    for (let k = 0; k < maxAcc && p.accessory.length; k++) {
      const current = scoreOutfit(items, req, ctx, r).total;
      const { best, bestScore } = pickBest(items, p.accessory, 0.2);
      if (best && bestScore > current + 0.02) items.push(best);
    }
    items = items.filter(Boolean);
    candidates.push({ items, scored: scoreOutfit(items, req, ctx, r) });
  }

  // Ensure anchors are present (e.g. anchored bag/accessory not chosen by the greedy step).
  for (const c of candidates) {
    for (const a of anchors) {
      if (!c.items.includes(a)) {
        const role = roleOf(a);
        if (role === "shoes" || role === "bag" || role === "outer") c.items = c.items.filter((i) => roleOf(i) !== role);
        c.items.push(a);
        c.scored = scoreOutfit(c.items, req, ctx, r);
      }
    }
  }

  // Diversity-aware selection (maximal marginal relevance).
  const avoid = new Set(ctx.avoidSignatures ?? []);
  const seen = new Set<string>();
  const chosen: typeof candidates = [];
  const pool = [...candidates];
  while (chosen.length < count && pool.length) {
    let bestIdx = -1, bestVal = -Infinity;
    pool.forEach((c, idx) => {
      const sig = signatureOf(c.items.map((i) => i.id));
      if (seen.has(sig)) return;
      const overlap = chosen.length ? Math.max(...chosen.map((x) => jaccard(x.items.map((i) => i.id), c.items.map((i) => i.id)))) : 0;
      const val = c.scored.total - overlap * 1.4 - (avoid.has(sig) ? 1.5 : 0);
      if (val > bestVal) { bestVal = val; bestIdx = idx; }
    });
    if (bestIdx < 0) break;
    const [c] = pool.splice(bestIdx, 1);
    const sig = signatureOf(c.items.map((i) => i.id));
    seen.add(sig);
    chosen.push(c);
  }

  const outfits = chosen.map(({ items, scored }) => {
    const ordered = orderItems(items);
    const reasons = [...scored.reasons].sort((a, b) => b.weight - a.weight).map((x) => x.text);
    const anchorNote = anchors.length ? [`Built around your ${anchors.map((a) => a.name.toLowerCase()).join(" and ")}.`] : [];
    const unique = [...new Set([...anchorNote, ...reasons])];
    return {
      itemIds: ordered.map((i) => i.id),
      name: nameOutfit(ordered, req),
      explanation: unique.slice(0, 3).join(" ") || "A balanced combination of pieces from your closet.",
      reasons: unique,
      score: Math.round(scored.total * 100) / 100,
      signature: signatureOf(ordered.map((i) => i.id)),
    };
  });

  let notice: string | undefined;
  if (outfits.length < count) notice = `Your closet supports ${outfits.length} distinct combination${outfits.length === 1 ? "" : "s"} for these settings. Add more pieces for more variety.`;
  else if (!p.shoes.length) notice = "Add shoes to your closet to complete these looks.";
  return { outfits, notice };
}

const ROLE_ORDER: Role[] = ["outer", "top", "one-piece", "bottom", "shoes", "bag", "accessory"];
export function orderItems(items: ClothingItem[]) {
  return [...items].sort((a, b) => ROLE_ORDER.indexOf(roleOf(a)) - ROLE_ORDER.indexOf(roleOf(b)));
}

/** Rank closet items that could replace the piece in `role` within an outfit. */
export function alternativesFor(
  closet: ClothingItem[],
  outfitItemIds: string[],
  role: Role,
  req: StyleRequest,
  ctx: StylistContext = {},
  limit = 6,
) {
  const current = outfitItemIds.map((id) => closet.find((i) => i.id === id)).filter(Boolean) as ClothingItem[];
  const rest = current.filter((i) => roleOf(i) !== role && !(role === "one-piece" && (roleOf(i) === "top" || roleOf(i) === "bottom")));
  const exclude = new Set([...(req.excludeItemIds ?? []), ...outfitItemIds]);
  const r = resolve(req, ctx);
  return closet
    .filter((i) => !i.archived && !exclude.has(i.id) && roleOf(i) === role)
    .map((i) => ({ item: i, score: scoreOutfit([...rest, i], req, ctx, r).total }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function explainOutfit(items: ClothingItem[], req: StyleRequest = {}, ctx: StylistContext = {}) {
  const s = scoreOutfit(items, req, ctx);
  return [...s.reasons].sort((a, b) => b.weight - a.weight).map((x) => x.text).slice(0, 3).join(" ");
}

export const STYLE_OPTIONS = STYLES.map((s) => ({ id: s.id, label: s.label }));

export function isWearable(items: ClothingItem[]) {
  const roles = items.map(roleOf);
  return roles.includes("one-piece") || (roles.includes("top") && roles.includes("bottom"));
}

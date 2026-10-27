// On-device garment analysis. Colours are genuinely measured from the cutout's pixels.
// Category and pattern are *estimates* from simple shape/texture statistics — they are always
// flagged with low confidence so the UI asks the user to confirm them.
import { dominantColors, namedPalette, type RGB } from "../color";
import { CATEGORIES, COLOR_BY_ID, STYLES, categoryLabel } from "../taxonomy";
import type { Category, Occasion, Pattern, StyleId } from "../types";
import type { Analysis } from "./schema";

export interface PixelData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const KEYWORDS: [RegExp, Category][] = [
  [/\b(tee|t-?shirt)\b/i, "t-shirt"],
  [/\btank|cami/i, "tank-top"],
  [/\bblouse/i, "blouse"],
  [/\bshirt/i, "shirt"],
  [/\bcardigan/i, "cardigan"],
  [/\b(knit|sweater|jumper|pullover)/i, "knitwear"],
  [/\b(hoodie|sweatshirt|crewneck)/i, "sweatshirt"],
  [/\bjeans?|denim\b/i, "jeans"],
  [/\bwide[- ]?leg/i, "wide-leg-trousers"],
  [/\b(trousers?|pants|chinos|slacks)/i, "trousers"],
  [/\bskirt/i, "skirt"],
  [/\bshorts/i, "shorts"],
  [/\bleggings/i, "leggings"],
  [/\bdress/i, "dress"],
  [/\bjumpsuit|overall/i, "jumpsuit"],
  [/\bblazer/i, "blazer"],
  [/\bleather[- ]?jacket|biker/i, "leather-jacket"],
  [/\btrench/i, "trench"],
  [/\b(coat|parka)/i, "coat"],
  [/\b(jacket|bomber)/i, "jacket"],
  [/\b(sneakers?|trainers?)/i, "sneakers"],
  [/\b(heels?|pumps?|stilettos?)/i, "heels"],
  [/\b(flats?|ballerinas?)/i, "flats"],
  [/\bloafers?/i, "loafers"],
  [/\bboots?/i, "boots"],
  [/\bsandals?/i, "sandals"],
  [/\btote/i, "tote"],
  [/\bcrossbody/i, "crossbody"],
  [/\bclutch/i, "clutch"],
  [/\bbackpack/i, "backpack"],
  [/\b(bag|handbag|purse)/i, "handbag"],
  [/\bbelt/i, "belt"],
  [/\bscarf/i, "scarf"],
  [/\b(necklace|earrings?|bracelet|ring|jewel)/i, "jewelry"],
  [/\b(hat|cap|beanie)/i, "hat"],
  [/\bsunglasses/i, "sunglasses"],
];

export function categoryFromText(text: string): Category | null {
  const t = text.replace(/[_.]/g, " ");
  for (const [re, cat] of KEYWORDS) if (re.test(t)) return cat;
  return null;
}

interface Shape {
  aspect: number;
  fill: number;
  widths: (at: number) => number;
  legGap: boolean;
  topFill: number;
  bottomFill: number;
}

function analyseShape(px: PixelData): Shape | null {
  const { data, width, height } = px;
  const opaque = (x: number, y: number) => data[(y * width + x) * 4 + 3] > 96;
  let minX = width, minY = height, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (opaque(x, y)) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const rowWidth = (frac: number) => {
    const y = Math.min(maxY, Math.max(minY, Math.round(minY + frac * (bh - 1))));
    let l = -1, r = -1;
    for (let x = minX; x <= maxX; x++) if (opaque(x, y)) { if (l < 0) l = x; r = x; }
    return l < 0 ? 0 : (r - l + 1) / bw;
  };
  // Leg gap: in the lower part, rows have a transparent run *between* fabric on the left and right,
  // somewhere in the middle band of the silhouette (trousers/shorts). Tops and dresses don't.
  let gapRows = 0, rows = 0;
  const midL = minX + Math.round(bw * 0.3), midR = minX + Math.round(bw * 0.7);
  for (let y = Math.round(minY + bh * 0.65); y <= maxY - Math.round(bh * 0.05); y++) {
    rows++;
    let l = -1, r = -1;
    for (let x = minX; x <= maxX; x++) if (opaque(x, y)) { if (l < 0) l = x; r = x; }
    if (l < 0) continue;
    let hole = false;
    for (let x = Math.max(l + 1, midL); x <= Math.min(r - 1, midR); x++) if (!opaque(x, y)) { hole = true; break; }
    if (hole) gapRows++;
  }
  const regionFill = (y0: number, y1: number) => {
    let c = 0, t = 0;
    for (let y = Math.round(minY + bh * y0); y < Math.round(minY + bh * y1); y++)
      for (let x = minX; x <= maxX; x++) { t++; if (opaque(x, y)) c++; }
    return t ? c / t : 0;
  };
  return {
    aspect: bh / bw,
    fill: count / (bw * bh),
    widths: rowWidth,
    legGap: rows > 0 && gapRows / rows > 0.55,
    topFill: regionFill(0, 0.25),
    bottomFill: regionFill(0.6, 1),
  };
}

function guessCategory(shape: Shape | null, colors: string[]): { category: Category; confidence: number } {
  if (!shape) return { category: "other", confidence: 0.1 };
  const { aspect, legGap } = shape;
  const w15 = shape.widths(0.15), w20 = shape.widths(0.2), w30 = shape.widths(0.3), w60 = shape.widths(0.6), w85 = shape.widths(0.85);
  if (legGap) {
    if (aspect < 1.25) return { category: "shorts", confidence: 0.4 };
    const blueish = colors.some((c) => ["denim", "light-blue", "blue", "navy"].includes(c));
    if (blueish) return { category: "jeans", confidence: 0.45 };
    if (w85 > 0.9 * w15) return { category: "wide-leg-trousers", confidence: 0.35 };
    return { category: "trousers", confidence: 0.4 };
  }
  if (aspect < 0.7) {
    if (shape.topFill < 0.35 && shape.bottomFill > 0.65) return { category: "handbag", confidence: 0.3 };
    return { category: "sneakers", confidence: 0.2 };
  }
  if (shape.topFill < 0.3 && shape.bottomFill > 0.7 && aspect < 1.2) return { category: "handbag", confidence: 0.3 };
  const sleeves = w20 > w60 * 1.18;
  if (aspect > 1.55 && !sleeves && w85 > w30 * 1.15) return { category: "dress", confidence: 0.35 };
  if (aspect >= 0.8 && aspect <= 1.45 && !sleeves && w85 > w15 * 1.2) return { category: "skirt", confidence: 0.3 };
  if (sleeves && aspect > 1.45) return { category: "coat", confidence: 0.25 };
  if (sleeves) return { category: "t-shirt", confidence: 0.35 };
  return { category: "t-shirt", confidence: 0.15 };
}

function guessPattern(px: PixelData, namedCount: number, category: Category): { pattern: Pattern; confidence: number } {
  const { data, width, height } = px;
  const lum = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  const inside = (x: number, y: number) => data[(y * width + x) * 4 + 3] > 200;
  let gx = 0, gy = 0, n = 0;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      if (!inside(x, y) || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) continue;
      gx += Math.abs(lum(x + 1, y) - lum(x - 1, y));
      gy += Math.abs(lum(x, y + 1) - lum(x, y - 1));
      n++;
    }
  if (!n) return { pattern: "solid", confidence: 0.2 };
  gx /= n; gy /= n;
  const energy = (gx + gy) / 2;
  if (category === "jeans") return { pattern: "denim", confidence: 0.5 };
  if (energy < 7) return { pattern: "solid", confidence: 0.6 };
  const ratio = Math.max(gx, gy) / Math.max(1, Math.min(gx, gy));
  if (ratio > 2 && energy > 10) return { pattern: "striped", confidence: 0.35 };
  if (energy < 14 && namedCount <= 2) return { pattern: "textured", confidence: 0.3 };
  return { pattern: "abstract", confidence: 0.2 };
}

export function defaultOccasions(formality: number): Occasion[] {
  if (formality <= 1) return ["everyday", "weekend", "travel"];
  if (formality === 2) return ["everyday", "weekend", "university", "travel"];
  if (formality === 3) return ["everyday", "work", "date", "dinner"];
  return ["work", "dinner", "party", "formal"];
}

export function suggestStyles(category: Category, colors: string[], pattern: Pattern): StyleId[] {
  return STYLES.map((s) => ({
    id: s.id,
    score:
      (s.categories.includes(category) ? 2 : 0) +
      colors.slice(0, 2).filter((c) => s.colors.includes(c)).length +
      (s.patterns.includes(pattern) ? 0.5 : 0),
  }))
    .filter((s) => s.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((s) => s.id);
}

export function itemName(category: Category, colors: string[]) {
  const color = COLOR_BY_ID[colors[0]]?.label;
  const label = categoryLabel(category);
  return color ? `${color} ${label.toLowerCase()}` : label;
}

/** Analyse a cutout (RGBA with transparent background) entirely on-device. */
export function analyseLocally(px: PixelData, filename = ""): Analysis {
  const samples: RGB[] = [];
  const { data } = px;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) samples.push([data[i], data[i + 1], data[i + 2]]);
  const clusters = dominantColors(samples.length > 6000 ? samples.filter((_, i) => i % Math.ceil(samples.length / 6000) === 0) : samples, 4);
  const named = namedPalette(clusters, 0.1).slice(0, 3);
  const colors = named.map((n) => n.id);
  const colorHex = named.map((n) => n.hex);

  const fromName = categoryFromText(filename);
  const shapeGuess = guessCategory(analyseShape(px), colors);
  const category = fromName ?? shapeGuess.category;
  const catConfidence = fromName ? 0.55 : shapeGuess.confidence;
  const { pattern, confidence: patConfidence } = guessPattern(px, named.length, category);
  const info = CATEGORIES[category];
  const colorConfidence = named.length ? Math.max(0.3, Math.min(0.8, 0.85 - named[0].distance / 60)) : 0.1;

  return {
    category,
    name: itemName(category, colors),
    colors,
    colorHex,
    pattern,
    styles: suggestStyles(category, colors, pattern),
    seasons: info.seasons,
    occasions: defaultOccasions(info.formality),
    formality: info.formality,
    confidence: {
      category: catConfidence,
      colors: Number(colorConfidence.toFixed(2)),
      pattern: patConfidence,
      seasons: 0.3,
      occasions: 0.3,
      formality: 0.3,
      styles: 0.2,
    },
    source: "on-device",
    notes: fromName
      ? "Category taken from the file name; colours measured from the photo."
      : "Colours are measured from the photo. Category is a rough shape-based guess — please confirm it.",
  };
}

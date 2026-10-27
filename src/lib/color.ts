// Colour science helpers: sRGB <-> CIELAB, perceptual distance, dominant-colour extraction
// and mapping measured colours onto the fashion colour vocabulary.
import { COLORS, COLOR_BY_ID, type NamedColor } from "./taxonomy";

export type RGB = [number, number, number];
export type LAB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

function srgbToLinear(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function rgbToLab([r, g, b]: RGB): LAB {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  // D65
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE(a: LAB, b: LAB) {
  // CIE76 is adequate for vocabulary mapping and much cheaper than CIEDE2000.
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function chroma(lab: LAB) {
  return Math.hypot(lab[1], lab[2]);
}

/** Hue angle in degrees (0..360) of a LAB colour. */
export function hueAngle(lab: LAB) {
  const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

export function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const PALETTE_LAB = COLORS.map((c) => ({ color: c, lab: rgbToLab(hexToRgb(c.hex)) }));

export function nearestNamedColor(rgb: RGB): { color: NamedColor; distance: number } {
  const lab = rgbToLab(rgb);
  let best = PALETTE_LAB[0];
  let bestD = Infinity;
  for (const p of PALETTE_LAB) {
    // Metallics only when the match is very close — a grey-white cotton shirt isn't "silver".
    const metallicPenalty = p.color.id === "silver" || p.color.id === "gold" ? 6 : 0;
    const d = deltaE(lab, p.lab) + metallicPenalty;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return { color: best.color, distance: bestD };
}

export interface ColorCluster {
  rgb: RGB;
  hex: string;
  weight: number;
}

/**
 * k-means in LAB space over pixel samples. Deterministic (k-means++ seeded with a fixed LCG)
 * so the same image always yields the same palette.
 */
export function dominantColors(samples: RGB[], k = 4, iterations = 12): ColorCluster[] {
  if (samples.length === 0) return [];
  const labs = samples.map(rgbToLab);
  k = Math.min(k, labs.length);
  let seed = 1234567;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const centers: LAB[] = [labs[Math.floor(rand() * labs.length)]];
  while (centers.length < k) {
    const d = labs.map((l) => Math.min(...centers.map((c) => deltaE(l, c) ** 2)));
    const total = d.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    let r = rand() * total;
    let idx = 0;
    while (r > d[idx] && idx < d.length - 1) r -= d[idx++];
    centers.push(labs[idx]);
  }
  const assign = new Array(labs.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < labs.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dd = deltaE(labs[i], centers[c]);
        if (dd < bd) { bd = dd; best = c; }
      }
      assign[i] = best;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < labs.length; i++) {
      const s = sums[assign[i]];
      s[0] += labs[i][0]; s[1] += labs[i][1]; s[2] += labs[i][2]; s[3]++;
    }
    sums.forEach((s, c) => { if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  // Average in RGB per cluster for an exact display swatch.
  const acc = centers.map(() => [0, 0, 0, 0]);
  samples.forEach((p, i) => {
    const a = acc[assign[i]];
    a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++;
  });
  return acc
    .filter((a) => a[3] > 0)
    .map((a) => {
      const rgb: RGB = [a[0] / a[3], a[1] / a[3], a[2] / a[3]];
      return { rgb, hex: rgbToHex(rgb), weight: a[3] / samples.length };
    })
    .sort((x, y) => y.weight - x.weight);
}

/** Collapse clusters into distinct named colours (merging clusters that map to the same name). */
export function namedPalette(clusters: ColorCluster[], minWeight = 0.08) {
  const out: { id: string; hex: string; weight: number; distance: number }[] = [];
  for (const c of clusters) {
    const { color, distance } = nearestNamedColor(c.rgb);
    const existing = out.find((o) => o.id === color.id);
    if (existing) existing.weight += c.weight;
    else out.push({ id: color.id, hex: c.hex, weight: c.weight, distance });
  }
  return out.filter((o) => o.weight >= minWeight).sort((a, b) => b.weight - a.weight);
}

export function isNeutral(colorId: string) {
  return COLOR_BY_ID[colorId]?.neutral ?? false;
}

export function colorLab(colorIdOrHex: string): LAB {
  const hex = colorIdOrHex.startsWith("#") ? colorIdOrHex : COLOR_BY_ID[colorIdOrHex]?.hex ?? "#888888";
  return rgbToLab(hexToRgb(hex));
}

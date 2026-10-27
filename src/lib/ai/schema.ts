// Schemas shared between the browser and the server AI routes.
import { z } from "zod";
import { CATEGORY_IDS, COLORS, PATTERNS, SEASONS, OCCASIONS, STYLES, FITS } from "../taxonomy";
import type { AiMeta, AiSource, Category, Fit, Occasion, Pattern, Season, StyleId } from "../types";

const colorIds = COLORS.map((c) => c.id) as [string, ...string[]];

export const GarmentAnalysisSchema = z.object({
  isClothing: z.boolean().describe("False if the photo does not show a garment, shoe, bag or accessory."),
  category: z.enum(CATEGORY_IDS as [Category, ...Category[]]),
  name: z.string().describe("Short, natural garment name, e.g. 'Navy wool blazer'. No brand guesses."),
  colors: z.array(z.enum(colorIds)).describe("1-3 colour ids, dominant first."),
  pattern: z.enum(PATTERNS.map((p) => p.id) as [Pattern, ...Pattern[]]),
  material: z.string().nullable().describe("Only if visually identifiable (e.g. denim, knit, leather); otherwise null."),
  fit: z.enum(FITS.map((f) => f.id) as [Fit, ...Fit[]]).nullable(),
  styles: z.array(z.enum(STYLES.map((s) => s.id) as [StyleId, ...StyleId[]])).describe("0-3 aesthetics this piece suits."),
  seasons: z.array(z.enum(SEASONS.map((s) => s.id) as [Season, ...Season[]])),
  occasions: z.array(z.enum(OCCASIONS.map((o) => o.id) as [Occasion, ...Occasion[]])),
  formality: z.number().describe("1 (very casual) to 5 (formal)."),
  confidence: z.object({
    category: z.number().describe("0-1"),
    colors: z.number().describe("0-1"),
    pattern: z.number().describe("0-1"),
    material: z.number().describe("0-1"),
  }),
  notes: z.string().nullable().describe("Anything uncertain the user should double-check, or null."),
});
export type GarmentAnalysis = z.infer<typeof GarmentAnalysisSchema>;

export const StylistOutputSchema = z.object({
  outfits: z.array(
    z.object({
      name: z.string().describe("Evocative 2-5 word outfit name."),
      itemIds: z.array(z.string()).describe("Ids copied exactly from the closet list."),
      explanation: z.string().describe("1-3 sentences on why the combination works (colour, proportion, texture, occasion)."),
    }),
  ),
});
export type StylistOutput = z.infer<typeof StylistOutputSchema>;

/** Result of analysing a garment, regardless of which engine produced it. */
export interface Analysis {
  category: Category;
  name: string;
  colors: string[];
  colorHex: string[];
  pattern: Pattern;
  material?: string;
  fit?: Fit;
  styles: StyleId[];
  seasons: Season[];
  occasions: Occasion[];
  formality: number;
  confidence: AiMeta["confidence"];
  source: AiSource;
  notes?: string;
}

export interface AiStatus {
  provider: "claude" | "gemini" | null;
  model: string | null;
  bgServer: boolean;
  authRequired: boolean;
}

/** Compact closet entry sent to the stylist model (no images, no personal data). */
export interface CompactItem {
  id: string;
  name: string;
  category: Category;
  colors: string[];
  pattern: Pattern;
  fit?: Fit;
  formality: number;
  seasons: Season[];
  styles: StyleId[];
  wearCount: number;
}

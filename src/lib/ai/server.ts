// Server-only AI integration. API keys are read from the environment and never reach the browser.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { GarmentAnalysisSchema, StylistOutputSchema, type AiStatus, type GarmentAnalysis, type StylistOutput } from "./schema";

export type Provider = "claude" | "gemini";

export function activeProvider(): { provider: Provider; model: string } | null {
  const pref = process.env.AI_PROVIDER?.toLowerCase();
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const claude = { provider: "claude" as const, model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5" };
  const gemini = { provider: "gemini" as const, model: process.env.GEMINI_MODEL || "gemini-2.5-flash" };
  if (pref === "none" || pref === "off") return null;
  if (pref === "gemini" && hasGemini) return gemini;
  if (pref === "claude" && hasClaude) return claude;
  if (hasClaude) return claude;
  if (hasGemini) return gemini;
  return null;
}

export function supabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function aiStatus(): AiStatus {
  const p = activeProvider();
  return { provider: p?.provider ?? null, model: p?.model ?? null, bgServer: !!process.env.REMOVE_BG_API_KEY, authRequired: supabaseConfigured() };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * When Supabase is configured, AI routes require a signed-in user (verified server-side).
 * In demo deployments (no Supabase) they are rate limited per client IP instead.
 */
export async function authorize(req: Request, bucket: string, limitPerHour: number) {
  if (supabaseConfigured()) {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) throw new HttpError(401, "Please sign in to use AI features.");
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) throw new HttpError(401, "Your session has expired. Please sign in again.");
    rateLimit(`${bucket}:${data.user.id}`, limitPerHour);
    return data.user.id;
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  rateLimit(`${bucket}:${ip}`, limitPerHour);
  return null;
}

const HOUR_MS = 3_600_000;
const hits = new Map<string, number[]>();
let sweptAt = 0;

/** Drop keys whose last call has aged out, so the map does not grow for the life of the process. */
function sweep(now: number) {
  if (now - sweptAt < HOUR_MS) return;
  sweptAt = now;
  for (const [key, times] of hits) if (!times.length || now - times[times.length - 1] >= HOUR_MS) hits.delete(key);
}

/** Best-effort in-memory limiter (per server instance). Use a shared store for multi-instance deployments. */
export function rateLimit(key: string, limitPerHour: number) {
  const now = Date.now();
  sweep(now);
  const recent = (hits.get(key) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= limitPerHour) throw new HttpError(429, "You've reached the hourly AI limit. Try again later — the on-device stylist still works.");
  recent.push(now);
  hits.set(key, recent);
}

let anthropic: Anthropic | null = null;
function claudeClient() {
  anthropic ??= new Anthropic({ timeout: 60_000, maxRetries: 2 });
  return anthropic;
}

function mapAnthropicError(e: unknown): never {
  if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "The AI provider is rate limiting requests. Please try again shortly.");
  if (e instanceof Anthropic.AuthenticationError) throw new HttpError(503, "The AI provider rejected the API key. Check ANTHROPIC_API_KEY.");
  if (e instanceof Anthropic.BadRequestError) throw new HttpError(422, "The AI provider could not process this request.");
  if (e instanceof Anthropic.APIConnectionTimeoutError) throw new HttpError(504, "The AI provider timed out.");
  if (e instanceof Anthropic.APIConnectionError) throw new HttpError(502, "Could not reach the AI provider.");
  if (e instanceof Anthropic.APIError) throw new HttpError(502, `AI provider error (${e.status ?? "unknown"}).`);
  throw e;
}

async function claudeStructured<T extends z.ZodType>(
  schema: T,
  system: string,
  content: Anthropic.Beta.BetaContentBlockParam[],
  model: string,
  effort: "low" | "medium",
  maxTokens: number,
): Promise<z.infer<T>> {
  try {
    const res = await claudeClient().beta.messages.parse({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (res.stop_reason === "refusal") throw new HttpError(422, "The AI provider declined this request.");
    if (res.stop_reason === "max_tokens") throw new HttpError(502, "The AI response was cut off. Please try again.");
    if (!res.parsed_output) throw new HttpError(502, "The AI returned an unexpected response.");
    return res.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    mapAnthropicError(e);
  }
}

async function geminiJson<T extends z.ZodType>(schema: T, system: string, parts: object[], model: string): Promise<z.infer<T>> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema), temperature: 0.4 },
      }),
    });
  } catch {
    throw new HttpError(502, "Could not reach the AI provider.");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 429) throw new HttpError(429, "The free Gemini quota is exhausted for now. Please try again later.");
  if (res.status === 401 || res.status === 403) throw new HttpError(503, "The AI provider rejected the API key. Check GEMINI_API_KEY.");
  if (!res.ok) throw new HttpError(502, `AI provider error (${res.status}).`);
  const body = await res.json();
  const text: string | undefined = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new HttpError(502, "The AI returned an empty response.");
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new HttpError(502, "The AI returned an unexpected response.");
  return parsed.data;
}

const ANALYSIS_SYSTEM = `You are a meticulous fashion cataloguer for a personal wardrobe app.
You receive one photo of a single item the user owns (usually already cut out on white).
Describe ONLY what is visible. Never invent details, brands or materials you cannot see.
Pick the closest category and colour ids from the allowed lists. Use the dominant garment colour first; ignore background and small logos when choosing colours.
Use confidence values honestly: below 0.5 when the photo is ambiguous. Put anything the user should double-check in notes.`;

export async function analyseGarment(imageBase64: string, hint: string): Promise<GarmentAnalysis & { provider: Provider }> {
  const p = activeProvider();
  if (!p) throw new HttpError(503, "No cloud AI provider is configured.");
  const instruction = `Catalogue this item.${hint ? ` The user's file name or note says: "${hint.slice(0, 80)}" (may be meaningless).` : ""}`;
  const result =
    p.provider === "claude"
      ? await claudeStructured(
          GarmentAnalysisSchema,
          ANALYSIS_SYSTEM,
          [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
            { type: "text", text: instruction },
          ],
          p.model,
          "low",
          2048,
        )
      : await geminiJson(GarmentAnalysisSchema, ANALYSIS_SYSTEM, [{ inline_data: { mime_type: "image/jpeg", data: imageBase64 } }, { text: instruction }], p.model);
  return { ...result, provider: p.provider };
}

const STYLIST_SYSTEM = `You are an experienced personal stylist with a modern high-street and editorial eye.
You build complete outfits using ONLY items from the user's closet list. Every itemId you output must be copied exactly from that list.
Never invent, rename or substitute garments. If the closet cannot support a request, return fewer outfits.
Each outfit needs either (one top + one bottom) or one dress/jumpsuit, plus shoes when the closet has shoes. Add outerwear, a bag and at most two accessories only when they improve the look. An optional second top may be used only for layering (e.g. a knit over a shirt).
Consider colour harmony, proportion and silhouette, texture, layering, contrast, formality, occasion and season. Balance safe choices with at least one fresher, fashion-forward combination. Do not repeat combinations, and avoid the combinations listed as already seen.
Explanations are 1-3 concise, specific sentences referencing the actual pieces.`;

export async function styleOutfits(prompt: string): Promise<StylistOutput & { provider: Provider }> {
  const p = activeProvider();
  if (!p) throw new HttpError(503, "No cloud AI provider is configured.");
  const result =
    p.provider === "claude"
      ? await claudeStructured(StylistOutputSchema, STYLIST_SYSTEM, [{ type: "text", text: prompt }], p.model, "medium", 8000)
      : await geminiJson(StylistOutputSchema, STYLIST_SYSTEM, [{ text: prompt }], p.model);
  return { ...result, provider: p.provider };
}

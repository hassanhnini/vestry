# Vestry — your wardrobe, edited

Vestry is a free, mobile-first virtual wardrobe and AI stylist. You photograph the clothes you own, and Vestry cuts them out (background removal runs **on your device**), measures their colours and suggests their details. It then files them into a searchable closet and styles outfits from **only the pieces you actually own**.

It works without any account, API key or paid service. In that case it runs in **demo mode**: your data is stored in your browser, background removal and colour analysis happen on-device, and outfits come from the built-in rules stylist. You can also connect Supabase (accounts and sync) and an AI provider (Claude or Gemini) for smarter tagging and styling. Nothing in the UI pretends a service is working when it isn't configured.

---

## What works

| Area | Status |
| --- | --- |
| Welcome, onboarding style profile (skippable), demo mode | ✅ |
| Sign up / log in / log out / password reset / update password | ✅ with Supabase configured (demo mode otherwise) |
| Add clothes: camera, gallery, multi-select, drag & drop, crop/rotate | ✅ |
| **Real background removal** (ISNet model via ONNX Runtime WASM, self-hosted, on-device) | ✅ |
| Optional server background removal via remove.bg | ✅ when `REMOVE_BG_API_KEY` is set |
| Colour measurement (k-means in CIELAB, mapped to 31 fashion colours) | ✅ on-device |
| Category / pattern estimate on-device (shape + texture), clearly labelled as an estimate | ✅ |
| AI tagging (category, colours, pattern, material, fit, seasons, occasions, style, formality and confidence) | ✅ with Claude or Gemini configured, and opt-in per user |
| Review & correct every prediction before saving; confidence badges | ✅ |
| Duplicate-photo detection (SHA-256) and cut-out reuse (no reprocessing) | ✅ |
| Closet: category tabs, search, filters (colour, season, style, occasion, favourites, archived), sorting | ✅ |
| Item detail: edit, replace photo, redo background removal, favourite, archive, delete (safe cascade), "wore it today" | ✅ |
| **Stylist**: style, occasion (incl. custom), weather, palette, silhouette, dress code, comfort, anchor pieces, rarely-worn, exclusions | ✅ |
| On-device rules stylist (always available, also the fallback) | ✅ |
| AI stylist (Claude / Gemini) with **strict grounding** to your closet | ✅ when configured |
| Swap a piece (ranked alternatives), "More ideas" without repeats, explanations | ✅ |
| Saved outfits: favourite, rename, notes, edit pieces, delete, editorial board, **PNG collage export** from real cut-outs | ✅ |
| Weekly planner: plan days, events/trips (repeat across dates), mark worn, wear history with undo | ✅ |
| Insights: categories, colours, versatile pieces, unworn or unstyled pieces, new-combination prompts, optional gap ideas (off by default) | ✅ |
| Settings: storage mode, AI consent, model quality, export JSON, delete all data, delete account | ✅ |
| Loading, empty, error, retry, offline states; toasts; confirmation dialogs | ✅ |
| Accessibility: semantic landmarks, labels, focus-trapped dialogs, keyboard support, reduced motion, AA contrast tokens | ✅ |

### What is *not* included (by design or not yet)

- **No AI-generated try-on or editorial imagery.** Outfit visuals always use your real cut-outs. That avoids passing off generated garments as yours, and nothing depends on image generation.
- **No shopping integration.** "Wardrobe gap ideas" are optional text observations, hidden by default, with no links or products.
- The on-device category estimate is deliberately humble: it's a shape heuristic flagged "Rough estimate · please check". For reliable automatic categorisation, configure Claude or Gemini.
- The JSON export contains your records, not the image files. Images stay in IndexedDB (demo) or your private Supabase bucket (cloud).

---

## Quick start (demo mode, no keys needed)

Requirements: Node.js 20.9+ (tested on Node 22) and npm.

```bash
npm install          # also copies the on-device background-removal model into public/bg-models (~200 MB)
npm run dev          # http://localhost:3000
```

Open the app, tap **Start building my closet**, and add a few photos. The first photo downloads the background-removal model once (about 45–90 MB depending on the quality setting). After that it's cached by the browser. Processing takes a few seconds per photo on a modern phone or laptop.

> Demo data is stored in this browser's IndexedDB. It doesn't sync between devices and is lost if you clear site data. Use **Settings → Export my data** for a backup.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint (Next.js + React Compiler rules) |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | End-to-end journey in headless Chromium (Playwright). Starts `npm start` on port 3100 if nothing is running, so run `npm run build` first |
| `npm run check` | lint + typecheck + unit tests + build |

---

## Enabling cloud accounts (Supabase, free tier)

1. Create a project at [supabase.com](https://supabase.com) (the free plan is enough).
2. Apply the schema. Either:
   - **SQL editor**: paste and run `supabase/migrations/0001_init.sql`, or
   - **CLI**: `npx supabase link --project-ref <ref>` then `npx supabase db push`.

   This creates the tables (`profiles`, `clothing_items`, `outfits`, `outfit_items`, `planner_entries`, `wear_logs`), indexes, check constraints, `updated_at` triggers, a profile-on-signup trigger, **row-level security policies** on every table, and a **private** Storage bucket `wardrobe` with per-user folder policies. The migration is idempotent.
3. In **Authentication → URL Configuration**, set the Site URL to your app URL and add `<your-url>/auth/update-password` and `<your-url>/home` to Redirect URLs.
4. Copy `.env.example` to `.env.local` and set:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-only, used for "Delete account"
   ```
5. Restart the app. The welcome screen now offers sign-up and log-in, and data syncs across devices.

Images are uploaded to `wardrobe/<user-id>/<item-id>/…` and displayed through **signed URLs that expire after one hour**. Both the original (downscaled to 1600 px) and the cut-out are kept, so background removal can be redone at any time.

**Free-tier notes:** Supabase's free plan has database and storage quotas, and inactive free projects are paused (check [current limits](https://supabase.com/pricing)). Cut-outs are stored as WebP with alpha, at about 50–200 KB each, so a large closet fits comfortably.

---

## Enabling cloud AI (optional)

The AI is used for two things. Both are opt-in per user under **Settings → Cloud AI**, and both stay off unless a key is configured:

- **Tagging**: a ≤768 px JPEG preview of the *cut-out* is sent. The API returns schema-validated JSON (category, colours, pattern, material, fit, seasons, occasions, styles, formality and per-field confidence).
- **Stylist**: a text list of your closet is sent (name, category, colours, pattern, fit, formality, seasons, wear count; **no photos**). Item ids are replaced by short aliases (`i1`, `i2`…). The model's answer is mapped back and then **grounded twice**, on the server and again in the browser. Any outfit that references a garment you don't own is discarded, never "repaired". Incomplete outfits, duplicates and excluded items are rejected too, and any shortfall is filled by the on-device stylist and labelled as such.

Choose one provider:

| Provider | Env vars | Cost |
| --- | --- | --- |
| **Google Gemini** | `GEMINI_API_KEY`, optional `GEMINI_MODEL` (default `gemini-2.5-flash`) | Has a **free tier** with per-minute and per-day limits. Check Google's terms: free-tier inputs may be used to improve Google products. |
| **Anthropic Claude** | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` (default `claude-opus-5-5`; `claude-haiku-5-5` is far cheaper per photo) | Paid, pay-as-you-go. No free tier. Uses the official SDK with structured outputs and server-side refusal fallback (`fallbacks: "default"`). |

Set `AI_PROVIDER=gemini` or `AI_PROVIDER=claude` if both keys are present, or `AI_PROVIDER=none` to disable both. AI routes are rate-limited per user (cloud mode) or per IP (demo deployments) with `AI_ANALYZE_LIMIT_PER_HOUR` and `AI_STYLIST_LIMIT_PER_HOUR`. The limiter is in-memory and per server instance. When Supabase is configured, AI routes require a valid session token, verified server-side.

**No unlimited free AI is claimed.** If a provider quota is hit, users see a clear message and the on-device features keep working.

### Optional: remove.bg

`REMOVE_BG_API_KEY` enables a server background-removal option that users can pick in Settings. The free plan only includes a small number of preview-resolution credits per month. The on-device model remains the default.

---

## Deployment

No deployment credentials were available while building this, so **there is no live URL yet**. To deploy on Vercel (free Hobby plan):

1. Push this repository to GitHub.
2. In Vercel, choose **Add New → Project**, import the repo, and keep the framework preset **Next.js**.
3. Add any environment variables from `.env.example` (none are required for demo mode).
4. **Model hosting:** the self-hosted model adds ~200 MB of static files. If the build or upload exceeds your plan's limits, add these environment variables to serve the identical model files from the public CDN instead:
   ```
   SKIP_BG_MODELS=1
   NEXT_PUBLIC_BG_MODEL_URL=https://staticimgly.com/@imgly/background-removal-data/1.4.5/dist/
   ```
5. Deploy. If you use Supabase, add the production URL to Supabase's Site URL and Redirect URLs.

**Self-hosting** (any Node host or container): `npm ci && npm run build && npm start` (port 3000, or `-p <port>`). Serve over HTTPS so the camera and `crypto.subtle` work on phones.

---

## Architecture

```
src/
  app/                      Next.js App Router (all wardrobe pages are client components)
    page.tsx                Welcome
    onboarding/             Optional style-profile setup
    auth/                   login · signup · reset · update-password
    (app)/                  Signed-in area behind a guard: home, closet, closet/[id], add,
                            stylist, outfits, outfits/[id], planner, profile, insights, settings
    api/ai/{status,analyze,stylist}   Server AI routes (keys never reach the browser)
    api/bg/remove           Optional remove.bg proxy
    api/account/delete      Deletes auth user + storage (service role, server-only)
  lib/
    types.ts, taxonomy.ts   Domain model: 37 categories, 31 colours, 12 aesthetics, occasions…
    color.ts                sRGB→CIELAB, ΔE, deterministic k-means, colour naming
    image/pipeline.ts       validate → normalise (EXIF, crop/rotate, 1600 px JPEG) → background
                            removal → trim/pad → WebP-with-alpha; timeouts and typed errors
    image/use-upload-queue  Sequential bulk processing, retry, keep-original fallback, dedupe
    ai/local-analyze.ts     On-device colour, pattern and shape analysis (honest confidences)
    ai/server.ts            Claude (official SDK) and Gemini (REST) providers, auth, rate limits
    stylist/engine.ts       Rules stylist: colour harmony, pattern balance, formality, season
                            and warmth, aesthetics, proportion, comfort, profile, novelty;
                            diversity-aware (MMR) selection; explanations; swap alternatives
    stylist/grounding.ts    Rejects any model outfit that isn't wearable from the real closet
    stylist/prompt.ts       Alias-based prompt builder
    data/repo.ts            Storage interface
    data/local-repo.ts      Demo mode: IndexedDB (records + image blobs)
    data/supabase-repo.ts   Cloud mode: Postgres + private Storage with signed URLs
    store.tsx, auth.tsx     React state, actions and safe cascades
supabase/migrations/        SQL schema + RLS + storage policies
tests/                      Vitest unit and integration tests
e2e/                        Playwright journey + fixture photos
```

Switching from demo mode to Supabase needs no code changes. The UI only talks to the `Repo` interface.

### Background removal and licensing

On-device background removal uses [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) 1.4.5. That is an ISNet segmentation model running on ONNX Runtime Web, and its model files are copied from `@imgly/background-removal-data` into `public/bg-models` by `npm install`. These packages are licensed under **AGPL-3.0**. If you deploy Vestry publicly, publish your source code (including modifications) under a compatible licence, or replace the provider. The pipeline is modular: `removeBackground()` in `src/lib/image/pipeline.ts` is the only integration point.

---

## Privacy and security

- Secrets are read only on the server. Only `NEXT_PUBLIC_SUPABASE_*` and the optional model URL reach the browser.
- Every table has row-level security (`user_id = auth.uid()`). `outfit_items` and `planner_entries` additionally check that the referenced outfit and items belong to the user. Storage is private and per-user-folder.
- All API inputs are validated with Zod, and free text sent to models is length-capped and newline-stripped.
- Server logs never include request bodies or images.
- The app never infers personal characteristics from photos and never asks for body photos or measurements.
- Users can export their data, delete all wardrobe data, or delete their account.
- Security headers include `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, and a camera-only permissions policy.

---

## Testing

What runs in this repository:

- **Vitest (37 tests)**: stylist engine (closet-only output, completeness, diversity, exclusions, anchors, cold-weather layering, dress codes, clash penalties, avoided colours, swaps), grounding (fabricated ids, incomplete and duplicate outfits, anchors, archived items), colour science, on-device analysis (leg gap, sleeves, stripes, filename hints), closet filters, insights, and API routes (honest 503 without keys, validation, rate limiting, a mocked Gemini response with alias mapping, quota errors, prompt-injection hygiene).
- **Playwright (2 tests, mobile Chromium)**: the full journey. It enters demo mode, rejects an invalid file, bulk-uploads 5 photos, and checks they're processed **one at a time** by the **real** model and that the cut-outs have genuine transparency. It then corrects predictions, saves, verifies persistence across reloads, generates outfits and checks every piece exists in the closet, saves an outfit and checks it persists, plans it for today, edits and deletes an item, and checks the offline banner. A second test checks the empty states.
- The SQL migration was applied twice (idempotency) to PostgreSQL with stubbed `auth` and `storage` schemas. Cross-user reads and writes were blocked by RLS, check constraints rejected bad data, and cascades worked.

Not verified here: live calls to Supabase, Claude, Gemini or remove.bg, because no credentials were available. Those paths are type-checked, and the Gemini path is tested with a mocked HTTP response.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Background removal took too long" on first use | The model download (45–90 MB) needs a connection. Retry, or choose **Settings → Cut-out quality → Fast**. |
| Cut-out misses parts of the garment | Use a plain, contrasting background with the whole item in frame. Then **Crop / rotate**, or keep the original photo. |
| iPhone HEIC photo won't open | Most browsers can't decode HEIC. Set **Camera → Formats → Most Compatible**, or share the photo as JPEG. |
| `public/bg-models` missing or 404s for model files | Run `node scripts/copy-bg-models.mjs`, or set `NEXT_PUBLIC_BG_MODEL_URL` (see Deployment). |
| AI stylist says "not configured" | Set `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` on the server and restart. Users also need to turn on **Settings → Cloud AI**. |
| 401 from AI routes in cloud mode | The session expired. Log in again. |
| Password-reset link lands on a broken page | Add `<your-url>/auth/update-password` to Supabase redirect URLs. |
| Demo closet disappeared | Browser site data was cleared, or you're in a private window or another browser. Demo data is per browser. |
| `npm run test:e2e` can't find a browser | Run `npx playwright install chromium` (version-matched to `@playwright/test`). |

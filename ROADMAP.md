# 🗺️ ResumeForge - Roadmap

This document tracks **what has been built** and **what is planned** across the product's phased passes. The guiding principle: each pass is independently shippable and adds a coherent slice of value. We front-loaded the "edit → score → fix" loop, then deterministic depth (free, no API cost), and defer the backend, AI, and export-hardening work to later passes.

**Legend:** ✅ done · 🔜 planned · 💭 needs a product/infra decision before starting

_Last verified: 2026-09-08 · Pass 2.5 + Jobs Forge Phase 0 shipped · 323 tests, typecheck, lint and production build all green._

### Phase mapping

The passes below are the product story. They map onto the execution ladder used across all of
Kartikeya's repos, so "Phase 2" means the same thing everywhere:

| Phase | Meaning | Where it lives here |
|---|---|---|
| **P0** stop the bleeding | unpushed work, leaks, diverged clones | **nothing pending** - clean and in sync |
| **P1** safety net | tests + CI | ✅ **Pass 2.5** - done |
| **P2** truth in docs | stale claims, dead routes | ✅ **Pass 2.5** - done |
| **P3** polish | a11y, SEO, error handling, perf | ✅ **Pass 2.5** - done except perf |
| **P4** features | product work, no outside dependency | Pass 3-local, Pass 5 |
| **P5** decision-gated | needs a provider/key/budget call | Pass 3-cloud, Pass 4-AI |

**Execution order recommendation:** Pass 2.5 is complete and Jobs Forge Phase 0 has shipped, so
**Pass 3-local is next.** The deterministic core now has 323 tests and CI behind it, which is what
the later passes needed in order to change scoring safely.

---

## Product vision

A simplified, resume-only editor (think "Google Docs for resumes") with a live pageless preview, plus a **feedback engine** that scores the resume for ATS-compatibility and against a specific job description, and tells the user exactly what to fix. Target users: college students and experienced folks in software engineering, product management, and MBA (sales/marketing) roles. Output is clean black & white - not for creative fields.

**Confirmed constraints**
- Deterministic-first: scoring and keyword logic are rule-based (no LLM) in early passes; AI is a dedicated later pass.
- Local-first: no login/backend in the early passes; accounts + database arrive in Pass 3.
- Each pass is approved before work begins.

---

## ✅ Done

### Pass 0 - Foundation
- ✅ Next.js 16 (App Router) + TypeScript + Tailwind v4 + Zustand scaffold.
- ✅ Structured `Resume` JSON schema as the single source of truth.
- ✅ Zustand store with `localStorage` autosave.
- ✅ Three-pane responsive shell (editor · preview · insights) + print stylesheet.
- ✅ Deployed to Vercel with auto-deploy on push.

### Pass 1 - Viable product (the core loop)
- ✅ Start fresh **or** import a PDF (pdf.js extraction → heuristic section parse).
- ✅ **Image-only / scanned PDF rejection** with a clear error message.
- ✅ Structured editor for all core sections with add / remove / reorder.
- ✅ Live **pageless, seamless black & white preview**.
- ✅ **Export PDF** (print-to-PDF, selectable text) and **Export DOCX** (client-side).
- ✅ **Job-description input** → deterministic keyword extraction → keyword chips.
- ✅ **Live keyword present/missing indicators** with synonym matching.
- ✅ **ATS score + JD-match score** with an explainable 5-part breakdown.
- ✅ **Actionables checklist** (ATS rules + JD gaps); completed items struck-through.

### Pass 2 - Deterministic intelligence
- ✅ **Health Dashboard**: ATS compatibility, impact, recruiter readability, formatting, keyword match.
- ✅ **Bullet analyzers**: weak-verb, missing-number, passive-voice, repetition, and STAR/impact heuristics - each with a suggestion.
- ✅ **Analysis heatmap overlay** on the preview (per-bullet green/amber/red), stripped from exports.
- ✅ **Analytics**: words, bullets, avg/longest bullet, quantified ratio, action verbs, passive count, readability grade, recruiter skim-time.
- ✅ **Structure checks**: missing/thin sections, timeline gaps, length balance, content balance, section-ordering suggestions.
- ✅ **Enhanced JD analyzer**: technical vs. soft split, skill-gap list, tiered coverage (critical/important/optional), local synonym/semantic matching.

### Extras added on request (during Pass 2)
- ✅ **Save / Open**: portable, versioned `.resume.json` snapshots (resume + JD) with validation and graceful rejection of foreign files.
- ✅ **Sample resumes dropdown**: 6 role-specific starters (APM, PM, SPM, Marketing MBA, Sales MBA, Sr. Sales Manager), with a confirm guard before replacing current work.
- ✅ **Dark mode**: persisted toggle; all app chrome darkens while the resume paper stays white.
- ✅ **Inline bold formatting**: WhatsApp-style `*asterisks*` render bold in the preview and in both PDF and DOCX exports.
- ✅ **Top-bar redesign**: crowded button row consolidated into grouped **File** and **Export** menus, with the Resumes and Versions menus kept prominent and compact analysis/theme toggles on the right.
- ✅ **Brand logo / favicon**: a turned-page mark used in the header and as the app icon (so Vercel shows a logo in the project listing); also saved as `logo.svg` at the repo root.

### Pass 3-lite - local library & versioning (no backend)
The parts of the master-resume differentiator that work entirely client-side, delivered without a database or accounts.
- ✅ **Resume library**: maintain multiple named resumes; switch / create / duplicate / rename / delete.
- ✅ **Master resume + "New from Master"**: mark one resume as the source and spin up tailored copies from it.
- ✅ **Version history**: per-resume snapshots with restore, plus a deterministic **diff** (added / removed content) against the current draft.
- ✅ **Application status** per resume (Draft / Applied / Interview / Offer / Rejected) - a lightweight application tracker.
- ⚠️ Everything is stored in the browser (`localStorage`) - single-device and clearable; the `.resume.json` Save file is the backup. Cloud durability, sync, and login remain a Pass 3 (backend) concern.

### Pass 2.5 - quality baseline (P1 · P2 · P3)
The scores are the product's central claim, and until this pass nothing verified them. No new
features here - this is the safety net every later pass builds on.

**Testing (P1)** - was: no runner, no tests, no CI.
- ✅ **Vitest wired up** (`vitest.config.ts`), with `test`, `test:watch`, `test:coverage` and `typecheck` scripts.
- ✅ **123 tests across 7 suites**, all over the deterministic core:
  - `scoring.test.ts` (22) - score bounds, the fixed 5-row breakdown, null `jdMatchScore` with no JD, actionables, determinism.
  - `keywords.test.ts` (22) - alias folding (`k8s`→kubernetes), tier inference from JD cues, word-boundary matching, dedup, limits.
  - `analysis.test.ts` (26) - bullet ratings, passive-voice demotion, analytics never NaN on an empty resume, technical/soft JD split.
  - `inlineFormat.test.ts` (13) - `*bold*` round-trip, unpaired asterisks left literal, no newline spanning.
  - `diff.test.ts` (11) - add/remove/edit, antisymmetry, bolding a bullet is not a content change.
  - `persistIO.test.ts` (14) - save-file round-trip, and rejection of malformed/foreign/hostile JSON.
  - `storage.test.ts` (15) - quota detection and the warning lifecycle.
- ✅ **CI** (`.github/workflows/ci.yml`): typecheck → lint → test → build on push and PR.

**Data safety (P3)** - the highest-severity fix in this pass.
- ✅ **`localStorage` quota is now handled.** Previously a full quota threw on every autosave and edits were silently discarded - the worst failure possible for a local-first app. `src/lib/storage.ts` wraps the persist layer so writes never throw, and a non-dismissable **"Autosave is off"** banner tells the user to export a backup. It clears automatically once writes succeed again.
- ✅ Storage being entirely unavailable (Safari private mode, blocked contexts) degrades to in-memory instead of crashing.

**Error handling (P3)** - was: 5 `catch` blocks, exports had none.
- ✅ DOCX export, PDF export and Save-to-file now surface failures in the error banner instead of failing silently.
- ✅ **`src/app/error.tsx`** error boundary (Next 16's `unstable_retry`, not `reset`), which reassures the user their resume is still in the browser rather than showing a blank page.

**Accessibility (P3)** - was: 2 `aria-` attributes in the entire app.
- ✅ Every editor field has a real accessible name - a `<label for>` where there's room, otherwise the placeholder mirrored to `aria-label`. The old `<Label>` rendered a `<label>` pointing at nothing, which is worse than none.
- ✅ Mobile switcher is a proper `tablist` with `aria-selected`, linked `tabpanel`s and arrow-key navigation.
- ✅ Shared `Menu` (File, Export, Resumes, Versions) gained `aria-expanded`, `aria-haspopup`, **Escape-to-close** and focus return to the trigger.
- ✅ `aria-pressed` on the Analysis/theme toggles, `role="alert"` on errors, `role="status"` on progress, a skip link, and better contrast on inactive tabs.

**SEO / metadata (P3)** - was: title and description only.
- ✅ Open Graph + Twitter card, `metadataBase`, canonical URL, keywords, and light/dark `themeColor`.
- ✅ **A generated OG image** (`opengraph-image.tsx`), so a shared link unfurls as a real card.
- ✅ `robots.ts` and `sitemap.ts`, both driven by `src/lib/site.ts` so they can't drift; `NEXT_PUBLIC_SITE_URL` lets previews advertise their own host.

**Incidental fixes**
- ✅ Cleared two pre-existing lint errors that would have made the new CI red on day one. `useTheme` and the hydration gate now use `useSyncExternalStore` instead of setState-in-effect - which also removes a flash of the wrong theme on load.

**Not done - carried forward**
- 🔜 **Performance work.** Deliberately deferred: the app is one `'use client'` tree behind a loading gate, and analysis runs synchronously per keystroke. Both are worth *measuring* before changing; nothing here is a known problem yet.

---

## 🔜 Planned

### Pass 3 - remaining local features (still no backend) 🔜
More of the master-resume workflow that can ship client-side, building on the Pass 3-lite foundation above.

- 🔜 **Skill / Project / Bullet banks** - reusable content saved once and inserted into any resume.
- 🔜 **One-click role variants** (PM / SWE / MBA / Sales / Consulting) generated from the master.
- 🔜 **Smart templates** (the ~6 role layout templates) + **Recruiter Mode** (read-only preview).
- 🔜 **Live master propagation** - editing a bullet/metric on the master updates linked copies (vs. today's copy-at-creation).

### Pass 3 - cloud (needs backend) 💭
The parts that genuinely require infrastructure. Needs decisions before starting.

- 💭 **Decisions needed first:** auth provider (Clerk vs. Auth.js) and Postgres host (Neon / Supabase / Vercel Postgres). These add hosting, secrets, and cost.
- 🔜 **Auth** + **Postgres + Prisma**; migrate the local library → cloud so it's durable and multi-device.
- 🔜 **Cloud sync + shareable links** for resumes/versions.
- 🔜 **Add `.env.example`** as part of this pass. There is none today, which is correct while the app has no env vars (`.env.local` holds only a Vercel-injected `VERCEL_OIDC_TOKEN`) - but it becomes required the moment a DB URL or auth key exists. Same applies to Pass 4's LLM key.

> Note: the cloud pass changes the app from a zero-build static site to one with serverless functions + a database.

### Pass 4 - AI layer 💭
Everything that genuinely needs generation or judgment. Requires an LLM API key (provider TBD - Anthropic/OpenAI).

- 💭 **Decision needed first:** LLM provider + key + budget.
- 🔜 **AI Rewrite panel** per bullet: shorter / stronger / ATS-friendly / tone variants (executive, PM, SWE, MBA, leadership).
- 🔜 **Achievement generator**: weak input → quantified, impactful bullet.
- 🔜 **AI recruiter review** (qualitative feedback) + **mock recruiter questions**.
- 🔜 **True semantic JD matching** (embeddings) replacing the local synonym map where it helps.
- 🔜 **Grammar assistance** (Grammarly-lite).
- 🔜 **Hybrid scoring**: blend LLM qualitative judgment with the deterministic rules for explainable scores, with graceful fallback to deterministic-only when no key/quota.

### Pass 5 - Export hardening & ATS/parsing validation 🔜
Reliability polish so a generated resume is provably ATS-parseable.

- 🔜 **Server-side Puppeteer PDF** (`@sparticuz/chromium`) for pixel-perfect one-click export.
- 🔜 **Parsing simulation**: re-parse the exported PDF and warn if extraction fails.
- 🔜 **ATS simulation checks**: fonts, columns, tables, images, headers/footers, unicode, hidden text.
- 🔜 **PDF quality checker**: embedded fonts, DPI, corruption.
- 🔜 **DOCX fidelity hardening**; refined OCR-failure messaging.
- 🔜 **First-glance / eye-tracking simulation** (predicted read order + layout warnings).

---

## Verified non-issues (do not re-investigate)

- **Vercel's dashboard shows "No Production Deployment" for this project. Ignore it - it is wrong.**
  Checked on 2026-07-29 against the Vercel API: the latest production deployment is
  `dpl_5VTFBkkNZxiNKUvQnaS2pH9dZr21`, with `source: git`, `target: production`,
  `githubCommitRef: main`, `githubCommitSha: b9ec985` (the Pass 2.5 commit), state `READY`, aliased to
  `resume-forge-two-pi.vercel.app`. The live site independently confirms it - `/robots.txt`,
  `/sitemap.xml` and `/opengraph-image` all return 200 and the homepage carries the new OG tags, none
  of which existed before that commit.
  So **git auto-deploy works and production is current**; only the overview card is stale. A hard
  refresh usually clears it. Note that `vercel inspect --json` returns a trimmed object with **no**
  `meta`/`gitSource` fields - absence there is not evidence of a CLI deploy, which is an easy wrong
  turn when diagnosing this. Query the REST API (`/v13/deployments/<id>`) instead.

---

## Jobs Forge (`/jobs`)

A separate route tracking the status of job applications, sourced from a Gmail snapshot the user's
agent writes to `~/Downloads/jobs-forge-snapshot.json`. The page reads that file with the File System
Access API, so **it changes none of the local-first constraints above**: no backend, no API routes,
nothing uploaded, nothing committed. `/jobs` is `noindex`, absent from the sitemap, and disallowed in
robots.txt; snapshots are gitignored because this repo is public.

**`JOBS-FORGE.md` at the repo root is the agent runbook** - the queries to run, the snapshot schema,
and the judgments the deterministic pipeline cannot make on its own. Read it before refreshing the
dashboard.

✅ **Phase 0 - shipped.** The classifier (`src/lib/jobs/`), thread correlation, the derived-status
ladder, the "Needs you" strip, the review drawer, and the first 90-day backfill (34 applications
across 71 threads). 187 tests, fixtures verbatim from the real mailbox.

🔜 **Phase 1** manual corrections (merge/split/rename, notes, manual add) · **Phase 2** Gmail
write-back labels, staleness SLAs, follow-up drafts · **Phase 3** encrypted snapshot for phone
access · **Phase 4** funnel analytics · **Phase 5** link applications to the resume version sent.

Two things Phase 0 deliberately does *not* do, and should not be "fixed" without a decision:
- **It never guesses.** An application whose company cannot be determined shows as unknown and lands
  in the review drawer. A blank field is honest; a guessed one is a lie the dashboard repeats.
- **A rejection is never inferred from a subject line alone.** Lever's "Thank you for your interest
  in X" is a rejection and Teamtailor's "Thanks For Sharing Your Interest With Us!" is an
  acknowledgement. Marking a live application dead is the one unrecoverable error here.

---

## Known limitations (current state)

- **PDF export uses the browser print dialog** - faithful and keeps text selectable, but not yet a one-click server render (that's Pass 5). Worth a manual click-test.
- **PDF import parsing is heuristic** - it reconstructs sections from text positions and won't be perfect on every layout; users clean up afterward. Scanned/image PDFs are rejected, not OCR'd.
- **Keyword/semantic matching is deterministic** - a curated dictionary + synonym map, not embeddings. Genuine semantic understanding arrives with the AI layer (Pass 4).
- **No accounts / multi-device** yet - everything is local to the browser until Pass 3.
- **Browser storage is finite (~5MB).** Since Pass 2.5 a full quota is detected and warned about rather than silently losing edits, but it is still a ceiling: many resumes each with many versions will eventually hit it. Deleting old versions frees space; the real fix is Pass 3-cloud.
- **Tests cover `src/lib` only** - the deterministic core. Components have no rendering tests yet (that would need jsdom and Testing Library); they are covered by typecheck, lint and the production build.
- **Jobs Forge auto-refresh needs Chrome or Edge.** The File System Access API is not implemented in Firefox and Safari cannot reliably persist a file handle, so those browsers import the snapshot manually instead - same data, one extra click. Chrome resets file permission to "prompt" on most page loads unless `/jobs` is installed as an app, which is why it ships a web manifest.
- **Jobs Forge does not work on a phone.** The API does not exist on mobile and the snapshot file is not there. That is the direct cost of keeping the data off the internet; Phase 3 (an encrypted snapshot) is the fix.

---

## Out of scope (for now)

Real OCR of scanned PDFs (we detect & reject only); creative/designer templates and colour themes (black & white by design); multi-page layouts (pageless by requirement); collaboration/sharing; payments.

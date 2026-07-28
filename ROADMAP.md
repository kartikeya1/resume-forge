# 🗺️ ResumeForge — Roadmap

This document tracks **what has been built** and **what is planned** across the product's phased passes. The guiding principle: each pass is independently shippable and adds a coherent slice of value. We front-loaded the "edit → score → fix" loop, then deterministic depth (free, no API cost), and defer the backend, AI, and export-hardening work to later passes.

**Legend:** ✅ done · 🔜 planned · 💭 needs a product/infra decision before starting

_Last verified: 2026-07-29 · tree clean, level with origin/main · 9 commits._

### Phase mapping

The passes below are the product story. They map onto the execution ladder used across all of
Kartikeya's repos, so "Phase 2" means the same thing everywhere:

| Phase | Meaning | Where it lives here |
|---|---|---|
| **P0** stop the bleeding | unpushed work, leaks, diverged clones | **nothing pending** — clean and in sync |
| **P1** safety net | tests + CI | **Pass 2.5** (new, below) — the biggest gap in this repo |
| **P2** truth in docs | stale claims, dead routes | small: see Pass 2.5 |
| **P3** polish | a11y, SEO, error handling, perf | **Pass 2.5** |
| **P4** features | product work, no outside dependency | Pass 3-local, Pass 5 |
| **P5** decision-gated | needs a provider/key/budget call | Pass 3-cloud, Pass 4-AI |

**Execution order recommendation:** Pass 2.5 before Pass 3. The deterministic scoring engine *is*
the product's core claim and currently has zero automated verification — every later pass builds on
numbers nothing checks.

---

## Product vision

A simplified, resume-only editor (think "Google Docs for resumes") with a live pageless preview, plus a **feedback engine** that scores the resume for ATS-compatibility and against a specific job description, and tells the user exactly what to fix. Target users: college students and experienced folks in software engineering, product management, and MBA (sales/marketing) roles. Output is clean black & white — not for creative fields.

**Confirmed constraints**
- Deterministic-first: scoring and keyword logic are rule-based (no LLM) in early passes; AI is a dedicated later pass.
- Local-first: no login/backend in the early passes; accounts + database arrive in Pass 3.
- Each pass is approved before work begins.

---

## ✅ Done

### Pass 0 — Foundation
- ✅ Next.js 16 (App Router) + TypeScript + Tailwind v4 + Zustand scaffold.
- ✅ Structured `Resume` JSON schema as the single source of truth.
- ✅ Zustand store with `localStorage` autosave.
- ✅ Three-pane responsive shell (editor · preview · insights) + print stylesheet.
- ✅ Deployed to Vercel with auto-deploy on push.

### Pass 1 — Viable product (the core loop)
- ✅ Start fresh **or** import a PDF (pdf.js extraction → heuristic section parse).
- ✅ **Image-only / scanned PDF rejection** with a clear error message.
- ✅ Structured editor for all core sections with add / remove / reorder.
- ✅ Live **pageless, seamless black & white preview**.
- ✅ **Export PDF** (print-to-PDF, selectable text) and **Export DOCX** (client-side).
- ✅ **Job-description input** → deterministic keyword extraction → keyword chips.
- ✅ **Live keyword present/missing indicators** with synonym matching.
- ✅ **ATS score + JD-match score** with an explainable 5-part breakdown.
- ✅ **Actionables checklist** (ATS rules + JD gaps); completed items struck-through.

### Pass 2 — Deterministic intelligence
- ✅ **Health Dashboard**: ATS compatibility, impact, recruiter readability, formatting, keyword match.
- ✅ **Bullet analyzers**: weak-verb, missing-number, passive-voice, repetition, and STAR/impact heuristics — each with a suggestion.
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

### Pass 3-lite — local library & versioning (no backend)
The parts of the master-resume differentiator that work entirely client-side, delivered without a database or accounts.
- ✅ **Resume library**: maintain multiple named resumes; switch / create / duplicate / rename / delete.
- ✅ **Master resume + "New from Master"**: mark one resume as the source and spin up tailored copies from it.
- ✅ **Version history**: per-resume snapshots with restore, plus a deterministic **diff** (added / removed content) against the current draft.
- ✅ **Application status** per resume (Draft / Applied / Interview / Offer / Rejected) — a lightweight application tracker.
- ⚠️ Everything is stored in the browser (`localStorage`) — single-device and clearable; the `.resume.json` Save file is the backup. Cloud durability, sync, and login remain a Pass 3 (backend) concern.

---

## 🔜 Planned

### Pass 2.5 — quality baseline (P1 · P2 · P3) 🔜

**Do this before Pass 3.** Everything built so far is unverified by anything except manual clicking,
and the scores are the product's central claim. Nothing here needs a decision, a key, or a budget —
it is pure unblocked work, which is why it sits ahead of the feature passes.

**P1 — tests (the headline gap: there are none, and no runner)**
- 🔜 Add a test runner. No `test` script, no Vitest/Jest/Playwright dependency, **0 test files** today.
- 🔜 Unit-test the deterministic core — all pure functions, all cheap to test, all load-bearing:
  - `src/lib/scoring.ts` — the ATS + JD-match scores and the 5-part breakdown.
  - `src/lib/analysis.ts` — bullet analyzers (weak verb, missing number, passive, repetition, STAR).
  - `src/lib/keywords.ts` — extraction, synonym matching, tiered coverage.
  - `src/lib/diff.ts` — version diff (added/removed) correctness.
  - `src/lib/pdfImport.ts` — heuristic section parse, plus the scanned-PDF rejection path.
  - `src/lib/inlineFormat.ts` — `*asterisk*` → bold across preview, PDF and DOCX.
  - `src/lib/persistIO.ts` — `.resume.json` round-trip and foreign-file rejection.
- 🔜 A golden-file test per role sample: import the 6 starters, assert the scores don't silently move.

**P1 — CI**
- 🔜 There is **no `.github/` directory at all**. Add a workflow running `lint` + `build` + the new tests on push. Today `npm run build` is only ever exercised locally or by Vercel.

**P3 — accessibility** (currently **2 `aria-` attributes across the whole app**)
- 🔜 Mobile tab switcher (`src/app/page.tsx:41-55`) is a bare `<button>` group — needs `role="tablist"` / `aria-selected` / arrow-key handling.
- 🔜 The File / Export / Resumes / Versions dropdowns (`Toolbar.tsx`, `DocsMenu.tsx`, `VersionsMenu.tsx`) have no `aria-expanded` / `aria-haspopup`, no focus trap, and no Escape-to-close.
- 🔜 Check contrast on inactive tab text (`text-neutral-400` on `neutral-100`) — likely below WCAG AA.
- 🔜 Add a skip link; confirm `Editor.tsx` inputs are programmatically labelled, not just visually.

**P3 — error handling** (only 5 `catch` blocks app-wide)
- 🔜 `src/components/Toolbar.tsx:118` swallows every non-`ScannedPdfError` to `console.error` — the user sees nothing when a PDF import fails.
- 🔜 `src/lib/docxExport.ts` and `src/lib/pdfExport.ts` have no error handling at all.
- 🔜 No `error.tsx` / `not-found.tsx` / `loading.tsx` in `src/app/` — an unhandled render error blanks the page.
- 🔜 **`localStorage` has no quota handling** (`src/lib/store.ts`, `src/lib/persistIO.ts`). With the Pass 3-lite library plus per-resume version history, a heavy user *will* hit the quota, and today the write fails silently — losing work in the one place the product promises durability.

**P3 — metadata / SEO**
- 🔜 `src/app/layout.tsx` sets only `title` + `description`. No `openGraph`/`twitter` cards, no `metadataBase`/canonical, no `robots.txt`, no `sitemap.ts`, no `theme-color`. A shared resume-builder link currently unfurls as bare text.

**P3 — performance** (measure before changing anything)
- 🔜 The whole app is one `'use client'` tree behind a full-screen "Loading ResumeForge…" gate, so first paint is a spinner with no SSR content. Consider a static shell + Suspense.
- 🔜 Analysis appears to run synchronously on every keystroke via the store — profile a long resume; debounce or move to a worker only if it actually janks.
- 🔜 `pdfjs-dist` sits in the client bundle path; confirm it's lazily loaded and only on import.

**P2 — docs**
- 🔜 `README.md`'s feature list is accurate (checked) — the only doc gap is that this quality work was previously absent from the roadmap entirely. Add a `CHANGELOG.md`; consider a `TODO.md` "next up" view mirroring the umbra repo's ROADMAP+TODO pair.

### Pass 3 — remaining local features (still no backend) 🔜
More of the master-resume workflow that can ship client-side, building on the Pass 3-lite foundation above.

- 🔜 **Skill / Project / Bullet banks** — reusable content saved once and inserted into any resume.
- 🔜 **One-click role variants** (PM / SWE / MBA / Sales / Consulting) generated from the master.
- 🔜 **Smart templates** (the ~6 role layout templates) + **Recruiter Mode** (read-only preview).
- 🔜 **Live master propagation** — editing a bullet/metric on the master updates linked copies (vs. today's copy-at-creation).

### Pass 3 — cloud (needs backend) 💭
The parts that genuinely require infrastructure. Needs decisions before starting.

- 💭 **Decisions needed first:** auth provider (Clerk vs. Auth.js) and Postgres host (Neon / Supabase / Vercel Postgres). These add hosting, secrets, and cost.
- 🔜 **Auth** + **Postgres + Prisma**; migrate the local library → cloud so it's durable and multi-device.
- 🔜 **Cloud sync + shareable links** for resumes/versions.
- 🔜 **Add `.env.example`** as part of this pass. There is none today, which is correct while the app has no env vars (`.env.local` holds only a Vercel-injected `VERCEL_OIDC_TOKEN`) — but it becomes required the moment a DB URL or auth key exists. Same applies to Pass 4's LLM key.

> Note: the cloud pass changes the app from a zero-build static site to one with serverless functions + a database.

### Pass 4 — AI layer 💭
Everything that genuinely needs generation or judgment. Requires an LLM API key (provider TBD — Anthropic/OpenAI).

- 💭 **Decision needed first:** LLM provider + key + budget.
- 🔜 **AI Rewrite panel** per bullet: shorter / stronger / ATS-friendly / tone variants (executive, PM, SWE, MBA, leadership).
- 🔜 **Achievement generator**: weak input → quantified, impactful bullet.
- 🔜 **AI recruiter review** (qualitative feedback) + **mock recruiter questions**.
- 🔜 **True semantic JD matching** (embeddings) replacing the local synonym map where it helps.
- 🔜 **Grammar assistance** (Grammarly-lite).
- 🔜 **Hybrid scoring**: blend LLM qualitative judgment with the deterministic rules for explainable scores, with graceful fallback to deterministic-only when no key/quota.

### Pass 5 — Export hardening & ATS/parsing validation 🔜
Reliability polish so a generated resume is provably ATS-parseable.

- 🔜 **Server-side Puppeteer PDF** (`@sparticuz/chromium`) for pixel-perfect one-click export.
- 🔜 **Parsing simulation**: re-parse the exported PDF and warn if extraction fails.
- 🔜 **ATS simulation checks**: fonts, columns, tables, images, headers/footers, unicode, hidden text.
- 🔜 **PDF quality checker**: embedded fonts, DPI, corruption.
- 🔜 **DOCX fidelity hardening**; refined OCR-failure messaging.
- 🔜 **First-glance / eye-tracking simulation** (predicted read order + layout warnings).

---

## Known limitations (current state)

- **PDF export uses the browser print dialog** — faithful and keeps text selectable, but not yet a one-click server render (that's Pass 5). Worth a manual click-test.
- **PDF import parsing is heuristic** — it reconstructs sections from text positions and won't be perfect on every layout; users clean up afterward. Scanned/image PDFs are rejected, not OCR'd.
- **Keyword/semantic matching is deterministic** — a curated dictionary + synonym map, not embeddings. Genuine semantic understanding arrives with the AI layer (Pass 4).
- **No accounts / multi-device** yet — everything is local to the browser until Pass 3.

---

## Out of scope (for now)

Real OCR of scanned PDFs (we detect & reject only); creative/designer templates and colour themes (black & white by design); multi-page layouts (pageless by requirement); collaboration/sharing; payments.

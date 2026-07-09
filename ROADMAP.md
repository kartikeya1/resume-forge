# 🗺️ ResumeForge — Roadmap

This document tracks **what has been built** and **what is planned** across the product's phased passes. The guiding principle: each pass is independently shippable and adds a coherent slice of value. We front-loaded the "edit → score → fix" loop, then deterministic depth (free, no API cost), and defer the backend, AI, and export-hardening work to later passes.

**Legend:** ✅ done · 🔜 planned · 💭 needs a product/infra decision before starting

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

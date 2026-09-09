<p align="center"><img src="./logo.svg" width="72" alt="ResumeForge logo" /></p>

# ResumeForge

A web-based resume builder with a **live pageless preview**, a deterministic **ATS score**, and **job-description keyword matching** - built to help software engineering, product management, and MBA (sales/marketing) candidates tailor a clean, ATS-friendly resume.

**Everything runs in your browser.** No account, no backend, no data leaves your machine - your work autosaves to `localStorage`, and you can export a portable save file whenever you like. If browser storage ever fills up, the app tells you autosave has stopped rather than losing edits quietly. (The one exception is opt-in and explicit: Jobs Forge can publish an *encrypted* snapshot for phone access - see Privacy.)

🔗 **Live:** https://resume-forge-two-pi.vercel.app

> Looking for what's built vs. what's planned? See **[ROADMAP.md](./ROADMAP.md)**.

<br>

## Features

**Editing & content**
- **Start fresh**, **import a PDF**, load a **role sample** (APM, PM, SPM, Marketing MBA, Sales MBA, Sr. Sales Manager), or **Open** a previously saved file.
- Structured section editor (contact, summary, experience, projects, skills, education, certifications) with add / remove / reorder.
- **Inline bold formatting** - wrap text in `*asterisks*` (WhatsApp-style) and it renders bold in the preview and in both PDF and DOCX exports.
- **Live pageless preview** - a black & white, single continuous "paper" that updates as you type.
- **Dark mode** toggle - the whole app goes dark while the resume paper stays white for true-to-print visualization.

**Resume library, versions & applications (all local - no account)**
- Maintain **multiple named resumes** in one place; switch, create, **duplicate**, rename, and delete.
- Mark one as your **Master** and spin up tailored copies with **"New from Master."**
- **Version history** per resume: save snapshots, **restore** any of them, and **diff** a snapshot against the current draft (added / removed content).
- Tag each resume with an **application status** (Draft / Applied / Interview / Offer / Rejected) - a lightweight application tracker.

**Import**
- Text PDFs are parsed with pdf.js and heuristically split into structured sections.
- **Image-only / scanned PDFs are detected and rejected** with a clear message (no silent garbage import).

**Scoring & analysis (deterministic - no AI)**
- **ATS score** + **JD-match score**, with a 5-part **Health Dashboard** (ATS compatibility, impact, recruiter readability, formatting, keyword match).
- **Job-description keyword matching**: keywords are extracted, tiered (critical / important / optional), and shown as chips that turn green ✓ when present in your resume (with a synonym map so "ML" matches "machine learning", "AI", etc.).
- **Writing issues**: per-bullet detection of weak openers, missing numbers, passive voice, repeated verbs, and STAR/impact gaps - each with a fix suggestion.
- **Analytics**: word/bullet counts, quantified ratio, action verbs, passive sentences, readability grade, recruiter skim-time estimate.
- **Structure checks**: missing/thin sections, timeline gaps, length balance, content balance, and section-ordering suggestions.
- **Skill gap**: JD keywords split technical vs. soft, with the missing required/preferred list.
- **Actionables checklist**: concrete improvements (ATS rules + JD gaps); completed items stay visible but struck-through.
- An **analysis heatmap overlay** on the preview colours each bullet green/amber/red - and is automatically stripped from exports.

**Save / export**
- **Save / Open** a portable, versioned `.resume.json` snapshot (resume **+** job description); store it anywhere.
- **Export PDF** (print-to-PDF; text stays selectable and ATS-parseable) and **Export DOCX** (generated client-side, layout preserved). Exports are always clean B&W regardless of the app theme.

<br>

## How it works

### Single source of truth: the `Resume` model
Everything derives from one typed JSON object ([`src/lib/types.ts`](./src/lib/types.ts)) - contact, summary, experience[], education[], skills[], projects[], certifications[], a `sectionOrder`, and `meta`. We deliberately use a **structured model rather than free rich text**, because clean structured data is what makes reliable scoring, keyword matching, and faithful export possible.

### State & persistence
Global state lives in a **Zustand** store ([`src/lib/store.ts`](./src/lib/store.ts)). It holds a **library** of documents (each with its own resume, job description, application status, master flag, and version history) plus the live working copy of the active document. The `persist` middleware autosaves the whole library to `localStorage` (`resume-forge:v1`, with a versioned migration from the earlier single-document shape). All edits go through a single `update(recipe)` action that structurally clones the active resume, so React re-renders predictably.

Persistence goes through a **guarded storage layer** ([`src/lib/storage.ts`](./src/lib/storage.ts)) rather than raw `localStorage`. The browser is effectively the database here, and browser storage is finite (~5MB): if it fills up, writes fail. The wrapper never throws - it reports the failure so the app can show a persistent **"Autosave is off"** warning telling you to export a backup, and clears it once writes succeed again. Storage being unavailable entirely (Safari private mode) degrades to in-memory instead of crashing.

**Bold formatting** is handled by a tiny shared parser ([`inlineFormat.ts`](./src/lib/inlineFormat.ts)): `*asterisks*` → bold segments, consumed by both the React preview (`<Inline>`) and the DOCX exporter (bold `TextRun`s). **Version diffs** are a deterministic content-level comparison ([`diff.ts`](./src/lib/diff.ts)).

### The edit → preview → score loop
1. The **Editor** (left) writes into the store.
2. The **ResumePreview** (centre) renders the current `resume` into the pageless paper.
3. The **InsightsPanel** (right) recomputes analysis with `useMemo` whenever the resume or JD changes:
   - `scoring.ts` → the two headline scores, the health breakdown, keyword coverage, and actionables.
   - `analysis.ts` → per-bullet ratings, writing issues, analytics, structure checks, and the JD skill-gap.
   - `keywords.ts` → JD keyword extraction, tiering, synonym-aware presence matching.

### PDF import
[`src/lib/pdfImport.ts`](./src/lib/pdfImport.ts) loads pdf.js in the browser, extracts text with positions, and reconstructs lines. If almost no text is found, it throws `ScannedPdfError` (the image-only rejection). Otherwise it heuristically buckets lines into sections and fills the `Resume` model - you then clean up anything the heuristics missed.

### Export
- **PDF** ([`pdfExport.ts`](./src/lib/pdfExport.ts)): sizes an `@page` rule to the measured content height and calls `window.print()`, printing the exact preview DOM as a single seamless page. Because it's the real DOM, the text stays selectable/parseable.
- **DOCX** ([`docxExport.ts`](./src/lib/docxExport.ts)): builds a `docx` document from the `Resume` model and downloads it.
- A print stylesheet in [`globals.css`](./src/app/globals.css) hides all app chrome (and the analysis overlay) so only the paper prints.

### Dark mode
A class-based Tailwind v4 dark variant (`@custom-variant dark`) is toggled by a `.dark` class on the app root ([`useTheme.ts`](./src/lib/useTheme.ts), persisted in `localStorage`). All chrome carries `dark:` classes; the `#resume-paper` intentionally does not, so it stays paper-white.

<br>

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand (+ `persist`) |
| PDF parsing | pdf.js (`pdfjs-dist`) |
| DOCX export | `docx` |
| PDF export | Browser print-to-PDF |
| Tests | Vitest (123 tests over `src/lib`) |
| CI | GitHub Actions - typecheck, lint, test, build |
| Hosting | Vercel (auto-deploy on push) |

No backend, no database, no auth, no API keys - the entire app is client-side and statically prerendered.

<br>

## Project structure

```
resume-forge/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout + metadata (OG/Twitter, canonical, themeColor)
│   │   ├── page.tsx            # 3-pane shell (editor · preview · insights), theme + analysis toggles
│   │   ├── error.tsx           # Error boundary - keeps the user's work visible on a crash
│   │   ├── opengraph-image.tsx # Generated 1200x630 social card
│   │   ├── robots.ts           # robots.txt
│   │   ├── sitemap.ts          # sitemap.xml
│   │   └── globals.css         # Tailwind, dark variant, print styles
│   ├── components/
│   │   ├── Toolbar.tsx         # Brand + Resumes / Versions menus; grouped File & Export menus; analysis + theme toggles
│   │   ├── DocsMenu.tsx        # Resume library dropdown (switch/new/duplicate/rename/delete/status/master)
│   │   ├── VersionsMenu.tsx    # Version snapshots dropdown (save/restore/diff)
│   │   ├── Editor.tsx          # Left pane - all section editors
│   │   ├── ResumePreview.tsx   # Centre pane - pageless paper + analysis heatmap
│   │   ├── InsightsPanel.tsx   # Right pane - scores, dashboard, issues, analytics, JD, actionables
│   │   ├── InlineText.tsx      # Renders *bold* markup as <strong>
│   │   └── ui.tsx              # Shared inputs, buttons, collapsible card + Menu primitives
│   └── lib/
│       ├── types.ts            # The Resume schema (single source of truth)
│       ├── store.ts            # Zustand store: resume library, versions, status + localStorage persistence
│       ├── keywords.ts         # JD keyword extraction, tiering, synonym matching
│       ├── scoring.ts          # ATS + JD-match scores, health breakdown, actionables
│       ├── analysis.ts         # Pass 2: bullet ratings, writing issues, analytics, structure
│       ├── inlineFormat.ts     # *bold* parser (shared by preview + DOCX)
│       ├── diff.ts             # Content-level version diff
│       ├── pdfImport.ts        # pdf.js text extraction + scanned detection + heuristic parse
│       ├── docxExport.ts       # DOCX generation
│       ├── pdfExport.ts        # Print-to-PDF (single seamless page)
│       ├── persistIO.ts        # Save/Open .resume.json snapshots
│       ├── storage.ts          # Guarded localStorage - quota detection + autosave warning
│       ├── site.ts             # Canonical URL + shared copy for metadata/robots/sitemap
│       ├── samples.ts          # 6 role sample resumes
│       ├── sampleData.ts       # Empty + default resume
│       ├── useTheme.ts         # Persisted light/dark toggle
│       ├── useMounted.ts       # Hydration gate (useSyncExternalStore)
│       ├── ids.ts              # Unique id helper
│       └── *.test.ts           # 123 Vitest tests over the deterministic core
├── .github/workflows/ci.yml    # typecheck → lint → test → build
├── vitest.config.ts            # Test runner config
├── next.config.ts              # Pins Turbopack root
├── README.md
└── ROADMAP.md                  # What's done + all future passes
```

<br>

## Local development

Requires Node.js 20.9+.

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # production build (Turbopack)
npm run start          # serve the production build
npm run lint
npm run typecheck      # tsc --noEmit
npm test               # vitest run - 123 tests
npm run test:watch     # vitest in watch mode
npm run test:coverage  # coverage over src/lib
```

### Tests & CI

The suite covers **`src/lib`** - the deterministic scoring, keyword, analysis, diff, save-file and
storage logic that the product's ATS and JD-match claims rest on. These are pure functions, so the
tests need no DOM and run in well under a second. UI components are not render-tested; they are
covered by typecheck, lint and the production build.

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs **typecheck → lint → test → build** on
every push and PR to `main`.

<br>

## Deployment

Zero-config on **Vercel** (framework preset **Next.js**). The GitHub repo is connected to a Vercel project, so **every push to `main` triggers an automatic production deploy**.

The one optional environment variable is **`NEXT_PUBLIC_SITE_URL`**. It sets the canonical URL used by the metadata, `robots.txt` and `sitemap.xml` ([`src/lib/site.ts`](./src/lib/site.ts)); set it on a preview deployment so those point at the preview host instead of production. Without it the production URL is used, which is correct for production.

<br>

## Privacy

ResumeForge is fully client-side. Your resume and job descriptions never leave your browser - they
live in `localStorage` and in any `.resume.json` file you choose to save. There is no server, no
analytics, and no third-party data sharing.

### Jobs Forge (`/jobs`)

The job-application tracker at `/jobs` reads a snapshot of your own Gmail from a file on your disk
via the File System Access API. That file is gitignored and never uploaded, so by default nothing
about your job search leaves your machine either.

There is exactly one way for it to leave, and it only happens if you ask for it: **Publish for
phone** encrypts the snapshot in your browser (AES-256-GCM, key stretched with PBKDF2-SHA256 at
600,000 rounds) and downloads the ciphertext for you to commit as `public/jobs-snapshot.enc`. Any
device can then open `/jobs` and decrypt it with your passphrase.

Be clear-eyed about what that trade is. This repo is public, so a published snapshot is
world-readable ciphertext that anyone can attack offline, indefinitely, with no rate limit. Its only
defence is the strength of your passphrase - which is why the publish button refuses anything short
or predictable and asks for four or five unrelated words. The passphrase is never stored, never
transmitted, and never shown to any agent; it is typed in the browser, used once, and discarded.

If you would rather not make that trade, simply never publish. The desktop file-based path is
unaffected and remains entirely local.

<br>

## License

Personal project - all rights reserved unless a license file says otherwise.

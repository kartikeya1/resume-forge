# 📄 ResumeForge

A web-based resume builder with a **live pageless preview**, a deterministic **ATS score**, and **job-description keyword matching** — built to help software engineering, product management, and MBA (sales/marketing) candidates tailor a clean, ATS-friendly resume.

**Everything runs in your browser.** No account, no backend, no data leaves your machine — your work autosaves to `localStorage`, and you can export a portable save file whenever you like.

🔗 **Live:** https://resume-forge-kartikeya-thapliyals-projects.vercel.app

> Looking for what's built vs. what's planned? See **[ROADMAP.md](./ROADMAP.md)**.

<br>

## Features

**Editing & content**
- **Start fresh**, **import a PDF**, load a **role sample** (APM, PM, SPM, Marketing MBA, Sales MBA, Sr. Sales Manager), or **Open** a previously saved file.
- Structured section editor (contact, summary, experience, projects, skills, education, certifications) with add / remove / reorder.
- **Live pageless preview** — a black & white, single continuous "paper" that updates as you type.
- **Dark mode** toggle — the whole app goes dark while the resume paper stays white for true-to-print visualization.

**Import**
- Text PDFs are parsed with pdf.js and heuristically split into structured sections.
- **Image-only / scanned PDFs are detected and rejected** with a clear message (no silent garbage import).

**Scoring & analysis (deterministic — no AI)**
- **ATS score** + **JD-match score**, with a 5-part **Health Dashboard** (ATS compatibility, impact, recruiter readability, formatting, keyword match).
- **Job-description keyword matching**: keywords are extracted, tiered (critical / important / optional), and shown as chips that turn green ✓ when present in your resume (with a synonym map so "ML" matches "machine learning", "AI", etc.).
- **Writing issues**: per-bullet detection of weak openers, missing numbers, passive voice, repeated verbs, and STAR/impact gaps — each with a fix suggestion.
- **Analytics**: word/bullet counts, quantified ratio, action verbs, passive sentences, readability grade, recruiter skim-time estimate.
- **Structure checks**: missing/thin sections, timeline gaps, length balance, content balance, and section-ordering suggestions.
- **Skill gap**: JD keywords split technical vs. soft, with the missing required/preferred list.
- **Actionables checklist**: concrete improvements (ATS rules + JD gaps); completed items stay visible but struck-through.
- An **analysis heatmap overlay** on the preview colours each bullet green/amber/red — and is automatically stripped from exports.

**Save / export**
- **Save / Open** a portable, versioned `.resume.json` snapshot (resume **+** job description); store it anywhere.
- **Export PDF** (print-to-PDF; text stays selectable and ATS-parseable) and **Export DOCX** (generated client-side, layout preserved). Exports are always clean B&W regardless of the app theme.

<br>

## How it works

### Single source of truth: the `Resume` model
Everything derives from one typed JSON object ([`src/lib/types.ts`](./src/lib/types.ts)) — contact, summary, experience[], education[], skills[], projects[], certifications[], a `sectionOrder`, and `meta`. We deliberately use a **structured model rather than free rich text**, because clean structured data is what makes reliable scoring, keyword matching, and faithful export possible.

### State & persistence
Global state lives in a **Zustand** store ([`src/lib/store.ts`](./src/lib/store.ts)) that holds the `resume` and `jobDescription`. The `persist` middleware autosaves to `localStorage` (`resume-forge:v1`). All edits go through a single `update(recipe)` action that structurally clones the resume, so React re-renders predictably.

### The edit → preview → score loop
1. The **Editor** (left) writes into the store.
2. The **ResumePreview** (centre) renders the current `resume` into the pageless paper.
3. The **InsightsPanel** (right) recomputes analysis with `useMemo` whenever the resume or JD changes:
   - `scoring.ts` → the two headline scores, the health breakdown, keyword coverage, and actionables.
   - `analysis.ts` → per-bullet ratings, writing issues, analytics, structure checks, and the JD skill-gap.
   - `keywords.ts` → JD keyword extraction, tiering, synonym-aware presence matching.

### PDF import
[`src/lib/pdfImport.ts`](./src/lib/pdfImport.ts) loads pdf.js in the browser, extracts text with positions, and reconstructs lines. If almost no text is found, it throws `ScannedPdfError` (the image-only rejection). Otherwise it heuristically buckets lines into sections and fills the `Resume` model — you then clean up anything the heuristics missed.

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
| Hosting | Vercel (auto-deploy on push) |

No backend, no database, no auth, no API keys — the entire app is client-side and statically prerendered.

<br>

## Project structure

```
resume-forge/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout + metadata
│   │   ├── page.tsx            # 3-pane shell (editor · preview · insights), theme + analysis toggles
│   │   └── globals.css         # Tailwind, dark variant, print styles
│   ├── components/
│   │   ├── Toolbar.tsx         # New / Import / Samples / Open / Save / theme / analysis / export
│   │   ├── Editor.tsx          # Left pane — all section editors
│   │   ├── ResumePreview.tsx   # Centre pane — pageless paper + analysis heatmap
│   │   ├── InsightsPanel.tsx   # Right pane — scores, dashboard, issues, analytics, JD, actionables
│   │   └── ui.tsx              # Shared inputs, buttons, collapsible card primitives
│   └── lib/
│       ├── types.ts            # The Resume schema (single source of truth)
│       ├── store.ts            # Zustand store + localStorage persistence
│       ├── keywords.ts         # JD keyword extraction, tiering, synonym matching
│       ├── scoring.ts          # ATS + JD-match scores, health breakdown, actionables
│       ├── analysis.ts         # Pass 2: bullet ratings, writing issues, analytics, structure
│       ├── pdfImport.ts        # pdf.js text extraction + scanned detection + heuristic parse
│       ├── docxExport.ts       # DOCX generation
│       ├── pdfExport.ts        # Print-to-PDF (single seamless page)
│       ├── persistIO.ts        # Save/Open .resume.json snapshots
│       ├── samples.ts          # 6 role sample resumes
│       ├── sampleData.ts       # Empty + default resume
│       ├── useTheme.ts         # Persisted light/dark toggle
│       └── ids.ts              # Unique id helper
├── next.config.ts              # Pins Turbopack root
├── README.md
└── ROADMAP.md                  # What's done + all future passes
```

<br>

## Local development

Requires Node.js 20.9+.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (Turbopack)
npm run start    # serve the production build
npm run lint
```

<br>

## Deployment

Zero-config on **Vercel** (framework preset **Next.js**, no environment variables). The GitHub repo is connected to a Vercel project, so **every push to `main` triggers an automatic production deploy**.

<br>

## Privacy

ResumeForge is fully client-side. Your resume and job descriptions never leave your browser — they live in `localStorage` and in any `.resume.json` file you choose to save. There is no server, no analytics, and no third-party data sharing.

<br>

## License

Personal project — all rights reserved unless a license file says otherwise.

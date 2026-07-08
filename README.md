# 📄 ResumeForge

A web-based resume builder with a **live pageless preview**, a deterministic **ATS score**, and **job-description keyword matching** — built to help software, product, and MBA candidates tailor a clean, ATS-friendly resume. No account, no backend, nothing leaves your browser.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Zustand

<br>

## What it does (Pass 1 — MVP)

- **Start fresh or import a PDF.** Text PDFs are parsed (pdf.js) into structured sections you can edit. Image-only / scanned PDFs are detected and rejected with a clear message.
- **Edit left, preview right.** A simplified, resume-only editor; the right pane renders a black & white, single continuous "pageless" resume live as you type.
- **Live ATS score + JD match score.** Deterministic, explainable scoring (no AI): ATS compatibility, impact, recruiter readability, formatting, and keyword match.
- **Job-description keyword matching.** Paste a JD → keywords are extracted, tiered (critical / important / optional), and shown as chips that turn green ✓ when present in your resume (with a light synonym map so "ML" matches "machine learning", "AI", etc.).
- **Actionables checklist.** Concrete improvements to raise your scores, including JD-gap items; completed items stay visible but struck-through.
- **Export.** PDF (print-to-PDF, design preserved, text stays selectable/parseable) and DOCX (generated client-side, layout preserved).

Everything runs client-side and autosaves to `localStorage`.

<br>

## Roadmap

This is Pass 1 of a phased plan. Later passes add deterministic depth (health dashboard, bullet-level analyzers, skill-gap), then accounts + a master-resume/versioning workflow, then optional AI rewriting/feedback, then pixel-perfect export with parse validation.

<br>

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build (Turbopack)
```

## Deployment

Zero-config on Vercel: framework preset **Next.js**, no environment variables required. Pushing to the default branch triggers an automatic deploy.

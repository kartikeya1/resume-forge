// Client-side PDF import: extract text with pdf.js, reject image-only/scanned
// PDFs, then heuristically parse the text into our structured Resume shape.
'use client';

import type { Resume } from './types';
import { emptyResume } from './sampleData';
import { newId } from './ids';

export class ScannedPdfError extends Error {
  constructor() {
    super('scanned');
    this.name = 'ScannedPdfError';
  }
}

interface Line {
  text: string;
  y: number;
  page: number;
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  // Bundle the worker as an asset (works with the Next/webpack build).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  return pdfjs;
}

// Extract lines with rough vertical position so we can reconstruct order.
async function extractLines(file: File): Promise<Line[]> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines: Line[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Group text items into lines by their y coordinate.
    const rows = new Map<number, string[]>();
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      if (!('str' in item)) continue;
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push(item.str);
    }
    const sorted = [...rows.entries()].sort((a, b) => b[0] - a[0]); // top-to-bottom
    for (const [y, parts] of sorted) {
      const text = parts.join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push({ text, y, page: p });
    }
  }
  return lines;
}

const SECTION_PATTERNS: Array<{ key: keyof Resume | 'contact'; re: RegExp }> = [
  { key: 'summary', re: /^(summary|profile|objective|about)\b/i },
  { key: 'experience', re: /^(experience|work experience|employment|professional experience)\b/i },
  { key: 'education', re: /^(education|academics?)\b/i },
  { key: 'skills', re: /^(skills|technical skills|core competencies)\b/i },
  { key: 'projects', re: /^(projects?|personal projects)\b/i },
  { key: 'certifications', re: /^(certifications?|licenses?)\b/i },
];

const BULLET_RE = /^[\s]*[•·▪◦*\-–—]\s+/;

function detectSection(line: string): string | null {
  const compact = line.trim();
  if (compact.length > 40) return null; // headers are short
  for (const { key, re } of SECTION_PATTERNS) {
    if (re.test(compact)) return key as string;
  }
  return null;
}

export async function importPdf(file: File): Promise<Resume> {
  const lines = await extractLines(file);
  const joined = lines.map((l) => l.text).join(' ');

  // Scanned / image-only detection: a text PDF of a resume has hundreds of
  // characters and multiple words. If we got almost nothing, it's an image.
  const wordCount = joined.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  if (joined.replace(/\s/g, '').length < 40 || wordCount < 15) {
    throw new ScannedPdfError();
  }

  const resume = emptyResume();

  // --- Contact: scan the first ~8 lines + regex the whole doc. ---
  const head = lines.slice(0, 8).map((l) => l.text);
  const email = joined.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? '';
  const phone = joined.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim() ?? '';
  resume.contact.email = email;
  resume.contact.phone = phone;
  // Name: first non-empty head line that isn't a section/contact string.
  resume.contact.name = head.find((t) => t && !/@|\d{3}/.test(t) && t.length < 50) ?? '';
  // Links
  const urls = joined.match(/((https?:\/\/)?(www\.)?(linkedin\.com|github\.com|[a-z0-9-]+\.[a-z]{2,})\/[^\s]+)/gi) ?? [];
  for (const u of urls.slice(0, 4)) {
    const label = /linkedin/i.test(u) ? 'LinkedIn' : /github/i.test(u) ? 'GitHub' : 'Link';
    if (!resume.contact.links.some((l) => l.url === u)) {
      resume.contact.links.push({ id: newId(), label, url: u.replace(/[),.]+$/, '') });
    }
  }

  // --- Walk lines, bucketing by current section. ---
  let current: string | null = null;
  const buckets: Record<string, string[]> = {};
  for (const { text } of lines) {
    const sec = detectSection(text);
    if (sec) {
      current = sec;
      buckets[current] = buckets[current] ?? [];
      continue;
    }
    if (current) buckets[current].push(text);
  }

  if (buckets.summary) resume.summary = buckets.summary.join(' ').trim();

  if (buckets.experience) {
    resume.experience = parseExperience(buckets.experience);
  }
  if (buckets.projects) {
    resume.projects = parseExperience(buckets.projects).map((e) => ({
      id: e.id,
      name: e.role || e.company,
      link: '',
      start: e.start,
      end: e.end,
      bullets: e.bullets,
    }));
  }
  if (buckets.education) {
    resume.education = buckets.education
      .filter((t) => !BULLET_RE.test(t))
      .slice(0, 4)
      .map((t) => ({
        id: newId(),
        school: t,
        degree: '',
        location: '',
        start: '',
        end: '',
        details: '',
      }));
  }
  if (buckets.skills) {
    const items = buckets.skills
      .join(', ')
      .split(/[,•·|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 30);
    if (items.length) resume.skills = [{ id: newId(), name: 'Skills', items: [...new Set(items)].slice(0, 30) }];
  }

  return resume;
}

// Turn a flat list of lines into experience entries. Heuristic: a non-bullet
// line begins a new entry (company/role); bullet lines attach to it.
function parseExperience(lines: string[]): Resume['experience'] {
  const entries: Resume['experience'] = [];
  let cur: Resume['experience'][number] | null = null;

  const pushCur = () => {
    if (cur && (cur.company || cur.role || cur.bullets.length)) entries.push(cur);
  };

  for (const raw of lines) {
    if (BULLET_RE.test(raw)) {
      const clean = raw.replace(BULLET_RE, '').trim();
      if (!cur) {
        cur = blankExp();
      }
      if (clean) cur.bullets.push(clean);
    } else {
      pushCur();
      cur = blankExp();
      // Try to split "Role — Company | Dates"
      const dates = raw.match(/((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4})\s*[–\-—to]+\s*(present|current|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{4})/i);
      if (dates) {
        cur.start = dates[1];
        cur.end = dates[3] ?? '';
      }
      const head = raw.replace(dates?.[0] ?? '', '').replace(/[|·]/g, '-').trim();
      const segs = head.split(/\s+[-–—]\s+|\s+at\s+/i).map((s) => s.trim()).filter(Boolean);
      cur.role = segs[0] ?? head;
      cur.company = segs[1] ?? '';
    }
  }
  pushCur();
  return entries.slice(0, 8);
}

function blankExp(): Resume['experience'][number] {
  return { id: newId(), company: '', role: '', location: '', start: '', end: '', bullets: [] };
}

import type { Resume } from './types';
import { extractKeywords, keywordPresent, type Keyword } from './keywords';

// ---- Text helpers -----------------------------------------------------------

export function allBullets(resume: Resume): string[] {
  const b: string[] = [];
  resume.experience.forEach((e) => b.push(...e.bullets));
  resume.projects.forEach((p) => b.push(...p.bullets));
  return b.filter((t) => t.trim().length > 0);
}

export function resumeToText(resume: Resume): string {
  const parts: string[] = [];
  const c = resume.contact;
  parts.push(c.name, c.title, c.email, c.phone, c.location);
  c.links.forEach((l) => parts.push(l.label, l.url));
  parts.push(resume.summary);
  resume.experience.forEach((e) => {
    parts.push(e.role, e.company, e.location, e.start, e.end, ...e.bullets);
  });
  resume.education.forEach((e) => parts.push(e.school, e.degree, e.location, e.details));
  resume.skills.forEach((s) => parts.push(s.name, ...s.items));
  resume.projects.forEach((p) => parts.push(p.name, p.link, ...p.bullets));
  resume.certifications.forEach((c2) => parts.push(c2.name, c2.issuer, c2.date));
  return parts.filter(Boolean).join('\n');
}

// ---- Lexicons ---------------------------------------------------------------

const STRONG_VERBS = new Set(
  `led built designed developed launched shipped drove delivered reduced increased improved optimized automated created architected implemented scaled grew
  spearheaded owned managed mentored streamlined accelerated generated negotiated analyzed established founded transformed redesigned migrated integrated`
    .split(/\s+/)
    .filter(Boolean)
);

const WEAK_STARTS = [
  'responsible for',
  'worked on',
  'helped',
  'assisted',
  'involved in',
  'participated in',
  'tasked with',
  'duties included',
];

export function bulletHasNumber(b: string): boolean {
  return /\d/.test(b) && /(\d+%|\$\d|\d[\d,.]*\s*(x|k|m|bn|users|customers|hours|weeks|days|percent|pts))|\b\d+%|\b\d[\d,.]*\b/i.test(b);
}

export function bulletStartsWeak(b: string): boolean {
  const lower = b.trim().toLowerCase();
  return WEAK_STARTS.some((w) => lower.startsWith(w));
}

export function bulletStartsStrong(b: string): boolean {
  const first = b.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, '') ?? '';
  return STRONG_VERBS.has(first);
}

// ---- Score model ------------------------------------------------------------

export interface ScoreBreakdown {
  label: string;
  score: number; // 0-100
  detail: string;
}

export interface Actionable {
  id: string;
  label: string;
  done: boolean;
  source: 'ats' | 'jd';
}

export interface Analysis {
  atsScore: number; // 0-100
  jdMatchScore: number | null; // 0-100, null when no JD
  breakdown: ScoreBreakdown[];
  keywords: Array<Keyword & { present: boolean }>;
  coverage: { critical: [number, number]; important: [number, number]; optional: [number, number] };
  actionables: Actionable[];
  stats: {
    words: number;
    bullets: number;
    bulletsWithNumbers: number;
    weakBullets: number;
    strongBullets: number;
  };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function analyze(resume: Resume, jd: string): Analysis {
  const text = resumeToText(resume);
  const textLower = text.toLowerCase();
  const bullets = allBullets(resume);
  const words = text.split(/\s+/).filter(Boolean).length;

  const withNumbers = bullets.filter(bulletHasNumber).length;
  const weak = bullets.filter(bulletStartsWeak).length;
  const strong = bullets.filter(bulletStartsStrong).length;

  const c = resume.contact;
  const hasEmail = /\S+@\S+\.\S+/.test(c.email);
  const hasPhone = /\d{7,}/.test(c.phone.replace(/[^\d]/g, ''));
  const hasName = c.name.trim().length > 0;
  const hasLinks = c.links.some((l) => l.url.trim());
  const hasSummary = resume.summary.trim().length >= 30;
  const hasExperience = resume.experience.length > 0;
  const hasEducation = resume.education.length > 0;
  const hasSkills = resume.skills.some((s) => s.items.length > 0);

  // --- Keyword coverage (drives JD match + keyword sub-score) ---
  const kws = extractKeywords(jd);
  const keywords = kws.map((k) => ({ ...k, present: keywordPresent(k, textLower) }));
  const coverage = {
    critical: tally(keywords, 'critical'),
    important: tally(keywords, 'important'),
    optional: tally(keywords, 'optional'),
  };
  const keywordScore = keywords.length
    ? weightedCoverage(keywords)
    : 100; // no JD => don't penalize

  // --- Sub-scores ---
  const atsCompat = clamp(
    scoreBools([
      [hasName, 15],
      [hasEmail, 20],
      [hasPhone, 15],
      [hasExperience, 20],
      [hasEducation, 10],
      [hasSkills, 20],
    ])
  );

  const impact = clamp(
    bullets.length === 0 ? 0 : 40 * (withNumbers / bullets.length) + 40 * (strong / bullets.length) + 20 * (1 - weak / bullets.length)
  );

  const avgLen = bullets.length ? bullets.reduce((s, b) => s + b.split(/\s+/).length, 0) / bullets.length : 0;
  const idealLen = avgLen >= 8 && avgLen <= 24;
  const notTooFew = bullets.length >= 4;
  const readability = clamp(
    scoreBools([
      [idealLen, 40],
      [notTooFew, 25],
      [hasSummary, 20],
      [weak / Math.max(1, bullets.length) < 0.3, 15],
    ])
  );

  const datesConsistent = resume.experience.every((e) => e.start && e.end);
  const formatting = clamp(
    scoreBools([
      [datesConsistent || !hasExperience, 35],
      [hasLinks, 20],
      [resume.skills.length > 0, 20],
      [words >= 150 && words <= 900, 25],
    ])
  );

  const breakdown: ScoreBreakdown[] = [
    { label: 'ATS Compatibility', score: atsCompat, detail: 'Core sections + parseable contact info.' },
    { label: 'Impact', score: impact, detail: `${withNumbers}/${bullets.length || 0} bullets have measurable numbers.` },
    { label: 'Recruiter Readability', score: readability, detail: `Avg bullet ${Math.round(avgLen)} words (ideal 8–24).` },
    { label: 'Formatting', score: formatting, detail: 'Consistent dates, links, and length.' },
    { label: 'Keyword Match', score: clamp(keywordScore), detail: jd.trim() ? `${keywords.filter((k) => k.present).length}/${keywords.length} JD keywords found.` : 'Paste a job description to score.' },
  ];

  // Overall ATS score: weighted blend (keyword match folded in lightly so the
  // ATS number still means something without a JD).
  const atsScore = clamp(
    atsCompat * 0.3 + impact * 0.25 + readability * 0.2 + formatting * 0.15 + keywordScore * 0.1
  );

  // JD match is keyword-coverage heavy, plus a nod to impact/readability
  // (recruiter's eyes), only when a JD exists.
  const jdMatchScore = jd.trim() ? clamp(keywordScore * 0.7 + impact * 0.15 + readability * 0.15) : null;

  // --- Actionables ---
  const actionables: Actionable[] = [
    a('email', 'Add a professional email address', hasEmail),
    a('phone', 'Add a phone number', hasPhone),
    a('links', 'Add a LinkedIn or portfolio link', hasLinks),
    a('summary', 'Write a 2–3 line summary', hasSummary),
    a('experience', 'Add at least one work experience', hasExperience),
    a('skills', 'List your key skills', hasSkills),
    a('education', 'Add your education', hasEducation),
    a('bullets-count', 'Have at least 4 achievement bullets', bullets.length >= 4),
    a('quantify', 'Quantify at least half of your bullets with numbers', bullets.length > 0 && withNumbers / bullets.length >= 0.5),
    a('weak-verbs', 'Replace weak openers like "Responsible for" / "Worked on"', bullets.length > 0 && weak === 0),
    a('length', 'Keep the resume between 150–900 words', words >= 150 && words <= 900),
  ];

  // JD-derived actionables: one per missing critical/important keyword.
  for (const k of keywords) {
    if (k.present) continue;
    if (k.tier === 'optional') continue;
    actionables.push({
      id: `jd-${k.canonical}`,
      label: `Add or reword to include "${k.term}" (${k.tier} in JD)`,
      done: false,
      source: 'jd',
    });
  }

  return {
    atsScore,
    jdMatchScore,
    breakdown,
    keywords,
    coverage,
    actionables,
    stats: {
      words,
      bullets: bullets.length,
      bulletsWithNumbers: withNumbers,
      weakBullets: weak,
      strongBullets: strong,
    },
  };
}

// ---- small helpers ----------------------------------------------------------

function a(id: string, label: string, done: boolean): Actionable {
  return { id, label, done, source: 'ats' };
}

function scoreBools(pairs: Array<[boolean, number]>): number {
  return pairs.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
}

function tally(keywords: Array<Keyword & { present: boolean }>, tier: Keyword['tier']): [number, number] {
  const inTier = keywords.filter((k) => k.tier === tier);
  return [inTier.filter((k) => k.present).length, inTier.length];
}

function weightedCoverage(keywords: Array<Keyword & { present: boolean }>): number {
  const weight = { critical: 3, important: 2, optional: 1 } as const;
  let got = 0;
  let total = 0;
  for (const k of keywords) {
    total += weight[k.tier];
    if (k.present) got += weight[k.tier];
  }
  return total === 0 ? 100 : (got / total) * 100;
}

// Pass 2 deterministic analysis: per-bullet ratings (for the preview heatmap),
// writing-issue detection, resume analytics, structure checks, and an enhanced
// JD analyzer. No AI — all rule-based and explainable.

import type { Resume } from './types';
import { SECTION_LABELS } from './types';
import { bulletHasNumber, bulletStartsWeak, bulletStartsStrong } from './scoring';
import { extractKeywords, keywordPresent, type Keyword } from './keywords';

// ---- Per-bullet rating (pure; used by the preview overlay) ------------------

export type BulletRating = 'strong' | 'ok' | 'weak';

export interface BulletCheck {
  rating: BulletRating;
  hasNumber: boolean;
  strongVerb: boolean;
  weakStart: boolean;
  passive: boolean;
  words: number;
  reasons: string[];
}

const PASSIVE_RE =
  /\b(was|were|is|are|been|being|be)\s+(\w+ed|built|done|made|shown|given|taken|written|led|driven|chosen|sent|kept|held|brought|sold|paid|found|met|run)\b/i;

export function firstWord(text: string): string {
  return (text.trim().split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

export function checkBullet(text: string): BulletCheck {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const hasNumber = bulletHasNumber(text);
  const strongVerb = bulletStartsStrong(text);
  const weakStart = bulletStartsWeak(text);
  const passive = PASSIVE_RE.test(text);

  const reasons: string[] = [];
  if (weakStart) reasons.push('Starts with a weak phrase — open with an action verb.');
  if (!hasNumber) reasons.push('Add a measurable result (%, $, count, or time).');
  if (passive) reasons.push('Passive voice — rewrite in active voice.');
  if (!strongVerb && !weakStart) reasons.push('Open with a stronger action verb (Led, Built, Reduced…).');
  if (words > 32) reasons.push('Long bullet — tighten toward a single line.');
  if (words > 0 && words < 4) reasons.push('Too short to convey impact.');

  let rating: BulletRating;
  if (strongVerb && hasNumber && !passive) rating = 'strong';
  else if (weakStart || (!strongVerb && !hasNumber) || (words > 0 && words < 4)) rating = 'weak';
  else rating = 'ok';

  return { rating, hasNumber, strongVerb, weakStart, passive, words, reasons };
}

// ---- Full resume analysis ---------------------------------------------------

export interface FlaggedBullet {
  section: string; // display label + item
  text: string;
  check: BulletCheck;
}

export interface Repetition {
  verb: string;
  count: number;
}

export interface Analytics {
  words: number;
  bullets: number;
  bulletsWithNumbers: number;
  avgBulletWords: number;
  longestBulletWords: number;
  actionVerbs: number;
  passiveSentences: number;
  readabilityGrade: number;
  readingTimeSec: number;
}

export interface StructureCheck {
  missingSections: string[];
  timelineGaps: string[];
  lengthWarnings: string[];
  balance: { experience: number; projects: number; skills: number };
  orderingSuggestions: string[];
}

export interface JdBreakdown {
  technical: Array<Keyword & { present: boolean }>;
  soft: Array<Keyword & { present: boolean }>;
  skillGap: string[]; // missing critical/important terms
}

export interface DeepAnalysis {
  flagged: FlaggedBullet[];
  repetitions: Repetition[];
  analytics: Analytics;
  structure: StructureCheck;
  jd: JdBreakdown | null;
}

const SOFT_SKILLS = new Set([
  'leadership',
  'stakeholder management',
  'communication',
  'collaboration',
  'ownership',
  'mentoring',
  'teamwork',
  'problem solving',
  'strategy',
  'negotiation',
  'cross-functional',
]);

function labelForBullet(resume: Resume): FlaggedBullet[] {
  const flagged: FlaggedBullet[] = [];
  const consider = (sectionLabel: string, title: string, bullets: string[]) => {
    bullets
      .filter((b) => b.trim())
      .forEach((b) => {
        const check = checkBullet(b);
        if (check.rating !== 'strong') {
          flagged.push({ section: `${sectionLabel} · ${title}`, text: b, check });
        }
      });
  };
  resume.experience.forEach((e) => consider(SECTION_LABELS.experience, e.role || e.company || 'Role', e.bullets));
  resume.projects.forEach((p) => consider(SECTION_LABELS.projects, p.name || 'Project', p.bullets));
  return flagged;
}

function detectRepetitions(resume: Resume): Repetition[] {
  const verbs: Record<string, number> = {};
  const all = [...resume.experience.flatMap((e) => e.bullets), ...resume.projects.flatMap((p) => p.bullets)];
  for (const b of all) {
    if (!b.trim()) continue;
    const v = firstWord(b);
    if (v.length < 3) continue;
    verbs[v] = (verbs[v] ?? 0) + 1;
  }
  return Object.entries(verbs)
    .filter(([, c]) => c > 2)
    .map(([verb, count]) => ({ verb, count }))
    .sort((a, b) => b.count - a.count);
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  const groups = w.match(/[aeiouy]+/g);
  let n = groups ? groups.length : 1;
  if (w.endsWith('e') && n > 1) n -= 1;
  return Math.max(1, n);
}

function computeAnalytics(resume: Resume): Analytics {
  const bullets = [...resume.experience.flatMap((e) => e.bullets), ...resume.projects.flatMap((p) => p.bullets)].filter((b) => b.trim());
  const summarySentences = resume.summary.split(/[.!?]+/).filter((s) => s.trim().length > 3);

  const textPieces = [resume.summary, ...bullets];
  const allWords = textPieces.join(' ').split(/\s+/).filter(Boolean);
  const words = allWords.length;
  const syllables = allWords.reduce((s, w) => s + countSyllables(w), 0);
  const sentences = Math.max(1, bullets.length + summarySentences.length);

  const bulletWordCounts = bullets.map((b) => b.split(/\s+/).filter(Boolean).length);
  const avgBulletWords = bullets.length ? Math.round(bulletWordCounts.reduce((a, b) => a + b, 0) / bullets.length) : 0;
  const longestBulletWords = bulletWordCounts.length ? Math.max(...bulletWordCounts) : 0;

  const grade = words > 0 ? 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59 : 0;

  return {
    words,
    bullets: bullets.length,
    bulletsWithNumbers: bullets.filter(bulletHasNumber).length,
    avgBulletWords,
    longestBulletWords,
    actionVerbs: bullets.filter(bulletStartsStrong).length,
    passiveSentences: bullets.filter((b) => PASSIVE_RE.test(b)).length,
    readabilityGrade: Math.max(0, Math.round(grade * 10) / 10),
    // Recruiter skim estimate (not a full read); ideal band is ~20–35s.
    readingTimeSec: Math.max(5, Math.round(words / 15)),
  };
}

function firstYear(s: string): number | null {
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : null;
}

function computeStructure(resume: Resume): StructureCheck {
  // Missing sections
  const missing: string[] = [];
  if (resume.summary.trim().length < 20) missing.push('Summary');
  if (!resume.experience.length) missing.push('Experience');
  if (!resume.skills.some((s) => s.items.length)) missing.push('Skills');
  if (!resume.education.length) missing.push('Education');
  if (!resume.contact.links.some((l) => l.url.trim())) missing.push('Links (LinkedIn / portfolio)');

  // Timeline gaps (only when both years parse)
  const dated = resume.experience
    .map((e) => ({ role: e.role || e.company, start: firstYear(e.start), end: /present|current/i.test(e.end) ? new Date().getFullYear() : firstYear(e.end) }))
    .filter((e) => e.start !== null)
    .sort((a, b) => (a.start! - b.start!));
  const gaps: string[] = [];
  for (let i = 0; i < dated.length - 1; i++) {
    const cur = dated[i];
    const next = dated[i + 1];
    if (cur.end !== null && next.start !== null && next.start - cur.end > 1) {
      gaps.push(`${cur.end} → ${next.start}: a ${next.start - cur.end}-year gap between roles.`);
    }
  }

  // Experience length warnings
  const lengthWarnings: string[] = [];
  resume.experience.forEach((e) => {
    const n = e.bullets.filter((b) => b.trim()).length;
    const title = e.role || e.company || 'A role';
    if (n === 0) lengthWarnings.push(`${title} has no bullets.`);
    else if (n === 1) lengthWarnings.push(`${title} has only 1 bullet — add 1–2 more.`);
    else if (n > 6) lengthWarnings.push(`${title} has ${n} bullets — trim to your top 4–6.`);
  });

  // Balance
  const expBullets = resume.experience.reduce((s, e) => s + e.bullets.filter((b) => b.trim()).length, 0);
  const projBullets = resume.projects.reduce((s, p) => s + p.bullets.filter((b) => b.trim()).length, 0);
  const skillCount = resume.skills.reduce((s, g) => s + g.items.length, 0);
  const total = expBullets + projBullets + skillCount || 1;
  const balance = {
    experience: Math.round((expBullets / total) * 100),
    projects: Math.round((projBullets / total) * 100),
    skills: Math.round((skillCount / total) * 100),
  };

  // Ordering suggestions
  const ordering: string[] = [];
  const order = resume.sectionOrder;
  const idx = (k: string) => order.indexOf(k as never);
  if (resume.experience.length && idx('education') !== -1 && idx('education') < idx('experience')) {
    ordering.push('Move Experience above Education — you have work history to lead with.');
  }
  if (resume.experience.length && idx('projects') !== -1 && idx('projects') < idx('experience') && resume.projects.length) {
    ordering.push('Place Experience before Projects for an experienced profile.');
  }
  if (resume.summary.trim() && idx('summary') > 0) {
    ordering.push('Keep the Summary at the top so recruiters see it first.');
  }

  return { missingSections: missing, timelineGaps: gaps, lengthWarnings, balance, orderingSuggestions: ordering };
}

function computeJd(resume: Resume, jd: string): JdBreakdown | null {
  if (!jd.trim()) return null;
  const textLower = resumeTextLower(resume);
  const keywords = extractKeywords(jd).map((k) => ({ ...k, present: keywordPresent(k, textLower) }));
  const technical = keywords.filter((k) => !SOFT_SKILLS.has(k.canonical));
  const soft = keywords.filter((k) => SOFT_SKILLS.has(k.canonical));
  const skillGap = keywords.filter((k) => !k.present && k.tier !== 'optional').map((k) => k.term);
  return { technical, soft, skillGap };
}

function resumeTextLower(resume: Resume): string {
  const parts: string[] = [resume.summary];
  resume.experience.forEach((e) => parts.push(e.role, e.company, ...e.bullets));
  resume.projects.forEach((p) => parts.push(p.name, ...p.bullets));
  resume.skills.forEach((s) => parts.push(s.name, ...s.items));
  resume.certifications.forEach((c) => parts.push(c.name));
  return parts.filter(Boolean).join('\n').toLowerCase();
}

export function deepAnalyze(resume: Resume, jd: string): DeepAnalysis {
  return {
    flagged: labelForBullet(resume),
    repetitions: detectRepetitions(resume),
    analytics: computeAnalytics(resume),
    structure: computeStructure(resume),
    jd: computeJd(resume, jd),
  };
}

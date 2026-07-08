// Deterministic, content-level diff between two resume snapshots. Used by the
// Versions menu to show what changed since a saved version.

import type { Resume } from './types';
import { stripInline } from './inlineFormat';

export interface ResumeDiff {
  added: string[]; // present in `b` but not `a`
  removed: string[]; // present in `a` but not `b`
  changedCount: number;
}

// Flattens a resume into a set of comparable content lines.
function gatherLines(r: Resume): string[] {
  const lines: string[] = [];
  const push = (label: string, value: string) => {
    const v = stripInline(value).trim();
    if (v) lines.push(`${label}: ${v}`);
  };
  push('Name', r.contact.name);
  push('Title', r.contact.title);
  if (r.summary.trim()) push('Summary', r.summary);
  r.experience.forEach((e) => {
    push('Role', `${e.role} — ${e.company}`);
    e.bullets.forEach((b) => push('Bullet', b));
  });
  r.projects.forEach((p) => {
    push('Project', p.name);
    p.bullets.forEach((b) => push('Bullet', b));
  });
  r.skills.forEach((g) => g.items.forEach((s) => push('Skill', s)));
  r.education.forEach((e) => push('Education', `${e.school} ${e.degree}`));
  r.certifications.forEach((c) => push('Cert', c.name));
  return lines;
}

export function diffResumes(a: Resume, b: Resume): ResumeDiff {
  const linesA = new Set(gatherLines(a));
  const linesB = new Set(gatherLines(b));
  const added = [...linesB].filter((l) => !linesA.has(l));
  const removed = [...linesA].filter((l) => !linesB.has(l));
  return { added, removed, changedCount: added.length + removed.length };
}

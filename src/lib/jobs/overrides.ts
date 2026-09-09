// Pure mutators over UserOverrides.
//
// Every function here returns a NEW UserOverrides - never mutates its input -
// so the zustand store in overridesStore.ts can hand these straight to `set`.
//
// The one subtlety worth documenting: merge and split are both stored as
// pairwise sets, and correlate.ts's join predicate checks split (J0) BEFORE
// merge (J2). If the user splits two threads and later changes their mind and
// merges them, a stale split pair would silently veto the merge - the button
// would appear to do nothing. So every merge here strips any overlapping split
// pairs, and every split strips any overlapping merge pairs. The reverse
// operation always wins, because it is the more recent one.

import type { FieldOverride, JobStatus, ManualApplication, UserOverrides } from './types';

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function pairsOf(group: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) out.push(pairKey(group[i], group[j]));
  }
  return out;
}

/** Drops any group from `groups` that shares a pair with `ids`. */
function dropOverlapping(groups: string[][], ids: string[]): string[][] {
  const incoming = new Set(pairsOf(ids));
  return groups.filter((g) => !pairsOf(g).some((p) => incoming.has(p)));
}

/** Force these threads into one application. Clears any split between them. */
export function mergeThreads(o: UserOverrides, threadIds: string[]): UserOverrides {
  const ids = Array.from(new Set(threadIds)).sort();
  if (ids.length < 2) return o;
  return {
    ...o,
    split: dropOverlapping(o.split, ids),
    merge: [...o.merge.filter((g) => !sameSet(g, ids)), ids],
  };
}

/** Force these threads apart. Clears any merge between them. */
export function splitThreads(o: UserOverrides, threadIds: string[]): UserOverrides {
  const ids = Array.from(new Set(threadIds)).sort();
  if (ids.length < 2) return o;
  return {
    ...o,
    merge: dropOverlapping(o.merge, ids),
    split: [...o.split.filter((g) => !sameSet(g, ids)), ids],
  };
}

/** Removes a thread from every merge/split group and un-splits its old pairs. */
export function resetThread(o: UserOverrides, threadId: string): UserOverrides {
  return {
    ...o,
    merge: o.merge.map((g) => g.filter((id) => id !== threadId)).filter((g) => g.length > 1),
    split: o.split.map((g) => g.filter((id) => id !== threadId)).filter((g) => g.length > 1),
  };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((x, i) => x === sb[i]);
}

export function setField(o: UserOverrides, appId: string, patch: FieldOverride): UserOverrides {
  const existing = o.fields[appId] ?? {};
  const merged = { ...existing, ...patch };
  // Drop keys explicitly cleared with an empty string / undefined, so the
  // pipeline's own value shows through again rather than storing "".
  for (const k of Object.keys(merged) as (keyof FieldOverride)[]) {
    if (merged[k] === '' || merged[k] === undefined) delete merged[k];
  }
  const fields = { ...o.fields };
  if (Object.keys(merged).length === 0) delete fields[appId];
  else fields[appId] = merged;
  return { ...o, fields };
}

export function clearField(o: UserOverrides, appId: string): UserOverrides {
  if (!(appId in o.fields)) return o;
  const fields = { ...o.fields };
  delete fields[appId];
  return { ...o, fields };
}

export function setStatus(o: UserOverrides, appId: string, status: JobStatus): UserOverrides {
  return setField(o, appId, { status });
}

export function setArchived(o: UserOverrides, appId: string, archived: boolean): UserOverrides {
  return setField(o, appId, { archived });
}

export function setNotes(o: UserOverrides, appId: string, notes: string): UserOverrides {
  return setField(o, appId, { notes });
}

export function renameCompany(o: UserOverrides, appId: string, company: string): UserOverrides {
  return setField(o, appId, { company });
}

export function renameRole(o: UserOverrides, appId: string, role: string): UserOverrides {
  return setField(o, appId, { role });
}

// ---- Manual applications ----------------------------------------------------

let manualSeq = 0;
/** Collision-resistant without a uuid dependency: time plus a session counter. */
function manualId(): string {
  manualSeq += 1;
  return `manual:${Date.now().toString(36)}-${manualSeq.toString(36)}`;
}

export function addManual(
  o: UserOverrides,
  input: { company: string; role?: string; status: JobStatus; notes?: string },
  now: number
): { overrides: UserOverrides; id: string } {
  const id = manualId();
  const entry: ManualApplication = {
    id,
    company: input.company.trim(),
    role: input.role?.trim() || undefined,
    status: input.status,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
  };
  return { overrides: { ...o, manual: [...o.manual, entry] }, id };
}

export function updateManual(
  o: UserOverrides,
  id: string,
  patch: Partial<Omit<ManualApplication, 'id' | 'createdAt'>>
): UserOverrides {
  return {
    ...o,
    manual: o.manual.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  };
}

export function removeManual(o: UserOverrides, id: string): UserOverrides {
  return { ...o, manual: o.manual.filter((m) => m.id !== id) };
}

// ---- Review-drawer triage ---------------------------------------------------

export function dismissReview(o: UserOverrides, threadId: string): UserOverrides {
  if (o.dismissedReview.includes(threadId)) return o;
  return { ...o, dismissedReview: [...o.dismissedReview, threadId] };
}

export function undismissReview(o: UserOverrides, threadId: string): UserOverrides {
  if (!o.dismissedReview.includes(threadId)) return o;
  return { ...o, dismissedReview: o.dismissedReview.filter((id) => id !== threadId) };
}

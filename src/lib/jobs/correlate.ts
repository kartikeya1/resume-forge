// Thread -> application correlation.
//
// One application routinely spans several Gmail threads with different subject
// lines. Revolut is three (confirmation, rejection two hours later, talent
// pool). JPMorgan's application and rejection share no words at all and
// correlate only through "Job Number: 210769925" vs "Job number: 210769925".
// Civica is two Workable threads plus a human recruiter thread.
//
// At the same time Meesho's "Product Manager II - AI" and "Product Manager II -
// Experience" are genuinely two applications and must never merge. Getting one
// of those wrong is invisible to the user; that is why the join predicate is an
// explicit ordered ladder rather than a similarity score.

import { companyKey, normalizeSubject, parseRoleKey, roleCompatible, type ParsedRole, type ReqId } from './normalize';
import type { AgentHint, AppEvent, Field, ThreadKind, UserOverrides } from './types';

export interface ThreadCandidate {
  threadId: string;
  kind: ThreadKind;
  vendor?: string;
  company: Field<string> | null;
  companyKey: string;
  role: Field<string> | null;
  parsedRole: ParsedRole | null;
  reqIds: ReqId[];
  events: AppEvent[];
  firstAt: number;
  lastAt: number;
  hint?: AgentHint;
  needsReview: boolean;
  /** classifyThread's rule-firing trail, for the UI's "why?" popover. */
  classificationReasons: string[];
}

export interface CorrelateOptions {
  now: number;
  overrides?: UserOverrides;
  /** Cross-thread soft joins only. Within one Gmail thread there is no window. */
  softJoinWindowDays?: number;
}

const DEFAULT_WINDOW_DAYS = 240;
const DAY = 24 * 3600_000;
const HOUR = 3600_000;

// ---- Event dedupe ----------------------------------------------------------

/**
 * Collapse byte-identical repeats, but ONLY inside a short window.
 *
 * Paytm sent its rejection three times within minutes - one event. Toptal sent
 * "Take the Next Step in the Toptal Screening Process" twice, days apart - two
 * events, and that gap is the entire evidence that he ignored the process.
 *
 * The window is one hour, not one day, and that is measured rather than
 * guessed: the real Toptal nudges are 23.96 hours apart, so a 24-hour window
 * collapsed them. Paytm's three copies are seven minutes apart.
 */
export function dedupeEvents(events: AppEvent[], windowMs = HOUR): AppEvent[] {
  const sorted = [...events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const kept: AppEvent[] = [];
  for (const e of sorted) {
    const key = `${e.from}|${normalizeSubject(e.subject)}`;
    const prior = kept.find(
      (k) => `${k.from}|${normalizeSubject(k.subject)}` === key && e.at - k.at <= windowMs
    );
    if (prior) {
      prior.duplicateCount = (prior.duplicateCount ?? 1) + 1;
      continue;
    }
    kept.push({ ...e });
  }
  return kept;
}

// ---- Union-find ------------------------------------------------------------

class DSU {
  private parent = new Map<string, string>();
  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    // Lexicographic root keeps the result independent of input order.
    if (ra === rb) return;
    if (ra < rb) this.parent.set(rb, ra);
    else this.parent.set(ra, rb);
  }
}

// ---- Join predicate --------------------------------------------------------

export type JoinVerdict = { join: boolean; ruleId: string };

interface JoinContext {
  windowMs: number;
  splitPairs: Set<string>;
  mergePairs: Set<string>;
  /** companyKey -> distinct known roleKeys. Guards the Meesho null-role case. */
  rolesByCompany: Map<string, Set<string>>;
  /** roleKey -> how many candidates carry it. Used for discriminativeness. */
  roleKeyCounts: Map<string, number>;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function highTrust(ids: ReqId[]): string[] {
  return ids.filter((r) => r.trust === 'high').map((r) => r.id);
}

/**
 * A role can anchor a merge across an unknown company only if it carries a
 * qualifier that is unique to this pair. "SPM - Polo" can (Primetrace). A bare
 * "Senior Product Manager" cannot - Keka sends that identical subject for both
 * GoKwik and Blitz, and merging them would invent an application.
 */
export function isDiscriminativeRole(roleKey: string, counts: Map<string, number>): boolean {
  const { qualifiers } = parseRoleKey(roleKey);
  if (qualifiers.length === 0) return false;
  return (counts.get(roleKey) ?? 0) === 2;
}

export function shouldJoin(a: ThreadCandidate, b: ThreadCandidate, ctx: JoinContext): JoinVerdict {
  const pk = pairKey(a.threadId, b.threadId);

  // J0/J1 - vetoes first. The user and the agent can always force a split.
  if (ctx.splitPairs.has(pk)) return { join: false, ruleId: 'J0-user-split' };
  if (a.hint?.distinctFrom?.includes(b.threadId) || b.hint?.distinctFrom?.includes(a.threadId)) {
    return { join: false, ruleId: 'J1-agent-distinct' };
  }

  // J2/J3 - forced merges.
  if (ctx.mergePairs.has(pk)) return { join: true, ruleId: 'J2-user-merge' };
  if (a.hint?.applicationKey && a.hint.applicationKey === b.hint?.applicationKey) {
    return { join: true, ruleId: 'J3-agent-application-key' };
  }

  // J4 - a shared requisition id is conclusive, and skips every other check.
  const ha = highTrust(a.reqIds);
  const hb = highTrust(b.reqIds);
  const shared = ha.filter((id) => hb.includes(id));
  if (shared.length) return { join: true, ruleId: 'J4-req-id' };

  // J5 - two DIFFERENT requisition ids mean two applications, even at the same
  // company for the same title. Must precede J6 or they wrongly merge.
  if (ha.length && hb.length) return { join: false, ruleId: 'J5-req-id-disjoint' };

  const withinWindow = Math.abs(a.firstAt - b.firstAt) <= ctx.windowMs;

  // J6 - same company, compatible roles, close enough in time.
  if (a.companyKey && b.companyKey && a.companyKey === b.companyKey) {
    if (!roleCompatible(a.parsedRole, b.parsedRole)) {
      return { join: false, ruleId: 'J6-role-incompatible' };
    }
    // The Meesho guard: a role-less thread must not silently attach to one of
    // two known roles at the same company. Non-deterministic and probably
    // wrong, so it stays separate and gets flagged for review instead.
    const known = ctx.rolesByCompany.get(a.companyKey);
    const oneSideUnknown = !a.parsedRole !== !b.parsedRole;
    if (oneSideUnknown && known && known.size > 1) {
      return { join: false, ruleId: 'J6-ambiguous-role-at-company' };
    }
    if (!withinWindow) return { join: false, ruleId: 'J6-outside-window' };
    return { join: true, ruleId: 'J6-company-role' };
  }

  // J7 - exactly one company unknown, bridged by a distinctive role.
  const aUnknown = !a.companyKey;
  const bUnknown = !b.companyKey;
  if (aUnknown !== bUnknown) {
    const ak = a.parsedRole?.key;
    const bk = b.parsedRole?.key;
    if (ak && bk && ak === bk && isDiscriminativeRole(ak, ctx.roleKeyCounts) && a.vendor === b.vendor && withinWindow) {
      return { join: true, ruleId: 'J7-discriminative-role' };
    }
  }

  return { join: false, ruleId: 'J8-default' };
}

// ---- Grouping --------------------------------------------------------------

export interface CandidateGroup {
  threadIds: string[];
  members: ThreadCandidate[];
  ruleIds: string[];
}

export function groupCandidates(
  candidates: ThreadCandidate[],
  o: CorrelateOptions
): CandidateGroup[] {
  const windowMs = (o.softJoinWindowDays ?? DEFAULT_WINDOW_DAYS) * DAY;
  const ov = o.overrides;

  const splitPairs = new Set<string>();
  for (const group of ov?.split ?? []) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) splitPairs.add(pairKey(group[i], group[j]));
  }
  const mergePairs = new Set<string>();
  for (const group of ov?.merge ?? []) {
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) mergePairs.add(pairKey(group[i], group[j]));
  }

  const rolesByCompany = new Map<string, Set<string>>();
  const roleKeyCounts = new Map<string, number>();
  for (const c of candidates) {
    if (c.parsedRole) {
      roleKeyCounts.set(c.parsedRole.key, (roleKeyCounts.get(c.parsedRole.key) ?? 0) + 1);
      if (c.companyKey) {
        const set = rolesByCompany.get(c.companyKey) ?? new Set<string>();
        set.add(c.parsedRole.key);
        rolesByCompany.set(c.companyKey, set);
      }
    }
  }

  const ctx: JoinContext = { windowMs, splitPairs, mergePairs, rolesByCompany, roleKeyCounts };
  const dsu = new DSU();
  const ruleIds = new Map<string, string[]>();

  // Sorted so the result never depends on the order threads arrived in.
  const sorted = [...candidates].sort((a, b) => a.threadId.localeCompare(b.threadId));
  sorted.forEach((c) => dsu.find(c.threadId));

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const verdict = shouldJoin(sorted[i], sorted[j], ctx);
      if (!verdict.join) continue;
      dsu.union(sorted[i].threadId, sorted[j].threadId);
      const root = dsu.find(sorted[i].threadId);
      const list = ruleIds.get(root) ?? [];
      if (!list.includes(verdict.ruleId)) list.push(verdict.ruleId);
      ruleIds.set(root, list);
    }
  }

  const byRoot = new Map<string, ThreadCandidate[]>();
  for (const c of sorted) {
    const root = dsu.find(c.threadId);
    const list = byRoot.get(root) ?? [];
    list.push(c);
    byRoot.set(root, list);
  }

  return Array.from(byRoot.entries())
    .map(([root, members]) => ({
      threadIds: members.map((m) => m.threadId).sort(),
      members,
      ruleIds: ruleIds.get(root) ?? [],
    }))
    .sort((a, b) => a.threadIds[0].localeCompare(b.threadIds[0]));
}

// ---- Stable identity -------------------------------------------------------

/**
 * Order-independent and re-import-stable, so user overrides survive a new
 * snapshot. Prefers the most durable key available.
 */
export function applicationKey(a: {
  companyKey: string;
  roleKey: string | null;
  reqIds: string[];
  threadIds: string[];
}): string {
  const anchor =
    [...a.reqIds].sort()[0] ?? a.roleKey ?? [...a.threadIds].sort()[0] ?? 'unknown';
  const co = a.companyKey || `unknown:${[...a.threadIds].sort()[0] ?? 'x'}`;
  return `${co}::${anchor}`;
}

/**
 * Re-key overrides whose application id changed between snapshots.
 *
 * An id legitimately changes when the agent later supplies a company that was
 * previously unknown (`unknown:t123::spm` becomes `blitz::spm`). Without this,
 * hand-written notes and manual statuses silently detach and the user's
 * corrections evaporate on the next refresh - which is why it ships now, even
 * though the editing UI comes later.
 */
export function reconcileOverrides(
  prev: { id: string; threadIds: string[] }[],
  next: { id: string; threadIds: string[] }[],
  overrides: UserOverrides
): UserOverrides {
  const prevById = new Map(prev.map((p) => [p.id, p]));
  const fields: UserOverrides['fields'] = {};

  for (const [id, value] of Object.entries(overrides.fields)) {
    if (next.some((n) => n.id === id)) {
      fields[id] = value; // still resolves - nothing to do
      continue;
    }
    const old = prevById.get(id);
    if (!old) {
      fields[id] = value; // unknown provenance; keep rather than discard
      continue;
    }
    // Re-home onto whichever new application shares the most threads.
    let best: { id: string; overlap: number } | null = null;
    for (const n of next) {
      const overlap = n.threadIds.filter((t) => old.threadIds.includes(t)).length;
      if (overlap > 0 && (!best || overlap > best.overlap)) best = { id: n.id, overlap };
    }
    if (best) fields[best.id] = { ...(fields[best.id] ?? {}), ...value };
    else fields[id] = value;
  }

  // merge/split/manual/dismissedReview are all keyed by thread ids or a
  // self-chosen id, never by the derived application id, so they need no
  // reconciliation at all - only `fields` can go stale.
  return {
    merge: overrides.merge,
    split: overrides.split,
    fields,
    manual: overrides.manual,
    dismissedReview: overrides.dismissedReview,
  };
}

export { companyKey };

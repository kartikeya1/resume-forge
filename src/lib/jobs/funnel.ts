// Phase 4 - insight: which kinds of application are worth your hours.
//
// Honesty constraint that shapes every function here: this module NEVER
// invents a fact. Company size, geography, and application channel were in
// the original Phase 4 scope, and none of them made it in - nothing in a
// Gmail thread reliably states a company's headcount or where a listing was
// posted, and guessing would break the one rule this whole build has held to
// since Phase 0. What IS reliably known from real mail: which ATS vendor
// carried the thread, what role title was applied for, and the event
// timeline. Everything below is built only from those.

import { isHumanSender } from './status';
import type { Application, EventType } from './types';

const DAY = 86_400_000;

// ---- Funnel ------------------------------------------------------------

/**
 * Whether a real application happened, independent of whether an explicit
 * applied/ack EVENT was ever captured. `lead` is status.ts's own R10 rule,
 * set specifically and only for "contacted but never applied" - every other
 * status implies a submission occurred. Tekion is the real case this exists
 * for: a human recruiter thread that opens directly on an interview
 * confirmation, with no acknowledgement email in between, leaves `appliedAt`
 * null even though he is plainly mid-interview. Gating on `appliedAt !== null`
 * instead would silently exclude exactly the direct/human-recruiter channel
 * this analysis most needs to measure.
 */
function actuallyApplied(app: Application): boolean {
  return app.status !== 'lead';
}

const REVIEW_EVENTS: EventType[] = ['under_review', 'shortlisted'];
const INTERVIEW_EVENTS: EventType[] = [
  'interview_invite', 'interview_scheduled', 'interview_reminder', 'interview_missed',
];

function hasEvent(app: Application, types: EventType[]): boolean {
  return app.events.some((e) => types.includes(e.type));
}

/**
 * Whether an application reached each stage, from its event HISTORY rather
 * than its current derived status - a rejected-after-interview application
 * must still count as having reached "interviewing". A manual entry has no
 * event trail at all, so its status is used as a floor: `interviewing`/`offer`
 * implies the earlier stages were reached even though no event proves it.
 */
export function stagesReached(app: Application): { reviewed: boolean; interviewing: boolean; offer: boolean } {
  if (app.threadIds.length === 0) {
    return {
      reviewed: app.status === 'interviewing' || app.status === 'offer',
      interviewing: app.status === 'interviewing' || app.status === 'offer',
      offer: app.status === 'offer',
    };
  }
  return {
    reviewed: hasEvent(app, REVIEW_EVENTS),
    interviewing: hasEvent(app, INTERVIEW_EVENTS) || app.status === 'interviewing',
    offer: hasEvent(app, ['offer']) || app.status === 'offer',
  };
}

export interface FunnelResult {
  /** Applications with a real submission, excluding leads never applied to. */
  applied: number;
  /** Explicit under-review/shortlisted signal only - see the caveat below. */
  reviewed: number;
  interviewing: number;
  offer: number;
  /**
   * Only the reliable transitions. `applied -> reviewed` is deliberately
   * absent: most ATS platforms never send an explicit "under review" email,
   * so `reviewed` chronically undercounts and a conversion rate built on it
   * would be more misleading than no rate at all. `reviewed` is still
   * reported as a standalone count with that caveat attached.
   */
  conversion: {
    appliedToInterviewing: number | null;
    interviewingToOffer: number | null;
    appliedToOffer: number | null;
  };
  reviewedIsFloor: true;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function buildFunnel(applications: Application[]): FunnelResult {
  const applied = applications.filter(actuallyApplied);
  let reviewed = 0, interviewing = 0, offer = 0;
  for (const app of applied) {
    const s = stagesReached(app);
    if (s.reviewed) reviewed++;
    if (s.interviewing) interviewing++;
    if (s.offer) offer++;
  }
  return {
    applied: applied.length,
    reviewed,
    interviewing,
    offer,
    conversion: {
      appliedToInterviewing: rate(interviewing, applied.length),
      interviewingToOffer: rate(offer, interviewing),
      appliedToOffer: rate(offer, applied.length),
    },
    reviewedIsFloor: true,
  };
}

// ---- Response timing -----------------------------------------------------

export interface DurationStats {
  n: number;
  medianDays: number | null;
  p25Days: number | null;
  p75Days: number | null;
  minDays: number | null;
  maxDays: number | null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function stats(daysList: number[]): DurationStats {
  if (daysList.length === 0) {
    return { n: 0, medianDays: null, p25Days: null, p75Days: null, minDays: null, maxDays: null };
  }
  const sorted = [...daysList].sort((a, b) => a - b);
  return {
    n: sorted.length,
    medianDays: Math.round(percentile(sorted, 0.5) * 10) / 10,
    p25Days: Math.round(percentile(sorted, 0.25) * 10) / 10,
    p75Days: Math.round(percentile(sorted, 0.75) * 10) / 10,
    minDays: Math.round(sorted[0] * 10) / 10,
    maxDays: Math.round(sorted[sorted.length - 1] * 10) / 10,
  };
}

/**
 * Time to the first REAL human reply, not the first automated ack - an ATS
 * confirmation usually lands in seconds and says nothing about how the
 * company is actually moving, so measuring it would just be measuring
 * software latency.
 */
export function timeToFirstHumanReply(applications: Application[]): DurationStats {
  const days: number[] = [];
  for (const app of applications) {
    if (app.appliedAt === null || !app.flags.recruiterReplied) continue;
    const firstHuman = app.events.find((e) => !e.fromMe && isHumanSender(e.from) && e.at >= app.appliedAt!);
    if (firstHuman) days.push((firstHuman.at - app.appliedAt) / DAY);
  }
  return stats(days);
}

export function timeToRejection(applications: Application[]): DurationStats {
  const days: number[] = [];
  for (const app of applications) {
    if (app.appliedAt === null) continue;
    const rejection = app.events.find((e) => e.type === 'rejection');
    if (rejection) days.push(Math.max(0, (rejection.at - app.appliedAt) / DAY));
  }
  return stats(days);
}

// ---- Ghost / reply rate ----------------------------------------------------

export interface ReplyRateResult {
  applied: number;
  /** Ever got a real human reply, regardless of current status. */
  everGotHumanReply: number;
  humanReplyRate: number | null;
  /** Never got one, at all - the honest "ghost rate" from the original brief. */
  neverGotHumanReply: number;
  ghostRate: number | null;
}

export function replyRate(applications: Application[]): ReplyRateResult {
  const applied = applications.filter(actuallyApplied);
  const withReply = applied.filter((a) => a.flags.recruiterReplied).length;
  return {
    applied: applied.length,
    everGotHumanReply: withReply,
    humanReplyRate: rate(withReply, applied.length),
    neverGotHumanReply: applied.length - withReply,
    ghostRate: rate(applied.length - withReply, applied.length),
  };
}

// ---- Breakdowns ------------------------------------------------------------

export interface BreakdownRow {
  key: string;
  label: string;
  applied: number;
  humanReplyRate: number | null;
  interviewingRate: number | null;
  offerRate: number | null;
}

/**
 * Below this sample size a rate is one data point away from swinging by 50%,
 * so the UI flags it rather than ranking on it as if it meant something.
 */
export const MIN_SAMPLE = 3;

function toBreakdown(groups: Map<string, { label: string; apps: Application[] }>): BreakdownRow[] {
  const rows: BreakdownRow[] = [];
  for (const [key, { label, apps }] of groups) {
    const applied = apps.filter(actuallyApplied);
    if (applied.length === 0) continue;
    const withReply = applied.filter((a) => a.flags.recruiterReplied).length;
    const interviewing = applied.filter((a) => stagesReached(a).interviewing).length;
    const withOffer = applied.filter((a) => stagesReached(a).offer).length;
    rows.push({
      key,
      label,
      applied: applied.length,
      humanReplyRate: rate(withReply, applied.length),
      interviewingRate: rate(interviewing, applied.length),
      offerRate: rate(withOffer, applied.length),
    });
  }
  // Larger samples first, so the rows worth trusting lead the table.
  return rows.sort((a, b) => b.applied - a.applied);
}

/** ATS vendor is the closest reliable proxy this data has to "channel". */
export function breakdownByVendor(applications: Application[]): BreakdownRow[] {
  const groups = new Map<string, { label: string; apps: Application[] }>();
  for (const app of applications) {
    const key = app.vendor ?? 'direct';
    const label = app.vendor ? app.vendor.replace(/_/g, ' ') : 'Direct / human recruiter';
    const g = groups.get(key) ?? { label, apps: [] };
    g.apps.push(app);
    groups.set(key, g);
  }
  return toBreakdown(groups);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Groups by the normalized role base (e.g. "senior product manager"). */
export function breakdownByRole(applications: Application[]): BreakdownRow[] {
  const groups = new Map<string, { label: string; apps: Application[] }>();
  for (const app of applications) {
    const base = app.roleKey?.split('#')[0];
    const key = base || 'unstated';
    const label = base ? titleCase(base) : 'Role not stated';
    const g = groups.get(key) ?? { label, apps: [] };
    g.apps.push(app);
    groups.set(key, g);
  }
  return toBreakdown(groups);
}

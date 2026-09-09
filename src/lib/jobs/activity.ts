// Search momentum: is he actually still applying?
//
// A tracker that only shows what is already in flight quietly rewards doing
// nothing - the dashboard looks calm precisely when no new applications are
// going out. This computes the one number that catches that.

import type { Application } from './types';

export interface ActivitySummary {
  /** Days since the most recent application was submitted. Null if never. */
  daysSinceLastApplication: number | null;
  lastApplicationAt: number | null;
  lastApplicationCompany: string | null;
  /** Applications submitted in the last 7 / 30 days. */
  appliedLast7: number;
  appliedLast30: number;
  /** True when the gap has exceeded the user's threshold. */
  nudge: boolean;
}

const DAY = 86_400_000;

export function summariseActivity(
  applications: Application[],
  applyNudgeDays: number,
  now: number
): ActivitySummary {
  let lastAt: number | null = null;
  let lastCompany: string | null = null;
  let last7 = 0;
  let last30 = 0;

  for (const app of applications) {
    // `appliedAt` is the applied/ack event, so a lead he never applied to and
    // a recruiter's cold outreach both correctly count for nothing here.
    const at = app.appliedAt;
    if (at === null) continue;
    if (lastAt === null || at > lastAt) {
      lastAt = at;
      lastCompany = app.company;
    }
    if (now - at <= 7 * DAY) last7 += 1;
    if (now - at <= 30 * DAY) last30 += 1;
  }

  const days = lastAt === null ? null : Math.max(0, Math.floor((now - lastAt) / DAY));
  return {
    daysSinceLastApplication: days,
    lastApplicationAt: lastAt,
    lastApplicationCompany: lastCompany,
    appliedLast7: last7,
    appliedLast30: last30,
    nudge: days !== null && days >= applyNudgeDays,
  };
}

/**
 * A prompt to paste into Claude Code, handing an interview off to the
 * `interview-prep` skill and `career-campaign` agent he already has.
 *
 * A copied prompt rather than a link because both of those are Claude Code
 * invocations, not URLs - there is no page to deep-link to.
 */
export function interviewPrepPrompt(app: Application): string {
  const role = app.role ? `the ${app.role} role` : 'the role';
  const when = app.flags.interviewAt
    ? ` The interview is on ${new Date(app.flags.interviewAt).toISOString().slice(0, 10)}.`
    : '';
  return `Prep me for my interview at ${app.company ?? 'this company'} for ${role}.${when} Use the interview-prep skill and pull what you need from whoami.`;
}

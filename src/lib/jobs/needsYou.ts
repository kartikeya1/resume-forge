// "Needs you": the single most important computation on the dashboard.
//
// Lives in src/lib rather than the component tree because it is a decision, not
// presentation - and this repo's tested core is src/lib.

import { CLOSED_STATUSES, formatDate } from './labels';
import type { Application } from './types';

/** An interview with no outcome for this long is worth chasing. */
const INTERVIEW_SILENCE_DAYS = 14;
/** Past this, a lapsed application is history rather than a to-do. */
const LAPSED_ACTIONABLE_DAYS = 60;

/**
 * Why an application needs him, in plain words. Null when it does not.
 *
 * This is the whole point of the page, so it deliberately errs towards
 * surfacing: a stalled interview and an unused referral are both things that
 * quietly disappear in Gmail, and both are recoverable if he sees them.
 */
export function needsYouReason(app: Application, now: number): string | null {
  const f = app.flags;
  if (CLOSED_STATUSES.has(app.status)) return null;

  if (f.interviewAt && f.interviewAt > now) return `Interview on ${formatDate(f.interviewAt)}`;
  if (f.recruiterReplied && f.awaitingMyReply) return 'A person is waiting on your reply';
  if (app.status === 'action_needed') return app.statusReason;

  // Interviewed, then silence. Nobody is going to chase this but him.
  if (app.status === 'interviewing' && f.staleDays > INTERVIEW_SILENCE_DAYS) {
    return `Interviewed ${f.staleDays} days ago with no outcome - worth following up`;
  }

  // A referral he never used is a live opportunity, not a closed one.
  if (app.status === 'lead') return 'An opening you have not applied to yet';

  // Recoverable, but only while it is still recent enough to be worth reviving.
  if (app.status === 'lapsed' && f.staleDays <= LAPSED_ACTIONABLE_DAYS) return app.statusReason;

  return null;
}

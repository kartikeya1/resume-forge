// A complete JobsSnapshot built from the real-mailbox fixtures, for driving
// the dashboard in a browser without touching his actual job-search data.
//
// `mailbox.ts` exports EmailThread[] arrays, which the pure pipeline tests
// feed straight into buildApplications. The dashboard needs a level above
// that: a snapshot envelope with a scan window and a generatedAt, because
// half the UI (the staleness pill, the stale banner, the footer's date range)
// exists to describe the envelope rather than the threads.
//
// Loaded only behind `?demo=1`, and only outside a production build - see the
// dynamic import in useSnapshot.ts.

import { SNAPSHOT_KIND, SNAPSHOT_VERSION, type JobsSnapshot } from '../snapshot';
import { ALL_NOISE, ALL_TRUE_POSITIVES, ME } from './mailbox';

const DAY = 86400_000;

/**
 * @param now  Anchors the snapshot's `generatedAt` and window. Passed in
 *   rather than read from the clock so the demo board is deterministic and so
 *   a caller can deliberately produce a stale one.
 * @param staleHoursAgo  How old to claim the snapshot is. The default of 4
 *   hours reads as fresh; pass something over 36 to exercise the stale banner
 *   and the amber freshness pill.
 */
export function demoSnapshot(now: number, staleHoursAgo = 4): JobsSnapshot {
  const generatedAt = now - staleHoursAgo * 3600_000;
  const threads = [...ALL_TRUE_POSITIVES, ...ALL_NOISE];
  return {
    kind: SNAPSHOT_KIND,
    version: SNAPSHOT_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    mailbox: ME,
    // 90 days back, matching the real backfill the runbook asks for.
    window: {
      since: new Date(generatedAt - 90 * DAY).toISOString(),
      until: new Date(generatedAt).toISOString(),
    },
    threads,
    counts: {
      scanned: threads.length,
      kept: ALL_TRUE_POSITIVES.length,
      skipped: ALL_NOISE.length,
    },
    agent: { model: 'demo', notes: 'Fixture data. Not a real mailbox.' },
  };
}

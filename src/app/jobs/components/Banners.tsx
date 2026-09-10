'use client';

import type { ActivitySummary } from '@/lib/jobs/activity';
import { buildRefreshPrompt } from '@/lib/jobs/syncPrompt';
import { CopyPromptBlock } from './CopyPromptBlock';
import { MUTED, TEXT } from './ui';

/**
 * The three things that interrupt: a stale snapshot, a file that needs one
 * click, and a stretch with no applications. All full-width above the board
 * rather than stacked into the scrolling column, so none of them can scroll
 * out of sight while still being true.
 */
export function Banners({
  stale,
  staleHours,
  needsPermission,
  activity,
  until,
  since,
  mailbox,
  now,
}: {
  stale: boolean;
  staleHours: number;
  needsPermission: boolean;
  activity: ActivitySummary | null;
  /** The snapshot window, so the refresh prompt asks for a delta not a rebuild. */
  until: string | null;
  since: string | null;
  mailbox?: string;
  now: number;
}) {
  if (!stale && !needsPermission && !activity?.nudge) return null;

  return (
    <div className="space-y-2 px-3 pt-2">
      {stale && (
        // The banner carries the prompt rather than just naming the problem:
        // this is the exact moment the refresh is wanted, and sending the
        // reader off to find a runbook is what made the old wording useless
        // away from a configured machine.
        <div
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <p>This snapshot is more than {staleHours} hours old. Refresh it before trusting it.</p>
          <div className="mt-2">
            <CopyPromptBlock
              prompt={buildRefreshPrompt({ until, since, mailbox, now })}
              label="Copy the refresh prompt"
            />
          </div>
        </div>
      )}

      {needsPermission && (
        <p className={`text-sm ${TEXT}`}>
          Your browser needs one click to re-read the file. Install this page as an app to skip this
          every time.
        </p>
      )}

      {activity?.nudge && (
        <p role="status" className="rounded-md bg-neutral-200 px-3 py-2 text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
          No new application in{' '}
          <strong className="tabular-nums">{activity.daysSinceLastApplication} days</strong>
          {activity.lastApplicationCompany ? ` - the last one was ${activity.lastApplicationCompany}.` : '.'}{' '}
          <span className={MUTED}>{activity.appliedLast30} in the last 30 days.</span>
        </p>
      )}
    </div>
  );
}

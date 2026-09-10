'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { LaneItem } from '@/lib/jobs/board';
import { gmailThreadUrl, relativeTime } from '@/lib/jobs/labels';
import type { Application, JobStatus } from '@/lib/jobs/types';
import { EditPanel } from './EditPanel';
import { Flag, PrepButton } from './parts';
import { StatusDropdown } from './StatusDropdown';
import { WhyPopover } from './WhyPopover';
import { MUTED, TEXT } from './ui';

/**
 * One application, as a card in a 300px lane.
 *
 * The old row laid company, role, every flag, the status pill and four
 * buttons out on a single line, which only worked because it had the full
 * width of the page. Here it is three bands - company, role, controls - with
 * the subline below.
 *
 * The subline keeps every segment it ever had and is deliberately NOT
 * clamped. A truncated "last activity 2 months ago - req JR6155469 - 2
 * threads merged" is exactly the kind of quiet omission this rebuild
 * promised not to introduce, so it wraps to as many lines as it needs.
 */
export function AppCard({
  item,
  now,
  allApps,
  inNeedsYouLane,
  onChangeStatus,
  focusOnMount,
  onFocusHandled,
}: {
  item: LaneItem;
  now: number;
  allApps: Application[];
  /** True for the pinned lane's copy of a card that also appears in its status lane. */
  inNeedsYouLane?: boolean;
  onChangeStatus?: (app: Application, next: JobStatus) => void;
  /** True for the card that just changed status - see the note below. */
  focusOnMount?: boolean;
  onFocusHandled?: () => void;
}) {
  const { app, needsYouReason } = item;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const liRef = useRef<HTMLLIElement>(null);
  const company = app.company ?? 'Unknown company';

  // Changing a status re-parents this card into a different lane, which
  // unmounts the dropdown trigger that had focus - and Menu.close()
  // deliberately does not move focus, so it fell to <body> and a keyboard
  // user lost their place entirely. Take it back on the card itself, and
  // scroll it into view, so the move lands somewhere legible.
  useEffect(() => {
    if (!focusOnMount) return;
    liRef.current?.focus({ preventScroll: true });
    liRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    onFocusHandled?.();
  }, [focusOnMount, onFocusHandled]);
  const href = app.threadIds.length ? gmailThreadUrl(app.threadIds[0]) : undefined;

  return (
    <li
      ref={liRef}
      tabIndex={-1}
      className={`border-t border-neutral-100 px-2.5 py-2 outline-none first:border-t-0 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700 ${
        // The pinned lane's copy is marked so the two renderings of the same
        // application are visibly the same card rather than looking like two
        // separate applications with contradictory sublines.
        inNeedsYouLane ? 'border-l-2 border-l-amber-300 dark:border-l-amber-700' : ''
      }`}
    >
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={company}
        className="block truncate text-sm font-semibold text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
      >
        {company}
      </a>
      <p title={app.role ?? undefined} className={`truncate text-xs ${TEXT}`}>
        {app.role ?? 'Role not stated'}
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <StatusDropdown
          status={app.status}
          company={company}
          onChange={(next) => onChangeStatus?.(app, next)}
        />
        {app.flags.recruiterReplied && <Flag tone="info">Human replied</Flag>}
        {app.flags.needsReview && <Flag tone="info">Check</Flag>}
        {app.edited && <Flag tone="info">Edited</Flag>}
        {/* In a status lane, a card that also needs him says so - otherwise
            the reason would exist only in the pinned lane, and scrolling past
            that lane would hide the fact entirely. */}
        {!inNeedsYouLane && needsYouReason && (
          <Flag tone="urgent" title={needsYouReason}>
            Needs you
          </Flag>
        )}
        {app.status === 'interviewing' && <PrepButton app={app} />}
        <WhyPopover app={app} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="rounded-md border border-neutral-300 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700"
        >
          {open ? 'Close' : 'Edit'}
        </button>
      </div>

      <div className={`mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug ${MUTED}`}>
        {/* The pinned lane leads with WHY it needs him; the status lane leads
            with why it has the status it does. Same card, the sentence each
            lane is actually answering. */}
        <span>{inNeedsYouLane ? (needsYouReason ?? app.statusReason) : app.statusReason}</span>
        <span aria-hidden="true">&middot;</span>
        <span>last activity {relativeTime(app.lastAt, now)}</span>
        {app.reqIds.length > 0 && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="tabular-nums">req {app.reqIds[0]}</span>
          </>
        )}
        {app.threadIds.length > 1 && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span>{app.threadIds.length} threads merged</span>
          </>
        )}
        {app.notes && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="italic">{app.notes}</span>
          </>
        )}
        {app.agentReason && !app.notes && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="italic">{app.agentReason}</span>
          </>
        )}
      </div>

      {/* min-w-0 so an edit panel cannot widen the lane it lives in. */}
      {open && (
        <div id={panelId} className="min-w-0">
          <EditPanel app={app} allApps={allApps} />
        </div>
      )}
    </li>
  );
}

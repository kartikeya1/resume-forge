'use client';

import { useId } from 'react';
import type { Lane as LaneModel } from '@/lib/jobs/board';
import { LANE, LANE_COLLAPSED, LANE_EMPTY, MUTED } from './ui';

/**
 * One swim lane: a header that never scrolls, and a body that scrolls on its
 * own.
 *
 * The header is a flex sibling of the scroll container rather than
 * `sticky top-0` inside it. That is stronger - it cannot scroll away even for
 * a frame - and it costs no z-index, which matters because the whole lane may
 * itself be sticky against the horizontal scroller.
 */
export function Lane({
  lane,
  collapsed,
  onToggleCollapse,
  sticky,
  headerExtra,
  children,
}: {
  lane: LaneModel;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Pins this lane against the left edge while the board scrolls sideways. */
  sticky?: boolean;
  /** Extra header content, e.g. the review list's keyboard help. */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const bodyId = useId();
  const blurbId = useId();
  const empty = lane.count === 0;

  if (collapsed) {
    return (
      <CollapsedLane lane={lane} onToggleCollapse={onToggleCollapse} bodyId={bodyId} sticky={sticky} />
    );
  }

  return (
    <section
      aria-label={`${lane.title}, ${lane.count}`}
      className={`${empty ? LANE_EMPTY : LANE} ${
        // Opaque background plus a right border and a small shadow, so the
        // lanes passing underneath read as scrolling behind this one rather
        // than as a rendering fault.
        sticky ? 'sticky left-0 z-20 shadow-[6px_0_6px_-6px_rgba(0,0,0,0.25)]' : ''
      }`}
    >
      <header className="flex items-start gap-1.5 px-2.5 pt-2 pb-1.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {lane.title}{' '}
            <span className="font-normal tabular-nums text-neutral-400">{lane.count}</span>
          </h2>
          {/* Populated lanes show the blurb; an empty lane is only 152px wide,
              so it carries the same text as a tooltip and an accessible
              description instead of losing it. */}
          {empty ? (
            <span id={blurbId} className="sr-only">
              {lane.blurb}
            </span>
          ) : (
            <p className={`mt-0.5 text-[11px] leading-snug ${MUTED}`}>{lane.blurb}</p>
          )}
          {headerExtra && <p className={`mt-1 text-[11px] leading-snug ${MUTED}`}>{headerExtra}</p>}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded
          aria-controls={bodyId}
          aria-label={`Collapse ${lane.title}`}
          title={empty ? lane.blurb : `Collapse ${lane.title}`}
          aria-describedby={empty ? blurbId : undefined}
          className={`shrink-0 rounded px-1 text-xs transition hover:bg-neutral-200 dark:hover:bg-neutral-700 ${MUTED}`}
        >
          <span aria-hidden="true">▾</span>
        </button>
      </header>

      {/* A plain scroll container, not a <ul>: each lane body brings its own
          list element, because the review lane's is a role="listbox" with its
          own keyboard model and nesting one list inside another would be
          neither valid nor navigable. */}
      {!empty && (
        <div
          id={bodyId}
          className="min-h-0 flex-1 overflow-y-auto border-t border-neutral-100 dark:border-neutral-700"
        >
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * A collapsed lane: a 44px spine holding a vertical label and the count.
 *
 * This is the pressure valve for thirteen lanes. Collapsing the four closed
 * ones takes them from ~1200px of board to ~176px, permanently, because the
 * collapse is persisted.
 */
function CollapsedLane({
  lane,
  onToggleCollapse,
  bodyId,
  sticky,
}: {
  lane: LaneModel;
  onToggleCollapse: () => void;
  bodyId: string;
  sticky?: boolean;
}) {
  return (
    <section
      aria-label={`${lane.title}, ${lane.count}, collapsed`}
      className={`${LANE_COLLAPSED} ${sticky ? 'sticky left-0 z-20' : ''}`}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={false}
        aria-controls={bodyId}
        aria-label={`Expand ${lane.title}, ${lane.count}`}
        title={`${lane.title} (${lane.count})`}
        className="flex h-full w-full flex-col items-center gap-2 py-2 text-xs transition hover:bg-neutral-200 dark:hover:bg-neutral-800"
      >
        <span aria-hidden="true" className={MUTED}>
          ▸
        </span>
        <span aria-hidden="true" className="font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">
          {lane.count}
        </span>
        <span
          aria-hidden="true"
          className="[writing-mode:vertical-rl] truncate text-[11px] font-medium text-neutral-600 dark:text-neutral-300"
        >
          {lane.title}
        </span>
      </button>
    </section>
  );
}

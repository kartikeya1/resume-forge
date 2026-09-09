'use client';

import { useRef } from 'react';
import type { Lane as LaneModel } from '@/lib/jobs/board';
import type { Application, JobStatus } from '@/lib/jobs/types';
import { Lane } from './Lane';
import { ReviewHelp, ReviewList } from './ReviewList';
import { ThreadRow } from './parts';
import { AppCard } from './AppCard';

/**
 * The horizontally-scrolling swim-lane board.
 *
 * Scrolls sideways rather than stacking: thirteen lanes down a page is the
 * layout this rebuild is replacing.
 */
export function Board({
  lanes,
  now,
  allApps,
  isCollapsed,
  onToggleLane,
  onAddFromReview,
  onChangeStatus,
}: {
  lanes: LaneModel[];
  now: number;
  allApps: Application[];
  isCollapsed: (id: string) => boolean;
  onToggleLane: (id: string) => void;
  onAddFromReview: (prefill: { company: string; role?: string }) => void;
  onChangeStatus: (app: Application, next: JobStatus) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  /**
   * Where each lane begins, in the scroller's own scroll coordinates.
   *
   * Accumulated from offsetWidth rather than read off getBoundingClientRect,
   * because the pinned lane is `position: sticky` and therefore reports where
   * it is currently *painted*, not where it sits in layout. Measuring rects
   * made the pinned lane look like a boundary a few pixels ahead of the
   * current scroll, so ArrowRight targeted it, snap pulled straight back, and
   * the board never moved.
   *
   * Widths have to be summed rather than multiplied out from one constant:
   * lanes are 300px populated, 152px empty and 44px collapsed.
   */
  const laneStarts = (el: HTMLDivElement): number[] => {
    const style = getComputedStyle(el);
    const gap = parseFloat(style.columnGap) || 0;
    let x = parseFloat(style.paddingLeft) || 0;
    return Array.from(el.children).map((c) => {
      const start = Math.round(x);
      x += (c as HTMLElement).offsetWidth + gap;
      return start;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Scoped to the scroller itself. Without this check the board would steal
    // arrow keys from a status dropdown, a <select> in an edit panel, or the
    // review list's own up/down navigation.
    if (e.target !== scroller.current) return;
    const el = scroller.current;
    if (!el) return;

    // Deliberately instant, not smooth. With scroll-snap active a smooth
    // programmatic scroll gets re-snapped mid-flight and lands back where it
    // started - measured: every `behavior: 'smooth'` call returned to the
    // pinned lane's snap point regardless of target, while the same target
    // instant lands exactly. Paging that arrives beats paging that animates.
    const go = (left: number) => el.scrollTo({ left, behavior: 'instant' });
    const max = el.scrollWidth - el.clientWidth;
    const starts = laneStarts(el);
    const here = el.scrollLeft;

    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault();
        go(starts.find((x) => x > here + 2) ?? max);
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        const prev = starts.filter((x) => x < here - 2).pop();
        go(prev ?? 0);
        break;
      }
      case 'Home':
        e.preventDefault();
        go(0);
        break;
      case 'End':
        e.preventDefault();
        go(max);
        break;
      case 'PageDown':
        e.preventDefault();
        go(Math.min(here + el.clientWidth, max));
        break;
      case 'PageUp':
        e.preventDefault();
        go(Math.max(here - el.clientWidth, 0));
        break;
    }
  };

  return (
    <div
      ref={scroller}
      id="rail-panel-board"
      role="tabpanel"
      aria-label="Board"
      // tabIndex is required, not decorative: with every lane collapsed this
      // is a scroll container with no focusable child, which a keyboard user
      // could not reach at all (axe: scrollable-region-focusable).
      tabIndex={0}
      onKeyDown={onKeyDown}
      // overscroll-x-contain stops a sideways trackpad flick triggering
      // browser Back, which matters most in the installed PWA. snap-proximity
      // rather than mandatory: mandatory fights a trackpad and hijacks
      // scrollIntoView when a card inside a lane takes focus.
      className="flex min-h-0 min-w-0 flex-1 snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain px-3 py-3"
    >
      {lanes.map((lane) => {
        const collapsed = isCollapsed(lane.id);
        return (
          <Lane
            key={lane.id}
            lane={lane}
            collapsed={collapsed}
            onToggleCollapse={() => onToggleLane(lane.id)}
            // Only the far-left lane pins. The review lane is also flagged
            // pinned in the model - meaning "always last" - but sticking it to
            // the right edge as well would leave two sticky lanes competing
            // for the same scroll, and it costs a permanent 300px at the one
            // edge that is hardest to reach anyway.
            sticky={lane.kind === 'needs_you' && lane.count > 0}
            headerExtra={lane.kind === 'review' ? <ReviewHelp /> : undefined}
          >
            <LaneBody
              lane={lane}
              now={now}
              allApps={allApps}
              onAddFromReview={onAddFromReview}
              onChangeStatus={onChangeStatus}
            />
          </Lane>
        );
      })}
    </div>
  );
}

function LaneBody({
  lane,
  now,
  allApps,
  onAddFromReview,
  onChangeStatus,
}: {
  lane: LaneModel;
  now: number;
  allApps: Application[];
  onAddFromReview: (prefill: { company: string; role?: string }) => void;
  onChangeStatus: (app: Application, next: JobStatus) => void;
}) {
  if (lane.kind === 'review') {
    // ReviewList renders its own <ul role="listbox">, so it replaces the
    // lane's list rather than sitting inside it.
    return <ReviewList threads={lane.threads} onAdd={onAddFromReview} />;
  }
  if (lane.kind === 'filtered') {
    return (
      <ul>
        {lane.threads.map((t) => (
          <ThreadRow key={t.threadId} t={t} />
        ))}
      </ul>
    );
  }
  return (
    <ul>
      {lane.items.map((item) => (
        <AppCard
          key={item.app.id}
          item={item}
          now={now}
          allApps={allApps}
          inNeedsYouLane={lane.kind === 'needs_you'}
          onChangeStatus={onChangeStatus}
        />
      ))}
    </ul>
  );
}

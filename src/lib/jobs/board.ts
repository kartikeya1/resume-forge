// Swim-lane composition for the board layout.
//
// This is presentation *logic*, not presentation: which lanes exist, in what
// order, holding which applications, under which filter. It lives in src/lib
// rather than the component tree for the reason the rest of this project
// does - src/lib is the tested half. vitest runs `src/**/*.test.ts` in a node
// environment with no DOM, so anything left inside a .tsx file is verified by
// eye and nothing else. Lane ordering and the closed/filtered rules are
// exactly the sort of thing that silently regresses, so they belong here.

import { CLOSED_STATUSES, STATUS_BLURBS, STATUS_LABELS, STATUS_ORDER } from './labels';
import { needsYouReason } from './needsYou';
import { DEFAULT_SETTINGS, type JobsSettings } from './settings';
import type { Application, ExcludedThread, JobStatus } from './types';

/**
 * The order the four closed lanes appear in, which is NOT `STATUS_ORDER`'s
 * tail and NOT `CLOSED_STATUSES`' insertion order. Both of those put `ghosted`
 * before `rejected`; on screen the useful order is worst-news-first, with "No
 * response" (`ghosted`) second because it is the ambiguous one you actually
 * reread. Kept as its own constant so fixing the board never means reordering
 * `STATUS_ORDER`, which also drives the live lanes and the EditPanel select.
 */
export const CLOSED_LANE_ORDER: JobStatus[] = ['rejected', 'ghosted', 'role_closed', 'withdrawn'];

/** The four ribbon chips. `tracked` is the unfiltered state, not a filter. */
export type ChipFilter = 'tracked' | 'needs_you' | 'live' | 'interviewing';

export interface LaneItem {
  app: Application;
  /**
   * Why this application needs him, or null. Computed once here rather than
   * per render site: the same application appears in both the pinned Needs-you
   * lane and its own status lane, and before this it was recomputed in each.
   */
  needsYouReason: string | null;
}

export type LaneKind = 'needs_you' | 'status' | 'filtered' | 'review';

export interface Lane {
  /** Stable across renders and reorders - the persisted collapse key. */
  id: string;
  kind: LaneKind;
  title: string;
  /** The one-line explanation of what belongs in this lane. */
  blurb: string;
  /** Present only on `kind: 'status'` lanes. */
  status: JobStatus | null;
  items: LaneItem[];
  /** Threads the pipeline filtered out. Only on `kind: 'filtered'`. */
  threads: ExcludedThread[];
  /** Rendered first and pinned while the board scrolls sideways. */
  pinned: boolean;
  count: number;
}

const NEEDS_YOU_BLURB = 'Everything waiting on you right now, pulled out of the lanes below.';
const FILTERED_BLURB = 'Mail the pipeline decided was not a job application. Check it if something is missing.';
const REVIEW_BLURB = 'Threads that look like applications but name no company. Confirm or dismiss each one.';

function lane(partial: Omit<Lane, 'count'>): Lane {
  return { ...partial, count: partial.items.length + partial.threads.length };
}

/** Most recent activity first, which is how you actually scan a lane. */
function byRecency(a: LaneItem, b: LaneItem): number {
  return b.app.lastAt - a.app.lastAt;
}

export interface ComposeInput {
  applications: Application[];
  /** Threads the pipeline excluded, for the "Filtered mail" lane. */
  excluded?: ExcludedThread[];
  /** Threads that need a human decision, for the far-right review lane. */
  review?: ExcludedThread[];
  now: number;
  settings?: JobsSettings;
  filter?: ChipFilter;
  showClosed?: boolean;
  showFiltered?: boolean;
}

/**
 * Whether an application survives the active ribbon chip.
 *
 * Exported because the KPI chip counts must be derived the same way they are
 * filtered - a chip reading "Live 16" that yields 14 lanes' worth of cards is
 * worse than no chip.
 */
export function matchesChip(item: LaneItem, filter: ChipFilter): boolean {
  switch (filter) {
    case 'tracked':
      return true;
    case 'needs_you':
      return item.needsYouReason !== null;
    case 'live':
      return !CLOSED_STATUSES.has(item.app.status);
    case 'interviewing':
      return item.app.status === 'interviewing';
  }
}

/** Applies a chip to a composed board, preserving lane identity and order. */
export function applyChipFilter(lanes: Lane[], filter: ChipFilter): Lane[] {
  if (filter === 'tracked') return lanes;
  return lanes.map((l) => {
    // The filtered-mail lane holds threads, not applications, and no chip
    // describes a thread. Emptying it is honest; hiding it would make the
    // "Show filtered mail" toggle appear broken.
    const items = l.items.filter((i) => matchesChip(i, filter));
    return { ...l, items, count: items.length + l.threads.length };
  });
}

/**
 * Builds the full lane list, left to right.
 *
 * Two things differ from the old stacked layout deliberately:
 *
 * 1. Empty status lanes are KEPT. In a column layout an empty section is dead
 *    scroll, so they were dropped; on a board a missing lane makes the whole
 *    row jump position between refreshes, and "Offer: 0" is itself worth
 *    seeing. The caller renders them narrow.
 * 2. Every application appears exactly once in a status lane, AND again in the
 *    pinned Needs-you lane if it needs him. That duplication is the point of
 *    the pinned lane; `LaneItem.needsYouReason` is what lets the two render
 *    sites say different things about the same card without recomputing.
 */
export function toItems(input: ComposeInput): LaneItem[] {
  const { applications, now, settings = DEFAULT_SETTINGS } = input;
  // Archived applications are gone from every surface, which is what
  // archiving means. They stay in the snapshot so a re-run cannot resurrect
  // them as new.
  return applications
    .filter((a) => !a.archived)
    .map((app) => ({ app, needsYouReason: needsYouReason(app, now, settings) }));
}

export function composeLanes(input: ComposeInput, items: LaneItem[] = toItems(input)): Lane[] {
  const { excluded = [], review = [], showClosed = false, showFiltered = false } = input;

  const lanes: Lane[] = [];

  // 1. Needs you, pinned far-left. Present even when empty - it is the lane
  //    whose emptiness is the good news, and un-pinning it is the caller's
  //    call, not this function's.
  const needsYouItems = items.filter((i) => i.needsYouReason !== null).sort(byRecency);
  lanes.push(
    lane({
      id: 'needs_you',
      kind: 'needs_you',
      title: 'Needs you',
      blurb: NEEDS_YOU_BLURB,
      status: null,
      items: needsYouItems,
      threads: [],
      pinned: true,
    })
  );

  // 2. Live status lanes, in STATUS_ORDER, closed ones held back.
  const byStatus = new Map<JobStatus, LaneItem[]>();
  for (const i of items) {
    const bucket = byStatus.get(i.app.status);
    if (bucket) bucket.push(i);
    else byStatus.set(i.app.status, [i]);
  }
  const statusLane = (status: JobStatus): Lane =>
    lane({
      id: `status:${status}`,
      kind: 'status',
      title: STATUS_LABELS[status],
      blurb: STATUS_BLURBS[status],
      status,
      items: (byStatus.get(status) ?? []).slice().sort(byRecency),
      threads: [],
      pinned: false,
    });

  for (const status of STATUS_ORDER) {
    if (CLOSED_STATUSES.has(status)) continue;
    lanes.push(statusLane(status));
  }

  // 3. The four closed lanes, in their own order, only when asked for.
  if (showClosed) {
    for (const status of CLOSED_LANE_ORDER) lanes.push(statusLane(status));
  }

  // 4. Filtered mail.
  if (showFiltered) {
    lanes.push(
      lane({
        id: 'filtered',
        kind: 'filtered',
        title: 'Filtered mail',
        blurb: FILTERED_BLURB,
        status: null,
        items: [],
        threads: excluded,
        pinned: false,
      })
    );
  }

  // 5. Review, pinned far-right, and only when there is something to review.
  //    An always-present empty review lane would be a permanent 152px of
  //    nothing at the one edge of the board that is hardest to scroll to.
  if (review.length > 0) {
    lanes.push(
      lane({
        id: 'review',
        kind: 'review',
        title: 'Needs a human look',
        blurb: REVIEW_BLURB,
        status: null,
        items: [],
        threads: review,
        pinned: true,
      })
    );
  }

  return lanes;
}

export interface ChipCounts {
  tracked: number;
  needsYou: number;
  live: number;
  interviewing: number;
}

/**
 * The four ribbon numbers.
 *
 * Derived from every tracked application, NOT from the lanes currently on
 * screen: "Tracked 37" must keep saying 37 when the closed lanes are
 * collapsed or hidden, or the number means "37 things I can see right now",
 * which is not a fact worth putting in a ribbon.
 */
export function chipCounts(items: LaneItem[]): ChipCounts {
  return {
    tracked: items.length,
    needsYou: items.filter((i) => i.needsYouReason !== null).length,
    live: items.filter((i) => !CLOSED_STATUSES.has(i.app.status)).length,
    interviewing: items.filter((i) => i.app.status === 'interviewing').length,
  };
}

export interface Board {
  lanes: Lane[];
  counts: ChipCounts;
  /** Every tracked application, already carrying its needs-you reason. */
  items: LaneItem[];
}

/**
 * The single entry point the dashboard calls: lanes, counts and the item set
 * they were both built from, so the three can never drift apart.
 */
export function composeBoard(input: ComposeInput): Board {
  const items = toItems(input);
  const lanes = composeLanes(input, items);
  const filter = input.filter ?? 'tracked';
  return {
    lanes: applyChipFilter(lanes, filter),
    counts: chipCounts(items),
    items,
  };
}

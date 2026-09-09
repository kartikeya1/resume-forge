import { describe, expect, it } from 'vitest';
import {
  CLOSED_LANE_ORDER,
  applyChipFilter,
  chipCounts,
  composeBoard,
  composeLanes,
  matchesChip,
  toItems,
} from './board';
import type { Lane } from './board';
import { CLOSED_STATUSES, STATUS_ORDER } from './labels';
import type { Application, ExcludedThread, JobStatus } from './types';

const NOW = Date.parse('2026-09-08T12:00:00Z');
const DAY = 86400_000;

function app(
  id: string,
  status: JobStatus,
  flags: Partial<Application['flags']> = {},
  extra: Partial<Application> = {}
): Application {
  return {
    id,
    company: `Co-${id}`,
    companyKey: `co-${id}`,
    role: 'PM',
    roleKey: 'pm#',
    reqIds: [],
    status,
    statusRuleId: 'test',
    statusReason: 'because',
    decidedBy: 'rules',
    appliedAt: NOW - 30 * DAY,
    firstAt: NOW - 30 * DAY,
    lastAt: NOW - 1 * DAY,
    events: [],
    threadIds: [`t-${id}`],
    provenance: { company: 'agent', role: 'agent' },
    mergeRuleIds: [],
    classificationByThread: {},
    flags: {
      recruiterReplied: false,
      awaitingMyReply: false,
      iReplied: false,
      deadlineAt: null,
      deadlineSource: null,
      deadlineMissed: false,
      interviewAt: null,
      interviewMissed: false,
      staleDays: 1,
      duplicateMessages: 0,
      talentPooled: false,
      needsReview: false,
      conflicting: false,
      ...flags,
    },
    ...extra,
  };
}

function thread(id: string): ExcludedThread {
  return { threadId: id, subject: `Subject ${id}`, from: 'a@b.com', at: NOW, kind: 'marketing', reasons: ['N1'] };
}

const ids = (lanes: Lane[]) => lanes.map((l) => l.id);
const lane = (lanes: Lane[], id: string): Lane => {
  const found = lanes.find((l) => l.id === id);
  if (!found) throw new Error(`no lane ${id}; got ${ids(lanes).join(', ')}`);
  return found;
};

describe('composeLanes: lane set and order', () => {
  it('leads with the pinned Needs-you lane', () => {
    const lanes = composeLanes({ applications: [app('a', 'applied')], now: NOW });
    expect(lanes[0].id).toBe('needs_you');
    expect(lanes[0].pinned).toBe(true);
  });

  it('renders every live status lane in STATUS_ORDER, and no closed ones by default', () => {
    const lanes = composeLanes({ applications: [], now: NOW });
    const liveOrder = STATUS_ORDER.filter((s) => !CLOSED_STATUSES.has(s)).map((s) => `status:${s}`);
    expect(ids(lanes)).toEqual(['needs_you', ...liveOrder]);
  });

  it('keeps empty status lanes rather than dropping them', () => {
    // The old stacked layout filtered these out. On a board a lane that comes
    // and goes makes every other lane change position between refreshes.
    const lanes = composeLanes({ applications: [], now: NOW });
    expect(lanes.length).toBeGreaterThan(1);
    expect(lanes.every((l) => l.count === 0)).toBe(true);
    expect(lane(lanes, 'status:offer')).toBeDefined();
  });

  it('appends the four closed lanes in CLOSED_LANE_ORDER, not STATUS_ORDER order', () => {
    const lanes = composeLanes({ applications: [], now: NOW, showClosed: true });
    const closed = ids(lanes).filter((i) => CLOSED_LANE_ORDER.some((s) => i === `status:${s}`));
    expect(closed).toEqual(['status:rejected', 'status:ghosted', 'status:role_closed', 'status:withdrawn']);
  });

  it('places the closed lanes after every live lane', () => {
    const lanes = composeLanes({ applications: [], now: NOW, showClosed: true });
    const firstClosed = ids(lanes).indexOf('status:rejected');
    const lastLive = ids(lanes).indexOf('status:lapsed');
    expect(firstClosed).toBeGreaterThan(lastLive);
  });

  it('adds the filtered-mail lane only when asked, carrying its threads', () => {
    const excluded = [thread('x1'), thread('x2')];
    expect(ids(composeLanes({ applications: [], excluded, now: NOW }))).not.toContain('filtered');
    const lanes = composeLanes({ applications: [], excluded, now: NOW, showFiltered: true });
    expect(lane(lanes, 'filtered').threads).toHaveLength(2);
    expect(lane(lanes, 'filtered').count).toBe(2);
  });

  it('pins a review lane last, and omits it entirely when there is nothing to review', () => {
    expect(ids(composeLanes({ applications: [], review: [], now: NOW }))).not.toContain('review');
    const lanes = composeLanes({ applications: [], review: [thread('r1')], now: NOW });
    expect(lanes[lanes.length - 1].id).toBe('review');
    expect(lanes[lanes.length - 1].pinned).toBe(true);
  });

  it('gives every lane a title and a blurb', () => {
    const lanes = composeLanes({
      applications: [],
      review: [thread('r')],
      now: NOW,
      showClosed: true,
      showFiltered: true,
    });
    expect(lanes.every((l) => l.title.length > 0 && l.blurb.length > 0)).toBe(true);
  });

  it('labels the ghosted lane "No response"', () => {
    const lanes = composeLanes({ applications: [], now: NOW, showClosed: true });
    expect(lane(lanes, 'status:ghosted').title).toBe('No response');
  });
});

describe('composeLanes: placement', () => {
  it('puts each application in exactly one status lane', () => {
    const apps = [app('a', 'applied'), app('b', 'applied'), app('c', 'interviewing')];
    const lanes = composeLanes({ applications: apps, now: NOW });
    const placements = lanes
      .filter((l) => l.kind === 'status')
      .flatMap((l) => l.items.map((i) => i.app.id));
    expect(placements.sort()).toEqual(['a', 'b', 'c']);
  });

  it('also renders a needing application in the Needs-you lane, without removing it from its status lane', () => {
    // A lead always needs him - it is an opening he has not applied to.
    const lanes = composeLanes({ applications: [app('a', 'lead')], now: NOW });
    expect(lane(lanes, 'needs_you').items.map((i) => i.app.id)).toEqual(['a']);
    expect(lane(lanes, 'status:lead').items.map((i) => i.app.id)).toEqual(['a']);
  });

  it('attaches the needs-you reason to the item so both render sites share one computation', () => {
    const lanes = composeLanes({ applications: [app('a', 'lead')], now: NOW });
    expect(lane(lanes, 'needs_you').items[0].needsYouReason).toBe(
      'An opening you have not applied to yet'
    );
    expect(lane(lanes, 'status:lead').items[0].needsYouReason).toBe(
      'An opening you have not applied to yet'
    );
  });

  it('leaves needsYouReason null on an application that does not need him', () => {
    const lanes = composeLanes({ applications: [app('a', 'applied')], now: NOW });
    expect(lane(lanes, 'status:applied').items[0].needsYouReason).toBeNull();
    expect(lane(lanes, 'needs_you').items).toHaveLength(0);
  });

  it('drops archived applications from every lane', () => {
    const lanes = composeLanes({
      applications: [app('a', 'lead'), app('b', 'lead', {}, { archived: true })],
      now: NOW,
    });
    expect(lane(lanes, 'status:lead').items.map((i) => i.app.id)).toEqual(['a']);
    expect(lane(lanes, 'needs_you').items.map((i) => i.app.id)).toEqual(['a']);
  });

  it('sorts each lane by most recent activity first', () => {
    const apps = [
      app('old', 'applied', {}, { lastAt: NOW - 10 * DAY }),
      app('new', 'applied', {}, { lastAt: NOW - 1 * DAY }),
      app('mid', 'applied', {}, { lastAt: NOW - 5 * DAY }),
    ];
    const lanes = composeLanes({ applications: apps, now: NOW });
    expect(lane(lanes, 'status:applied').items.map((i) => i.app.id)).toEqual(['new', 'mid', 'old']);
  });

  it('hides closed applications when the closed lanes are hidden', () => {
    const lanes = composeLanes({ applications: [app('a', 'rejected')], now: NOW });
    const shown = lanes.flatMap((l) => l.items.map((i) => i.app.id));
    expect(shown).toEqual([]);
  });

  it('never puts a closed application in Needs-you', () => {
    // needsYouReason returns null for closed statuses; this pins that the
    // board relies on it rather than re-deciding.
    const lanes = composeLanes({ applications: [app('a', 'rejected')], now: NOW, showClosed: true });
    expect(lane(lanes, 'needs_you').items).toHaveLength(0);
    expect(lane(lanes, 'status:rejected').items).toHaveLength(1);
  });
});

describe('chip filtering', () => {
  const apps = [
    app('interview', 'interviewing'),
    app('applied', 'applied'),
    app('lead', 'lead'),
    app('rejected', 'rejected'),
  ];

  it('tracked returns the lanes untouched', () => {
    const lanes = composeLanes({ applications: apps, now: NOW, showClosed: true });
    expect(applyChipFilter(lanes, 'tracked')).toBe(lanes);
  });

  it('needs_you keeps only the applications with a reason', () => {
    const lanes = applyChipFilter(composeLanes({ applications: apps, now: NOW }), 'needs_you');
    const shown = lanes.filter((l) => l.kind === 'status').flatMap((l) => l.items.map((i) => i.app.id));
    expect(shown).toEqual(['lead']);
  });

  it('live drops the closed applications from their own lanes', () => {
    const lanes = applyChipFilter(
      composeLanes({ applications: apps, now: NOW, showClosed: true }),
      'live'
    );
    expect(lane(lanes, 'status:rejected').items).toHaveLength(0);
    expect(lane(lanes, 'status:applied').items).toHaveLength(1);
  });

  it('interviewing keeps only the interviewing lane populated', () => {
    const lanes = applyChipFilter(composeLanes({ applications: apps, now: NOW }), 'interviewing');
    const populated = lanes.filter((l) => l.items.length > 0).map((l) => l.id);
    expect(populated).toEqual(['status:interviewing']);
  });

  it('keeps every lane present under a filter, so lanes never move', () => {
    const lanes = composeLanes({ applications: apps, now: NOW, showClosed: true });
    expect(ids(applyChipFilter(lanes, 'interviewing'))).toEqual(ids(lanes));
  });

  it('leaves filtered-mail threads alone - no chip describes a thread', () => {
    const lanes = applyChipFilter(
      composeLanes({ applications: apps, excluded: [thread('x')], now: NOW, showFiltered: true }),
      'interviewing'
    );
    expect(lane(lanes, 'filtered').threads).toHaveLength(1);
  });

  it('recomputes counts to match what survives the filter', () => {
    const lanes = applyChipFilter(composeLanes({ applications: apps, now: NOW }), 'interviewing');
    expect(lane(lanes, 'status:applied').count).toBe(0);
    expect(lane(lanes, 'status:interviewing').count).toBe(1);
  });

  it('matchesChip agrees with the statuses CLOSED_STATUSES defines as live', () => {
    for (const status of STATUS_ORDER) {
      const item = { app: app('x', status), needsYouReason: null };
      expect(matchesChip(item, 'live')).toBe(!CLOSED_STATUSES.has(status));
    }
  });
});

describe('chipCounts', () => {
  const apps = [
    app('i', 'interviewing'),
    app('a1', 'applied'),
    app('a2', 'applied'),
    app('l', 'lead'),
    app('r', 'rejected'),
    app('g', 'ghosted'),
  ];

  it('counts every tracked application, live and closed alike', () => {
    expect(chipCounts(toItems({ applications: apps, now: NOW })).tracked).toBe(6);
  });

  it('reports the same numbers whether or not the closed lanes are shown', () => {
    // The regression this exists for: deriving counts from the lanes on screen
    // made "Tracked" shrink when the closed lanes were hidden.
    const hidden = composeBoard({ applications: apps, now: NOW, showClosed: false });
    const shown = composeBoard({ applications: apps, now: NOW, showClosed: true });
    expect(hidden.counts).toEqual(shown.counts);
    expect(hidden.counts.tracked).toBe(6);
  });

  it('reports the same numbers under an active chip', () => {
    const all = composeBoard({ applications: apps, now: NOW });
    const filtered = composeBoard({ applications: apps, now: NOW, filter: 'interviewing' });
    expect(filtered.counts).toEqual(all.counts);
  });

  it('excludes closed applications from live', () => {
    expect(chipCounts(toItems({ applications: apps, now: NOW })).live).toBe(4);
  });

  it('counts needsYou from the reasons, not the statuses', () => {
    expect(chipCounts(toItems({ applications: apps, now: NOW })).needsYou).toBe(1);
  });

  it('excludes archived applications from every count', () => {
    const withArchived = [...apps, app('z', 'applied', {}, { archived: true })];
    expect(chipCounts(toItems({ applications: withArchived, now: NOW })).tracked).toBe(6);
  });
});

describe('composeBoard', () => {
  it('returns lanes already filtered, plus unfiltered counts', () => {
    const board = composeBoard({
      applications: [app('i', 'interviewing'), app('a', 'applied')],
      now: NOW,
      filter: 'interviewing',
    });
    expect(lane(board.lanes, 'status:applied').items).toHaveLength(0);
    expect(board.counts.tracked).toBe(2);
  });

  it('shares one item set between lanes and counts', () => {
    const board = composeBoard({ applications: [app('l', 'lead')], now: NOW });
    expect(board.items).toHaveLength(1);
    expect(board.items[0].needsYouReason).not.toBeNull();
    expect(board.counts.needsYou).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildLabelPlan, JOBS_LABELS, LABEL_PREFIX, labelForStatus, summariseLabelPlan,
  threadLabelsFromSnapshot, type LabelPlanInput,
} from './labelPlan';
import type { Application, JobStatus } from './types';

const NOW = Date.parse('2026-09-09T12:00:00Z');

function app(overrides: Partial<Application> = {}): Application {
  return {
    id: 'acme::pm', company: 'Acme', companyKey: 'acme', role: 'PM', roleKey: 'pm#',
    reqIds: [], status: 'applied', statusRuleId: 'R12-applied', statusReason: 'Applied and acknowledged.',
    decidedBy: 'rules', appliedAt: NOW, firstAt: NOW, lastAt: NOW, events: [],
    threadIds: ['t1'], provenance: { company: 'agent', role: 'agent' },
    mergeRuleIds: [], classificationByThread: {},
    flags: {
      recruiterReplied: false, awaitingMyReply: false, iReplied: false,
      deadlineAt: null, deadlineSource: null, deadlineMissed: false,
      interviewAt: null, interviewMissed: false, staleDays: 1,
      duplicateMessages: 0, talentPooled: false, needsReview: false, conflicting: false,
    },
    ...overrides,
  };
}

function plan(input: Partial<LabelPlanInput> = {}) {
  return buildLabelPlan({
    applications: [app()],
    threadLabels: {},
    needsYouIds: new Set(),
    snapshotGeneratedAt: '2026-09-09T11:00:00Z',
    now: NOW,
    ...input,
  });
}

describe('safety invariants', () => {
  it('never names a label outside the JobsForge namespace', () => {
    for (const l of JOBS_LABELS) expect(l.startsWith(LABEL_PREFIX)).toBe(true);
  });

  it('never asks to remove a label it does not own', () => {
    // The whole blast radius argument rests on this: his real labels
    // (axis-office-visit, paytm-office-visit, CC Rewards) must be untouchable.
    const p = plan({
      threadLabels: {
        t1: ['INBOX', 'UNREAD', 'axis-office-visit', 'CC Rewards', 'JobsForge/Closed'],
      },
    });
    const removals = p.changes.flatMap((c) => c.remove);
    expect(removals).toEqual(['JobsForge/Closed']);
    for (const r of removals) expect(r.startsWith(LABEL_PREFIX)).toBe(true);
  });

  it('leaves system labels alone entirely', () => {
    const p = plan({ threadLabels: { t1: ['INBOX', 'UNREAD', 'IMPORTANT', 'SENT'] } });
    expect(p.changes[0].remove).toEqual([]);
    expect(p.changes[0].add).toEqual(['JobsForge/Active']);
  });

  it('never labels a thread that is not part of an application', () => {
    // Noise and review threads never reach buildLabelPlan, so a misclassified
    // newsletter is ignored rather than tagged.
    const p = plan({ threadLabels: { 'noise-thread': ['INBOX'] } });
    expect(p.changes.map((c) => c.threadId)).toEqual(['t1']);
  });
});

describe('labelForStatus', () => {
  it.each<[JobStatus, string]>([
    ['applied', 'JobsForge/Active'],
    ['in_review', 'JobsForge/Active'],
    ['lead', 'JobsForge/Active'],
    ['interviewing', 'JobsForge/Interviewing'],
    ['lapsed', 'JobsForge/Lapsed'],
    ['rejected', 'JobsForge/Closed'],
    ['role_closed', 'JobsForge/Closed'],
    ['ghosted', 'JobsForge/Closed'],
    ['withdrawn', 'JobsForge/Closed'],
  ])('%s -> %s', (status, expected) => {
    expect(labelForStatus(status, false)).toBe(expected);
  });

  it('lets Needs-You win over the underlying status', () => {
    expect(labelForStatus('interviewing', true)).toBe('JobsForge/Needs-You');
    expect(labelForStatus('lapsed', true)).toBe('JobsForge/Needs-You');
    expect(labelForStatus('applied', true)).toBe('JobsForge/Needs-You');
  });

  it('does not let Needs-You resurrect a closed application', () => {
    // A closed row is filtered out of the strip upstream, but if it ever
    // arrived here it must not be labelled as actionable.
    expect(labelForStatus('rejected', true)).toBe('JobsForge/Closed');
  });

  it('assigns exactly one label per thread', () => {
    const p = plan({ needsYouIds: new Set(['acme::pm']) });
    expect(p.changes[0].add).toHaveLength(1);
  });
});

describe('idempotency', () => {
  it('produces no changes when Gmail already matches', () => {
    const p = plan({ threadLabels: { t1: ['INBOX', 'JobsForge/Active'] } });
    expect(p.changes).toEqual([]);
    expect(p.unchanged).toBe(1);
    expect(summariseLabelPlan(p)).toMatch(/already up to date/);
  });

  it('is byte-identical across two runs over the same data', () => {
    const input = {
      applications: [app({ threadIds: ['t2', 't1'] }), app({ id: 'b::pm', threadIds: ['t3'] })],
      threadLabels: {},
      needsYouIds: new Set<string>(),
      snapshotGeneratedAt: '2026-09-09T11:00:00Z',
      now: NOW,
    };
    expect(JSON.stringify(buildLabelPlan(input))).toBe(JSON.stringify(buildLabelPlan(input)));
  });

  it('sorts changes by thread id regardless of input order', () => {
    const p = plan({ applications: [app({ threadIds: ['t9', 't1', 't5'] })] });
    expect(p.changes.map((c) => c.threadId)).toEqual(['t1', 't5', 't9']);
  });
});

describe('re-labelling', () => {
  it('moves a thread from its old label to the new one', () => {
    const p = plan({
      applications: [app({ status: 'rejected', statusReason: 'They declined.' })],
      threadLabels: { t1: ['JobsForge/Active'] },
    });
    expect(p.changes[0].add).toEqual(['JobsForge/Closed']);
    expect(p.changes[0].remove).toEqual(['JobsForge/Active']);
  });

  it('cleans up a thread carrying two JobsForge labels', () => {
    // Should not happen, but a half-applied earlier plan could leave it - the
    // plan must converge rather than compound.
    const p = plan({ threadLabels: { t1: ['JobsForge/Closed', 'JobsForge/Lapsed'] } });
    expect(p.changes[0].add).toEqual(['JobsForge/Active']);
    expect(p.changes[0].remove.sort()).toEqual(['JobsForge/Closed', 'JobsForge/Lapsed']);
  });
});

describe('merged applications', () => {
  it('labels every thread of a merged application the same way', () => {
    const p = plan({ applications: [app({ threadIds: ['t1', 't2', 't3'], status: 'interviewing' })] });
    expect(p.changes).toHaveLength(3);
    for (const c of p.changes) expect(c.desired).toBe('JobsForge/Interviewing');
  });
});

describe('manual entries and archiving', () => {
  it('skips a manual application, and says so', () => {
    const p = plan({ applications: [app({ id: 'manual:x', threadIds: [] })] });
    expect(p.changes).toEqual([]);
    expect(p.skippedManual).toBe(1);
  });

  it('treats an archived application as closed', () => {
    const p = plan({ applications: [app({ archived: true, status: 'interviewing' })] });
    expect(p.changes[0].desired).toBe('JobsForge/Closed');
    expect(p.changes[0].reason).toMatch(/Archived/);
  });
});

describe('plan metadata', () => {
  it('records the snapshot it was built from', () => {
    const p = plan();
    expect(p.snapshotGeneratedAt).toBe('2026-09-09T11:00:00Z');
    expect(p.kind).toBe('jobs-forge-label-plan');
  });

  it('counts the desired end state, not the changes', () => {
    const p = plan({
      applications: [
        app({ threadIds: ['t1'] }),
        app({ id: 'b::pm', threadIds: ['t2'], status: 'rejected' }),
      ],
      threadLabels: { t1: ['JobsForge/Active'] }, // already correct
    });
    expect(p.counts['JobsForge/Active']).toBe(1);
    expect(p.counts['JobsForge/Closed']).toBe(1);
    expect(p.changes).toHaveLength(1); // only t2 needs a write
  });
});

describe('threadLabelsFromSnapshot', () => {
  it('unions labels across every message in a thread', () => {
    const out = threadLabelsFromSnapshot([
      { id: 't1', messages: [{ labels: ['INBOX', 'UNREAD'] }, { labels: ['INBOX', 'IMPORTANT'] }] },
    ]);
    expect(out.t1.sort()).toEqual(['IMPORTANT', 'INBOX', 'UNREAD']);
  });

  it('tolerates a message with no labels at all', () => {
    const out = threadLabelsFromSnapshot([{ id: 't1', messages: [{}] }]);
    expect(out.t1).toEqual([]);
  });
});

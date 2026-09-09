import { describe, expect, it } from 'vitest';
import {
  breakdownByRole, breakdownByVendor, buildFunnel, replyRate, stagesReached,
  timeToFirstHumanReply, timeToRejection, MIN_SAMPLE,
} from './funnel';
import type { AppEvent, Application } from './types';

const NOW = Date.parse('2026-09-09T12:00:00Z');
const DAY = 86_400_000;

function ev(type: AppEvent['type'], at: number, o: Partial<AppEvent> = {}): AppEvent {
  return {
    id: `${type}-${at}`, threadId: 't1', type, at, subject: type, from: 'x@acme.com',
    fromMe: false, confidence: 1, source: 'rules', ...o,
  };
}

function app(o: Partial<Application> = {}, flags: Partial<Application['flags']> = {}): Application {
  return {
    id: 'acme::pm', company: 'Acme', companyKey: 'acme', role: 'Senior Product Manager',
    roleKey: 'senior product manager#', reqIds: [], status: 'applied', statusRuleId: 'r',
    statusReason: 'x', decidedBy: 'rules', appliedAt: NOW - 30 * DAY, firstAt: NOW - 30 * DAY,
    lastAt: NOW - 20 * DAY, events: [], threadIds: ['t1'], provenance: { company: 'agent', role: 'agent' },
    mergeRuleIds: [], classificationByThread: {}, vendor: 'lever',
    flags: {
      recruiterReplied: false, awaitingMyReply: false, iReplied: false,
      deadlineAt: null, deadlineSource: null, deadlineMissed: false,
      interviewAt: null, interviewMissed: false, staleDays: 20,
      duplicateMessages: 0, talentPooled: false, needsReview: false, conflicting: false,
      ...flags,
    },
    ...o,
  };
}

describe('stagesReached', () => {
  it('credits interviewing from event history even after a later rejection', () => {
    // The whole point of computing from events, not final status: a rejected
    // application that WAS interviewed must still count toward "interviewing".
    const a = app({
      status: 'rejected',
      events: [ev('applied', NOW - 30 * DAY), ev('interview_scheduled', NOW - 25 * DAY), ev('rejection', NOW - 10 * DAY)],
    });
    expect(stagesReached(a).interviewing).toBe(true);
  });

  it('treats a manual entry status as a floor for earlier stages', () => {
    const a = app({ id: 'manual:1', threadIds: [], events: [], status: 'interviewing' });
    const s = stagesReached(a);
    expect(s.interviewing).toBe(true);
    expect(s.offer).toBe(false);
  });

  it('does not credit interviewing for a bare applied event', () => {
    const a = app({ events: [ev('applied', NOW - 30 * DAY)] });
    expect(stagesReached(a).interviewing).toBe(false);
  });
});

describe('buildFunnel', () => {
  it('counts an application with no captured applied/ack event, as long as status is not lead', () => {
    // The real bug this guards: Tekion is a human recruiter thread that opens
    // directly on an interview confirmation, with no acknowledgement email
    // ever captured, so appliedAt is null even though he plainly applied and
    // is mid-interview. Gating on appliedAt !== null silently dropped exactly
    // the direct/human-recruiter channel this phase exists to measure.
    const tekion = app({
      id: 'tekion', appliedAt: null, status: 'interviewing', vendor: undefined,
      events: [ev('interview_scheduled', NOW - 42 * DAY, { from: 'krawat@tekion.com' })],
    });
    const f = buildFunnel([tekion]);
    expect(f.applied).toBe(1);
    expect(f.interviewing).toBe(1);
  });

  it('excludes leads that were never applied to', () => {
    const lead = app({ id: 'lead', appliedAt: null, status: 'lead', events: [ev('referred', NOW)] });
    const applied = app({ id: 'applied', events: [ev('applied', NOW - 10 * DAY)] });
    const f = buildFunnel([lead, applied]);
    expect(f.applied).toBe(1);
  });

  it('never lets a conversion rate exceed 1 or go negative', () => {
    const apps = [
      app({ id: '1', events: [ev('applied', NOW - 10 * DAY), ev('interview_scheduled', NOW - 5 * DAY), ev('offer', NOW - 1 * DAY)] }),
      app({ id: '2', events: [ev('applied', NOW - 10 * DAY)] }),
    ];
    const f = buildFunnel(apps);
    expect(f.applied).toBe(2);
    expect(f.interviewing).toBe(1);
    expect(f.offer).toBe(1);
    expect(f.conversion.appliedToInterviewing).toBe(0.5);
    expect(f.conversion.interviewingToOffer).toBe(1);
    expect(f.conversion.appliedToOffer).toBe(0.5);
  });

  it('returns null rather than NaN or Infinity when a denominator is zero', () => {
    const f = buildFunnel([]);
    expect(f.conversion.appliedToInterviewing).toBeNull();
    expect(f.conversion.interviewingToOffer).toBeNull();
    expect(Number.isNaN(f.conversion.appliedToOffer)).toBe(false);
  });

  it('does not compute an applied -> reviewed conversion rate at all', () => {
    // Deliberate: most ATS platforms never send an explicit review signal, so
    // that transition would be structurally misleading.
    const f = buildFunnel([app({ events: [ev('applied', NOW)] })]);
    expect(f).not.toHaveProperty('conversion.appliedToReviewed');
    expect(f.reviewedIsFloor).toBe(true);
  });

  it('still reports reviewed as an informational count', () => {
    const f = buildFunnel([app({ events: [ev('applied', NOW - 10 * DAY), ev('under_review', NOW - 5 * DAY)] })]);
    expect(f.reviewed).toBe(1);
  });
});

describe('timeToFirstHumanReply', () => {
  it('measures to the first HUMAN reply, not the automated ack', () => {
    const a = app(
      {
        appliedAt: NOW - 20 * DAY,
        events: [
          ev('ack', NOW - 20 * DAY, { from: 'no-reply@lever.co' }),
          ev('outreach', NOW - 15 * DAY, { from: 'priya.rao@acme.com' }),
        ],
      },
      { recruiterReplied: true }
    );
    const s = timeToFirstHumanReply([a]);
    expect(s.n).toBe(1);
    expect(s.medianDays).toBe(5);
  });

  it('excludes applications with no human reply at all', () => {
    const a = app({ events: [ev('ack', NOW - 10 * DAY, { from: 'no-reply@lever.co' })] }, { recruiterReplied: false });
    expect(timeToFirstHumanReply([a]).n).toBe(0);
  });

  it('never reports a negative duration', () => {
    const a = app(
      { appliedAt: NOW - 5 * DAY, events: [ev('outreach', NOW - 5 * DAY, { from: 'p@acme.com' })] },
      { recruiterReplied: true }
    );
    expect(timeToFirstHumanReply([a]).minDays).toBeGreaterThanOrEqual(0);
  });
});

describe('timeToRejection', () => {
  it('measures from application to rejection', () => {
    const a = app({ appliedAt: NOW - 40 * DAY, events: [ev('rejection', NOW - 10 * DAY)] });
    expect(timeToRejection([a]).medianDays).toBe(30);
  });

  it('is empty when nothing was ever rejected', () => {
    expect(timeToRejection([app({ events: [ev('applied', NOW)] })]).n).toBe(0);
  });

  it('computes a sensible median for an odd and an even count', () => {
    const mk = (days: number) => app({ id: `r${days}`, appliedAt: NOW - days * DAY - 1, events: [ev('rejection', NOW - 1)] });
    expect(timeToRejection([mk(10), mk(20), mk(30)]).medianDays).toBeCloseTo(20, 0);
    expect(timeToRejection([mk(10), mk(20)]).medianDays).toBeCloseTo(15, 0);
  });
});

describe('replyRate', () => {
  it('computes the honest ghost rate: no human reply, regardless of current status', () => {
    // A ghosted-STATUS app and a rejected app that never had a human write are
    // both real "never heard from a person" cases and must both count.
    const apps = [
      app({ id: '1', status: 'ghosted' }, { recruiterReplied: false }),
      app({ id: '2', status: 'rejected' }, { recruiterReplied: false }),
      app({ id: '3', status: 'rejected' }, { recruiterReplied: true }),
    ];
    const r = replyRate(apps);
    expect(r.applied).toBe(3);
    expect(r.neverGotHumanReply).toBe(2);
    expect(r.ghostRate).toBeCloseTo(2 / 3);
  });

  it('excludes leads from the denominator', () => {
    const r = replyRate([app({ appliedAt: null, status: 'lead' })]);
    expect(r.applied).toBe(0);
    expect(r.ghostRate).toBeNull();
  });
});

describe('breakdownByVendor', () => {
  it('groups a human-sourced application under "direct"', () => {
    const rows = breakdownByVendor([app({ vendor: undefined })]);
    expect(rows.find((r) => r.key === 'direct')).toBeTruthy();
  });

  it('sorts larger samples first', () => {
    const rows = breakdownByVendor([
      app({ id: '1', vendor: 'lever' }), app({ id: '2', vendor: 'lever' }), app({ id: '3', vendor: 'lever' }),
      app({ id: '4', vendor: 'workday' }),
    ]);
    expect(rows[0].key).toBe('lever');
    expect(rows[0].applied).toBe(3);
  });

  it('excludes a vendor whose only applications are leads', () => {
    const rows = breakdownByVendor([app({ vendor: 'ashby', appliedAt: null, status: 'lead' })]);
    expect(rows).toEqual([]);
  });
});

describe('breakdownByRole', () => {
  it('groups an unstated role under its own bucket rather than dropping it', () => {
    const rows = breakdownByRole([app({ roleKey: null, role: null })]);
    expect(rows[0].key).toBe('unstated');
    expect(rows[0].label).toBe('Role not stated');
  });

  it('title-cases the normalized role base for display', () => {
    const rows = breakdownByRole([app({ roleKey: 'senior product manager#ai' })]);
    expect(rows[0].label).toBe('Senior Product Manager');
  });

  it('separates two roles that share a base but differ in qualifiers into ONE bucket', () => {
    // Breakdown groups by base title only (not the full roleKey), which is
    // the right level for "which kind of role converts" - Meesho's two reqs
    // are still both "product manager" for this purpose.
    const rows = breakdownByRole([
      app({ id: '1', roleKey: 'product manager 2#ai' }),
      app({ id: '2', roleKey: 'product manager 2#experience' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].applied).toBe(2);
  });
});

describe('small-sample honesty', () => {
  it('MIN_SAMPLE is exported so the UI can flag noisy rows', () => {
    expect(MIN_SAMPLE).toBeGreaterThan(1);
  });

  it('does not hide or suppress a small-sample row - the UI decides how to flag it', () => {
    const rows = breakdownByVendor([app({ vendor: 'ashby', flags: { ...app().flags, recruiterReplied: true } })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].applied).toBeLessThan(MIN_SAMPLE);
  });
});

describe('determinism', () => {
  it('produces identical output across repeated calls', () => {
    const apps = [app({ id: '1' }), app({ id: '2', vendor: 'ashby' })];
    expect(buildFunnel(apps)).toEqual(buildFunnel(apps));
    expect(breakdownByVendor(apps)).toEqual(breakdownByVendor(apps));
  });
});

import { describe, expect, it } from 'vitest';
import { buildFollowUpDraft, buildFollowUpPlan, shouldFollowUp } from './followUp';
import { summariseActivity, interviewPrepPrompt } from './activity';
import type { AppEvent, Application, JobStatus } from './types';

const NOW = Date.parse('2026-09-09T12:00:00Z');
const DAY = 86_400_000;

function ev(from: string, at: number, fromMe = false): AppEvent {
  return {
    id: `e-${from}-${at}`, threadId: 't1', type: 'other', at, subject: 's',
    from, fromMe, confidence: 1, source: 'rules',
  };
}

function app(o: Partial<Application> = {}, flags: Partial<Application['flags']> = {}): Application {
  return {
    id: 'acme::pm', company: 'Acme', companyKey: 'acme', role: 'Senior Product Manager',
    roleKey: 'pm#', reqIds: [], status: 'applied', statusRuleId: 'r', statusReason: 'x',
    decidedBy: 'rules', appliedAt: NOW - 30 * DAY, firstAt: NOW - 30 * DAY, lastAt: NOW - 30 * DAY,
    events: [], threadIds: ['t1'], provenance: { company: 'agent', role: 'agent' },
    mergeRuleIds: [], classificationByThread: {},
    flags: {
      recruiterReplied: false, awaitingMyReply: false, iReplied: false,
      deadlineAt: null, deadlineSource: null, deadlineMissed: false,
      interviewAt: null, interviewMissed: false, staleDays: 30,
      duplicateMessages: 0, talentPooled: false, needsReview: false, conflicting: false,
      ...flags,
    },
    ...o,
  };
}

describe('shouldFollowUp', () => {
  it('surfaces a stalled interview', () => {
    expect(shouldFollowUp(app({ status: 'interviewing' }, { staleDays: 42 }), 14))
      .toMatch(/Interviewed 42 days ago/);
  });

  it('leaves a fresh interview alone', () => {
    expect(shouldFollowUp(app({ status: 'interviewing' }, { staleDays: 3 }), 14)).toBeNull();
  });

  it('surfaces a lapsed application only when a real person was engaged', () => {
    expect(shouldFollowUp(app({ status: 'lapsed' }, { recruiterReplied: true }), 14)).not.toBeNull();
    expect(shouldFollowUp(app({ status: 'lapsed' }, { recruiterReplied: false }), 14)).toBeNull();
  });

  it('never chases a no-reply ATS address', () => {
    // The long tail of Workable acks has no human on the other end; emailing
    // them achieves nothing and costs credibility.
    expect(shouldFollowUp(app({ status: 'applied' }, { recruiterReplied: false, staleDays: 60 }), 14))
      .toBeNull();
  });

  it('chases a quiet application where a human did write', () => {
    expect(shouldFollowUp(app({ status: 'applied' }, { recruiterReplied: true, staleDays: 30 }), 14))
      .toMatch(/No reply for 30 days/);
  });

  it.each<JobStatus>(['rejected', 'role_closed', 'withdrawn', 'ghosted', 'offer', 'lead'])(
    'never follows up on %s',
    (status) => {
      expect(shouldFollowUp(app({ status }, { recruiterReplied: true, staleDays: 90 }), 14)).toBeNull();
    }
  );

  it('never follows up on an archived application', () => {
    expect(shouldFollowUp(app({ status: 'interviewing', archived: true }, { staleDays: 90 }), 14))
      .toBeNull();
  });
});

describe('buildFollowUpDraft', () => {
  it('addresses the last human who wrote, by first name', () => {
    const d = buildFollowUpDraft(
      app({ status: 'interviewing', events: [ev('no-reply@ashbyhq.com', NOW - 40 * DAY), ev('priya.rao@acme.com', NOW - 30 * DAY)] }),
      'stalled'
    );
    expect(d.to).toBe('priya.rao@acme.com');
    expect(d.body).toMatch(/^Hi Priya,/);
  });

  it('falls back to a neutral greeting with no human contact', () => {
    const d = buildFollowUpDraft(app({ events: [ev('no-reply@ashbyhq.com', NOW)] }), 'quiet');
    expect(d.to).toBeNull();
    expect(d.body).toMatch(/^Hello,/);
  });

  it('refuses to guess a name from a single-token localpart', () => {
    // krawat@tekion.com is far more likely initial+surname than a first name,
    // and "Hi Krawat," to a real recruiter is worse than "Hello,".
    const d = buildFollowUpDraft(app({ events: [ev('krawat@tekion.com', NOW)] }), 'quiet');
    expect(d.to).toBe('krawat@tekion.com');
    expect(d.body).toMatch(/^Hello,/);
  });

  it('does not invent a name from an opaque localpart', () => {
    const d = buildFollowUpDraft(app({ events: [ev('4ee2xsn39c6j@acme.com', NOW)] }), 'quiet');
    expect(d.body).toMatch(/^Hello,/);
  });

  it('names the role and the company in the body', () => {
    const d = buildFollowUpDraft(app({ status: 'interviewing' }, { staleDays: 42 }), 'stalled');
    expect(d.body).toContain('Senior Product Manager');
    expect(d.body).toContain('Acme');
    expect(d.body).toContain('42 days');
  });

  it('apologises rather than chases when the delay was his', () => {
    const d = buildFollowUpDraft(app({ status: 'lapsed' }), 'went cold');
    expect(d.body).toMatch(/Apologies for the delay/);
  });

  it('handles a missing role without printing "null"', () => {
    const d = buildFollowUpDraft(app({ role: null }), 'quiet');
    expect(d.body).not.toMatch(/null/);
    expect(d.subject).not.toMatch(/null/);
  });

  it('replies inside the human thread so it does not start cold', () => {
    const d = buildFollowUpDraft(
      app({ events: [ev('priya.rao@acme.com', NOW)], threadIds: ['t1', 't2'] }),
      'quiet'
    );
    expect(d.threadId).toBe('t1');
  });
});

describe('buildFollowUpPlan', () => {
  it('carries a do-not-send instruction the agent must honour', () => {
    const p = buildFollowUpPlan([], 14, NOW);
    expect(p.instruction).toMatch(/DRAFTS only/);
    expect(p.instruction).toMatch(/Do not send/);
  });

  it('sorts the most-neglected first', () => {
    const p = buildFollowUpPlan(
      [
        app({ id: 'a', status: 'interviewing' }, { staleDays: 20 }),
        app({ id: 'b', status: 'interviewing' }, { staleDays: 60 }),
      ],
      14,
      NOW
    );
    expect(p.drafts.map((d) => d.daysQuiet)).toEqual([60, 20]);
  });

  it('produces nothing when nothing qualifies', () => {
    expect(buildFollowUpPlan([app({ status: 'rejected' })], 14, NOW).drafts).toEqual([]);
  });
});

describe('summariseActivity', () => {
  it('reports the gap since the last real application', () => {
    const a = summariseActivity([app({ appliedAt: NOW - 10 * DAY })], 7, NOW);
    expect(a.daysSinceLastApplication).toBe(10);
    expect(a.nudge).toBe(true);
    expect(a.lastApplicationCompany).toBe('Acme');
  });

  it('does not nudge inside the threshold', () => {
    expect(summariseActivity([app({ appliedAt: NOW - 2 * DAY })], 7, NOW).nudge).toBe(false);
  });

  it('ignores leads and cold outreach he never applied to', () => {
    // appliedAt is null for a referral he never acted on - it must not count
    // as search activity.
    const a = summariseActivity([app({ appliedAt: null, status: 'lead' })], 7, NOW);
    expect(a.daysSinceLastApplication).toBeNull();
    expect(a.nudge).toBe(false);
    expect(a.appliedLast30).toBe(0);
  });

  it('counts the 7 and 30 day windows', () => {
    const a = summariseActivity(
      [
        app({ id: '1', appliedAt: NOW - 2 * DAY }),
        app({ id: '2', appliedAt: NOW - 20 * DAY }),
        app({ id: '3', appliedAt: NOW - 90 * DAY }),
      ],
      7,
      NOW
    );
    expect(a.appliedLast7).toBe(1);
    expect(a.appliedLast30).toBe(2);
  });

  it('handles an empty dashboard without dividing by nothing', () => {
    const a = summariseActivity([], 7, NOW);
    expect(a).toMatchObject({ daysSinceLastApplication: null, nudge: false, appliedLast7: 0 });
  });
});

describe('interviewPrepPrompt', () => {
  it('names the company, role and date, and points at his own tooling', () => {
    const p = interviewPrepPrompt(app({ company: 'Tekion' }, { interviewAt: NOW + 3 * DAY }));
    expect(p).toContain('Tekion');
    expect(p).toContain('Senior Product Manager');
    expect(p).toContain('interview-prep');
    expect(p).toContain('2026-09-12');
  });

  it('omits the date clause when there is no scheduled slot', () => {
    expect(interviewPrepPrompt(app())).not.toMatch(/The interview is on/);
  });
});

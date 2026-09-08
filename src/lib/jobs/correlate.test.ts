import { describe, expect, it } from 'vitest';
import { buildApplications } from './index';
import { applicationKey, dedupeEvents, isDiscriminativeRole, reconcileOverrides } from './correlate';
import { NOW, T } from './__fixtures__/mailbox';
import type { AgentHint, AppEvent, EmailThread, UserOverrides } from './types';
import type { JobsSnapshot } from './snapshot';
import { emptyOverrides } from './types';

function snap(threads: EmailThread[], hints: AgentHint[] = []): JobsSnapshot {
  return {
    kind: 'jobs-forge-snapshot',
    version: 1,
    generatedAt: new Date(NOW).toISOString(),
    window: { since: '2025-01-01T00:00:00Z', until: new Date(NOW).toISOString() },
    threads,
    hints,
  };
}

function build(threads: EmailThread[], hints: AgentHint[] = [], overrides?: UserOverrides) {
  return buildApplications(snap(threads, hints), { now: NOW, overrides });
}

describe('merges that must happen', () => {
  it('collapses Revolut into one application across three threads', () => {
    // Confirmation, rejection two hours later, talent-pool mail the next day.
    // Three subjects, three threads, one application.
    const r = build([T.revolutApplied, T.revolutRejected, T.revolutTalentPool]);
    expect(r.applications).toHaveLength(1);
    expect(r.applications[0].threadIds).toHaveLength(3);
    expect(r.applications[0].company).toBe('Revolut');
  });

  it('links the JPMorgan application to its rejection by requisition id alone', () => {
    // "We received your job application (Job Number: 210769925)" and
    // "Your job application status (Job number: 210769925)" share no other words.
    const r = build([T.jpmcApplied, T.jpmcRejected]);
    expect(r.applications).toHaveLength(1);
    expect(r.applications[0].reqIds).toContain('210769925');
    expect(r.applications[0].status).toBe('rejected');
  });

  it('links Rolls-Royce application to assessment', () => {
    const r = build([T.rollsRoyceApplied, T.rollsRoyceAssessment]);
    expect(r.applications).toHaveLength(1);
    expect(r.applications[0].company).toBe('Rolls-Royce');
  });

  it('merges the Civica ATS thread with the human recruiter thread', () => {
    const r = build([T.civicaWorkable, T.civicaHuman]);
    expect(r.applications).toHaveLength(1);
    const app = r.applications[0];
    expect(app.threadIds).toHaveLength(2);
    expect(app.flags.recruiterReplied).toBe(true);
    expect(app.flags.iReplied).toBe(true);
  });

  it('keeps a 14-month FairMoney thread as one application', () => {
    // Ack May 2025, rejection July 2026, same Gmail thread. The soft-join
    // window must never apply within a single thread.
    const r = build([T.fairmoney]);
    expect(r.applications).toHaveLength(1);
    expect(r.applications[0].status).toBe('rejected');
    expect(r.applications[0].lastAt - r.applications[0].firstAt).toBeGreaterThan(300 * 24 * 3600_000);
  });
});

describe('splits that must hold', () => {
  it('keeps the two Meesho roles apart', () => {
    // Product Manager II - AI vs Product Manager II - Experience.
    const r = build([T.meeshoAi, T.meeshoExperience]);
    expect(r.applications).toHaveLength(2);
    const keys = r.applications.map((a) => a.roleKey);
    expect(new Set(keys).size).toBe(2);
  });

  it('does not silently attach the role-less Meesho thread to either role', () => {
    // Attaching it would be a coin flip decided by iteration order. It stays
    // separate and gets flagged instead.
    const r = build([T.meeshoAi, T.meeshoExperience, T.meeshoNoRole]);
    expect(r.applications).toHaveLength(3);
    const orphan = r.applications.find((a) => a.threadIds.includes(T.meeshoNoRole.id));
    expect(orphan?.threadIds).toEqual([T.meeshoNoRole.id]);
  });

  it('treats two requisition ids at one company as two applications', () => {
    // Same company, same title, different JR numbers - genuinely two reqs.
    const a: EmailThread = {
      id: 'x1', subject: 'Your application for Product Owner with Rolls-Royce',
      messages: [{ id: 'x1m', at: '2026-06-01T10:00:00Z', from: { email: 'rollsroyce@myworkday.com' }, fromMe: false,
        subject: 'Your application for Product Owner with Rolls-Royce JR6155469', snippet: 'Thank you for applying' }],
    };
    const b: EmailThread = {
      id: 'x2', subject: 'Your application for Product Owner with Rolls-Royce',
      messages: [{ id: 'x2m', at: '2026-06-02T10:00:00Z', from: { email: 'rollsroyce@myworkday.com' }, fromMe: false,
        subject: 'Your application for Product Owner with Rolls-Royce JR7000001', snippet: 'Thank you for applying' }],
    };
    expect(build([a, b]).applications).toHaveLength(2);
  });

  it('does not merge GoKwik and Blitz behind an identical Keka subject', () => {
    // Byte-identical subjects from a multi-tenant sender. Merging them would
    // invent an application that never existed.
    const r = build([T.gokwik, T.blitzAck]);
    expect(r.applications).toHaveLength(2);
  });

  it('merges the Primetrace pair on a distinctive role qualifier', () => {
    // "SPM - Polo" carries a qualifier unique to this pair, so it can bridge a
    // thread whose company is unknown. A bare "Senior Product Manager" cannot.
    const r = build([T.primetraceScheduled, T.primetraceMissed]);
    expect(r.applications).toHaveLength(1);
  });
});

describe('isDiscriminativeRole', () => {
  it('accepts a unique qualified role and rejects a bare one', () => {
    const counts = new Map([['senior product manager#polo', 2], ['senior product manager#', 2]]);
    expect(isDiscriminativeRole('senior product manager#polo', counts)).toBe(true);
    expect(isDiscriminativeRole('senior product manager#', counts)).toBe(false);
  });
});

describe('event dedupe', () => {
  it('collapses the three identical Paytm rejections', () => {
    const r = build([T.paytm]);
    const app = r.applications[0];
    const rejections = app.events.filter((e) => e.type === 'rejection');
    expect(rejections).toHaveLength(1);
    expect(rejections[0].duplicateCount).toBe(3);
  });

  it('keeps the two Toptal nudges as separate events', () => {
    // The counter-test to the one above, and it lives here deliberately: the
    // gap between identical-subject nudges is the ONLY evidence he ignored the
    // process. A timestamp-free dedupe key would destroy it.
    const r = build([T.toptal]);
    const app = r.applications[0];
    expect(app.events.filter((e) => e.type === 'nudge')).toHaveLength(2);
  });

  it('does not collapse identical subjects sent days apart', () => {
    const events: AppEvent[] = [
      { id: 'a', threadId: 't', type: 'nudge', at: NOW - 10 * 86400_000, subject: 'Take the Next Step', from: 'r@x.com', fromMe: false, confidence: 1, source: 'rules' },
      { id: 'b', threadId: 't', type: 'nudge', at: NOW - 5 * 86400_000, subject: 'Take the Next Step', from: 'r@x.com', fromMe: false, confidence: 1, source: 'rules' },
    ];
    expect(dedupeEvents(events)).toHaveLength(2);
  });
});

describe('agent hints', () => {
  it('links the two Keka Blitz threads via applicationKey', () => {
    // One thread has a company but no role, the other a role but no company.
    // Only the agent, which read both bodies, can bridge them.
    const hints: AgentHint[] = [
      { threadId: T.blitzAck.id, company: 'Blitz', role: 'Senior Product Manager', applicationKey: 'blitz:spm' },
      { threadId: T.blitzStatus.id, company: 'Blitz', role: 'Senior Product Manager', applicationKey: 'blitz:spm' },
    ];
    const r = build([T.blitzAck, T.blitzStatus], hints);
    expect(r.applications).toHaveLength(1);
    expect(r.applications[0].company).toBe('Blitz');
  });

  it('honours distinctFrom against a would-be merge', () => {
    const hints: AgentHint[] = [{ threadId: T.revolutApplied.id, distinctFrom: [T.revolutRejected.id] }];
    const r = build([T.revolutApplied, T.revolutRejected], hints);
    expect(r.applications).toHaveLength(2);
  });

  it('fills a company the rules cannot reach', () => {
    // Ashby's transactional subjects never name the employer.
    const r = build([T.ashbyAck], [{ threadId: T.ashbyAck.id, company: 'Weave', role: 'Senior Product Manager' }]);
    expect(r.applications[0].company).toBe('Weave');
    expect(r.applications[0].provenance.company).toBe('agent');
  });
});

describe('user overrides beat everything', () => {
  it('forces a split the rules wanted to merge', () => {
    const overrides: UserOverrides = {
      ...emptyOverrides(),
      split: [[T.jpmcApplied.id, T.jpmcRejected.id]],
    };
    expect(build([T.jpmcApplied, T.jpmcRejected], [], overrides).applications).toHaveLength(2);
  });

  it('forces a merge the rules refused', () => {
    const overrides: UserOverrides = {
      ...emptyOverrides(),
      merge: [[T.meeshoAi.id, T.meeshoExperience.id]],
    };
    expect(build([T.meeshoAi, T.meeshoExperience], [], overrides).applications).toHaveLength(1);
  });
});

describe('stable identity', () => {
  it('produces the same ids regardless of input order', () => {
    const threads = [T.revolutApplied, T.revolutRejected, T.jpmcApplied, T.jpmcRejected, T.meeshoAi];
    const a = build(threads).applications.map((x) => x.id).sort();
    const b = build([...threads].reverse()).applications.map((x) => x.id).sort();
    expect(a).toEqual(b);
  });

  it('prefers a requisition id as the anchor', () => {
    expect(applicationKey({ companyKey: 'acme', roleKey: 'pm#', reqIds: ['JR1'], threadIds: ['t2', 't1'] }))
      .toBe('acme::JR1');
  });

  it('is order-independent when falling back to thread ids', () => {
    const a = applicationKey({ companyKey: '', roleKey: null, reqIds: [], threadIds: ['t2', 't1'] });
    const b = applicationKey({ companyKey: '', roleKey: null, reqIds: [], threadIds: ['t1', 't2'] });
    expect(a).toBe(b);
  });
});

describe('reconcileOverrides', () => {
  it('re-homes a note when the agent later supplies a missing company', () => {
    // The id legitimately changes from `unknown:t1::spm` to `blitz::spm`.
    // Without re-keying, the user's hand-written note silently detaches.
    const prev = [{ id: 'unknown:t1::spm', threadIds: ['t1', 't2'] }];
    const next = [{ id: 'blitz::spm', threadIds: ['t1', 't2'] }];
    const out = reconcileOverrides(prev, next, {
      ...emptyOverrides(),
      fields: { 'unknown:t1::spm': { notes: 'referred by Anand' } },
    });
    expect(out.fields['blitz::spm']?.notes).toBe('referred by Anand');
    expect(out.fields['unknown:t1::spm']).toBeUndefined();
  });

  it('leaves an override alone when its id still resolves', () => {
    const same = [{ id: 'acme::pm#', threadIds: ['t1'] }];
    const out = reconcileOverrides(same, same, {
      ...emptyOverrides(),
      fields: { 'acme::pm#': { status: 'withdrawn' } },
    });
    expect(out.fields['acme::pm#']?.status).toBe('withdrawn');
  });
});

describe('determinism', () => {
  it('returns identical output for identical input', () => {
    const threads = [T.revolutApplied, T.revolutRejected, T.civicaWorkable, T.civicaHuman, T.toptal];
    expect(build(threads)).toEqual(build(threads));
  });
});

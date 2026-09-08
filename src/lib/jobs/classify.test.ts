import { describe, expect, it } from 'vitest';
import { buildContext, classifyThread, scoreHuman } from './classify';
import { ALL_NOISE, ALL_TRUE_POSITIVES, T, thread, msg, ME } from './__fixtures__/mailbox';
import type { EmailThread } from './types';

function classify(t: EmailThread, others: EmailThread[] = []) {
  const ctx = buildContext([t, ...others], []);
  return classifyThread(t, ctx);
}

describe('true positives', () => {
  // The regression net: every real application sender must survive every future
  // tightening of the noise rules.
  it.each(ALL_TRUE_POSITIVES.map((t) => [t.id, t] as const))(
    '%s is not treated as noise',
    (_id, t) => {
      const cls = classify(t, ALL_TRUE_POSITIVES);
      // `unknown` is allowed: it means "review this by hand", which is honest.
      // Being filtered as noise is the failure that loses a job.
      expect(['spam_consultant', 'marketing', 'job_alert', 'transactional_noise', 'unrelated'])
        .not.toContain(cls.kind);
    }
  );

  it.each([
    ['mastercard (Workday)', T.mastercard],
    ['guidewire (Workday)', T.guidewire],
    ['meta (employer direct)', T.meta],
    ['ashby ack', T.ashbyAck],
    ['reo.dev candidacy update', T.reoDev],
    ['thoughtfull (Workable)', T.thoughtfull],
    ['hupo (Teamtailor)', T.hupo],
    ['lyzr (Teamtailor)', T.lyzr],
    ['niyo (Keka)', T.niyo],
    ['paytm (Lever)', T.paytm],
    ['swiggy (SmartRecruiters)', T.swiggy],
    ['jpmc applied (Oracle)', T.jpmcApplied],
    ['revolut applied', T.revolutApplied],
    ['rolls-royce assessment', T.rollsRoyceAssessment],
    ['kora (inbound.workablemail)', T.kora],
    ['sleek (inbound.workablemail)', T.sleek],
  ])('%s classifies as an application', (_label, t) => {
    expect(classify(t).kind).toBe('application');
  });
});

describe('noise', () => {
  it.each(ALL_NOISE.map((t) => [t.id, t] as const))('%s never becomes an application', (_id, t) => {
    expect(classify(t).kind).not.toBe('application');
  });

  it.each([
    ['freshersindia walk-in blast', T.freshersindia, 'spam_consultant'],
    ['freshersindia IBM (typo verbatim)', T.freshersindiaIbm, 'spam_consultant'],
    ['shine.com fake shortlisting', T.shine, 'spam_consultant'],
    ['coding ninjas course ad', T.codingNinjas, 'marketing'],
    ['IPO allotment', T.ipo, 'unrelated'],
    ['GST REG-07', T.gst, 'unrelated'],
    ['BankBazaar card assessment', T.bankBazaar, 'unrelated'],
    ['INSEAD marketing', T.insead, 'marketing'],
    ['talent500 funnel', T.talent500, 'job_alert'],
    ['glassdoor community post', T.glassdoor, 'job_alert'],
  ])('%s is excluded as %s', (_label, t, kind) => {
    expect(classify(t).kind).toBe(kind);
  });

  it('closes the naive /application/ keyword trap', () => {
    // "move your terminal test into your application code" - a SaaS newsletter.
    expect(classify(T.openRouter).kind).toBe('marketing');
  });
});

describe('same vendor, both classes', () => {
  it('separates the Swiggy application from the SmartRecruiters OTP', () => {
    expect(classify(T.swiggy).kind).toBe('application');
    expect(classify(T.swiggyOtp).kind).toBe('transactional_noise');
  });

  it('separates JPMorgan application mail from the identical-sender OTP', () => {
    // Oracle sends both from eino.fa.sender@...cloud.oracle.com. The topic gate
    // has to fire before the vendor lookup or the OTP becomes an application.
    expect(classify(T.jpmcApplied).kind).toBe('application');
    expect(classify(T.jpmcOtp).kind).toBe('transactional_noise');
  });

  it('separates the iimjobs job ad from its real status relay', () => {
    expect(classify(T.iimjobsAd).kind).toBe('job_alert');
    expect(classify(T.ixigoWithdrawn).kind).toBe('status_signal');
  });
});

describe('human senders', () => {
  it('recognises a named recruiter at Civica as a real person', () => {
    const cls = classify(T.civicaHuman, [T.civicaWorkable]);
    expect(cls.senderClass).toBe('human');
    expect(cls.kind).toBe('application');
  });

  it('still recognises her without the Workable cross-signal', () => {
    // The heuristic must not depend solely on a sibling ATS thread having
    // already named Civica, or a first-contact recruiter is invisible.
    const cls = classify(T.civicaHuman);
    expect(cls.kind).toBe('application');
  });

  it('recognises krecruiter@tekion.com despite a non-name localpart', () => {
    const cls = classify(T.tekion);
    expect(cls.senderClass).toBe('human');
    expect(['application', 'recruiter_outreach']).toContain(cls.kind);
  });

  it('scores the Tekion thread on the Greenhouse scheduler cc', () => {
    const ctx = buildContext([T.tekion], []);
    const withCc = scoreHuman(T.tekion, ctx);
    const withoutCc = scoreHuman(
      thread('t-tekion-nocc', [
        msg({ from: 'krecruiter@tekion.com', subject: 'Tekion Interview Confirmation', at: '2026-07-28T05:19:53Z' }),
      ]),
      ctx
    );
    // Pinned so a weight change shows up as a visible diff, not a silent
    // behaviour change.
    expect(withCc.signals).toContain('human/scheduler-cc');
    expect(withCc.score).toBeGreaterThan(withoutCc.score);
  });

  it('drops a personal-looking sender that carries bulk headers', () => {
    const bulk = thread('t-bulk', [
      msg({
        from: 'priya.sharma@somestaffing.in',
        subject: 'Opportunity at a top company for Product Manager',
        at: '2026-08-01T10:00:00Z',
        hasUnsubscribe: true,
      }),
    ]);
    const ctx = buildContext([bulk], []);
    expect(scoreHuman(bulk, ctx).signals).not.toContain('human/no-bulk-headers');
  });

  it('treats his own reply as near-conclusive evidence of a human thread', () => {
    const ctx = buildContext([T.civicaHuman], []);
    expect(scoreHuman(T.civicaHuman, ctx).signals).toContain('human/i-replied');
  });
});

describe('referrals and leads', () => {
  it('classifies the eBay referral as a referral, not an application', () => {
    // He was referred but never applied. Calling this "applied" would inflate
    // the pipeline and hide a live opportunity.
    expect(classify(T.ebayReferral).kind).toBe('referral');
  });
});

describe('agent hints', () => {
  it('lets a confident agent verdict override the rules', () => {
    const ctx = buildContext([T.openRouter], [
      { threadId: T.openRouter.id, kind: 'application', confidence: 0.9, reason: 'Checked the body.' },
    ]);
    const cls = classifyThread(T.openRouter, ctx);
    expect(cls.kind).toBe('application');
    expect(cls.source).toBe('agent');
  });

  it('ignores a low-confidence hint', () => {
    const ctx = buildContext([T.openRouter], [
      { threadId: T.openRouter.id, kind: 'application', confidence: 0.2 },
    ]);
    expect(classifyThread(T.openRouter, ctx).source).toBe('rules');
  });
});

describe('honest failure', () => {
  it('sends an unreadable ATS mail to review rather than inventing a status', () => {
    const opaque = thread('t-opaque', [
      msg({ from: 'someco@myworkday.com', subject: 'An update', at: '2026-08-01T10:00:00Z' }),
    ]);
    const cls = classify(opaque);
    expect(cls.kind).toBe('unknown');
    expect(cls.reasons).toContain('vendor/no-intent-matched');
  });

  it('never leaves a thread without a reason trail', () => {
    for (const t of [...ALL_TRUE_POSITIVES, ...ALL_NOISE]) {
      expect(classify(t).reasons.length).toBeGreaterThan(0);
    }
  });
});

describe('sanity', () => {
  it('does not classify his own outbound mail as a company', () => {
    const selfOnly = thread('t-self', [
      msg({ from: ME, fromMe: true, subject: 'Re: something', at: '2026-08-01T10:00:00Z' }),
    ]);
    expect(classify(selfOnly).kind).not.toBe('application');
  });
});

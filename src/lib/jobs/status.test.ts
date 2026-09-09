import { describe, expect, it } from 'vitest';
import { buildApplications } from './index';
import { deriveStatus, isHumanSender, STATUS_CONFIG } from './status';
import { NOW, T } from './__fixtures__/mailbox';
import type { AgentHint, AppEvent, EmailThread } from './types';
import type { JobsSnapshot } from './snapshot';

const DAY = 86400_000;

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
const build = (t: EmailThread[], h: AgentHint[] = []) => buildApplications(snap(t, h), { now: NOW });

function ev(type: AppEvent['type'], daysAgo: number, o: Partial<AppEvent> = {}): AppEvent {
  return {
    id: `${type}-${daysAgo}`,
    threadId: 't',
    type,
    at: NOW - daysAgo * DAY,
    subject: type,
    from: 'x@acme.com',
    fromMe: false,
    confidence: 1,
    source: 'rules',
    ...o,
  };
}

describe('terminal precedence', () => {
  it('treats a rejection as terminal in either order', () => {
    expect(deriveStatus({ events: [ev('ack', 60), ev('rejection', 10)], now: NOW }).status).toBe('rejected');
    expect(deriveStatus({ events: [ev('rejection', 60), ev('ack', 10)], now: NOW }).status).toBe('rejected');
  });

  it('lets an offer after a rejection win, and flags the anomaly', () => {
    const r = deriveStatus({ events: [ev('rejection', 20), ev('offer', 5)], now: NOW });
    expect(r.status).toBe('offer');
    // Surfacing the contradiction beats silently picking one.
    expect(r.flags.conflicting).toBe(true);
  });

  it('keeps a rejection that followed an earlier offer', () => {
    const r = deriveStatus({ events: [ev('offer', 20), ev('rejection', 5)], now: NOW });
    expect(r.status).toBe('rejected');
  });

  it('separates a withdrawn role from a rejection', () => {
    // Nothing about him - it must not read as a personal rejection.
    expect(deriveStatus({ events: [ev('ack', 30), ev('role_withdrawn', 5)], now: NOW }).status).toBe('role_closed');
    // But an explicit rejection is more specific and wins.
    expect(deriveStatus({ events: [ev('role_withdrawn', 30), ev('rejection', 5)], now: NOW }).status).toBe('rejected');
  });
});

describe('lapsed - he dropped it', () => {
  it('marks two ignored nudges as lapsed', () => {
    const r = deriveStatus({ events: [ev('ack', 40), ev('nudge', 30), ev('nudge', 25)], now: NOW });
    expect(r.status).toBe('lapsed');
    expect(r.ruleId).toBe('R6-nudges-ignored');
  });

  it('leaves recent nudges alone', () => {
    const r = deriveStatus({ events: [ev('ack', 20), ev('nudge', 5), ev('nudge', 3)], now: NOW });
    expect(r.status).not.toBe('lapsed');
  });

  it('does not lapse when he replied after the first nudge', () => {
    const r = deriveStatus({
      events: [ev('ack', 40), ev('nudge', 30), ev('other', 29, { fromMe: true }), ev('nudge', 25)],
      now: NOW,
    });
    expect(r.status).not.toBe('lapsed');
  });

  it('only lets an AGENT-sourced deadline kill an application', () => {
    // A regex that misreads a date must never bury a live application, so a
    // rule-derived past deadline falls through to action_needed instead.
    const agentDeadline = deriveStatus({
      events: [ev('assessment', 40, { deadlineAt: NOW - 30 * DAY, deadlineSource: 'agent' })],
      now: NOW,
    });
    expect(agentDeadline.status).toBe('lapsed');

    const ruleDeadline = deriveStatus({
      events: [ev('assessment', 40, { deadlineAt: NOW - 30 * DAY, deadlineSource: 'rules' })],
      now: NOW,
    });
    expect(ruleDeadline.status).toBe('action_needed');
  });
});

describe('ghosted - they dropped it', () => {
  it('marks long silence after an ack as ghosted', () => {
    expect(deriveStatus({ events: [ev('ack', 60)], now: NOW }).status).toBe('ghosted');
  });

  it('is still just applied inside the threshold', () => {
    const r = deriveStatus({ events: [ev('ack', 30)], now: NOW });
    expect(r.status).toBe('applied');
    expect(r.flags.staleDays).toBe(30);
  });

  it('never ghosts an application older than the scanned window', () => {
    // Otherwise "the agent did not look that far back" is reported to the user
    // as "they never replied", which is a lie.
    const events = [ev('ack', 300)];
    const r = deriveStatus({ events, now: NOW, windowSince: NOW - 90 * DAY });
    expect(r.status).not.toBe('ghosted');
  });
});

describe('flags', () => {
  it('identifies a real human and not an ATS robot', () => {
    expect(isHumanSender('recruiter.one@civica.com')).toBe(true);
    expect(isHumanSender('krecruiter@tekion.com')).toBe(true);
    expect(isHumanSender('screener.one@toptal.com')).toBe(true);
    expect(isHumanSender('no-reply@ashbyhq.com')).toBe(false);
    expect(isHumanSender('noreply@candidates.workablemail.com')).toBe(false);
    expect(isHumanSender('mastercard@myworkday.com')).toBe(false);
    expect(isHumanSender('recruitment-no-reply@revolut.com')).toBe(false);
  });

  it('sets awaitingMyReply only when a human asked something last', () => {
    const asked = deriveStatus({
      events: [ev('outreach', 3, { from: 'recruiter.one@civica.com', subject: 'Could you confirm your availability?' })],
      now: NOW,
    });
    expect(asked.flags.awaitingMyReply).toBe(true);

    const robot = deriveStatus({
      events: [ev('ack', 3, { from: 'no-reply@ashbyhq.com', subject: 'We received your application. Questions?' })],
      now: NOW,
    });
    expect(robot.flags.awaitingMyReply).toBe(false);
  });

  it('clears awaitingMyReply once he answers', () => {
    const r = deriveStatus({
      events: [
        ev('outreach', 5, { from: 'recruiter.one@civica.com', subject: 'Could you confirm your availability?' }),
        ev('other', 4, { fromMe: true, from: 'me@example.com' }),
      ],
      now: NOW,
    });
    expect(r.flags.awaitingMyReply).toBe(false);
  });
});

describe('the six items Gmail was burying', () => {
  it('Rolls-Royce: an unfinished assessment is action_needed', () => {
    const r = build([T.rollsRoyceApplied, T.rollsRoyceAssessment]);
    const app = r.applications.find((a) => a.company === 'Rolls-Royce');
    expect(app?.status).toBe('action_needed');
    expect(app?.statusRuleId).toBe('R7-action-needed');
  });

  it('Toptal: three ignored nudges are lapsed, not applied', () => {
    const app = build([T.toptal]).applications[0];
    expect(app.status).toBe('lapsed');
    expect(app.flags.recruiterReplied).toBe(true);
  });

  it('eBay: a referral he never acted on is a lead, not an application', () => {
    const app = build([T.ebayReferral]).applications[0];
    expect(app.status).toBe('lead');
    expect(app.appliedAt).toBeNull();
  });

  it('Primetrace: a missed interview is lapsed once the agent says so', () => {
    // The subject "Update on Your Application forSPM - Polo" is textually
    // indistinguishable from a routine status mail. Only the body says he did
    // not attend, so this is an agent judgment by design.
    const hints: AgentHint[] = [{
      threadId: T.primetraceMissed.id,
      eventOverrides: [{
        messageId: T.primetraceMissed.messages[0].id,
        type: 'interview_missed',
        note: 'He did not attend the scheduled interview.',
      }],
    }];
    const app = build([T.primetraceScheduled, T.primetraceMissed], hints).applications[0];
    expect(app.status).toBe('lapsed');
    expect(app.statusRuleId).toBe('R4-interview-missed');
  });

  it('Primetrace: without the hint it stays interviewing and asks for review', () => {
    const app = build([T.primetraceScheduled, T.primetraceMissed]).applications[0];
    expect(app.status).toBe('interviewing');
  });

  it('Civica: rejected, with the recruiter reply preserved', () => {
    const app = build([T.civicaWorkable, T.civicaHuman]).applications[0];
    expect(app.status).toBe('rejected');
    expect(app.flags.recruiterReplied).toBe(true);
    expect(app.flags.iReplied).toBe(true);
  });

  it('Tekion: a confirmed interview reads as interviewing', () => {
    const app = build([T.tekion]).applications[0];
    expect(app.status).toBe('interviewing');
    expect(app.flags.recruiterReplied).toBe(true);
  });
});

describe('end-to-end shapes', () => {
  it('Revolut: rejected two hours after applying, and talent-pooled', () => {
    const app = build([T.revolutApplied, T.revolutRejected, T.revolutTalentPool]).applications[0];
    expect(app.status).toBe('rejected');
    expect(app.flags.talentPooled).toBe(true);
  });

  it('Weave: a post-rejection survey does not reset staleness or status', () => {
    const r = deriveStatus({ events: [ev('rejection', 20), ev('survey', 19)], now: NOW });
    expect(r.status).toBe('rejected');
  });

  it('ixigo: a withdrawn posting is role_closed, not a rejection', () => {
    const app = build([T.ixigoWithdrawn], [
      { threadId: T.ixigoWithdrawn.id, kind: 'application', confidence: 0.9, company: 'ixigo', role: 'Senior Product Manager - Flights' },
    ]).applications[0];
    expect(app.status).toBe('role_closed');
  });

  it('Kora: a quiet Workable ack eventually ghosts', () => {
    const app = build([T.kora]).applications[0];
    expect(app.status).toBe('ghosted');
    expect(app.flags.staleDays).toBeGreaterThan(STATUS_CONFIG.ghostDays);
  });
});

describe('determinism', () => {
  it('never reads the clock internally', () => {
    const events = [ev('ack', 30), ev('nudge', 10)];
    expect(deriveStatus({ events, now: NOW })).toEqual(deriveStatus({ events, now: NOW }));
  });
});

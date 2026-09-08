import { describe, expect, it } from 'vitest';
import { needsYouReason } from './needsYou';
import type { Application, JobStatus } from './types';

const NOW = Date.parse('2026-09-08T12:00:00Z');
const DAY = 86400_000;

function app(status: JobStatus, flags: Partial<Application['flags']> = {}, extra: Partial<Application> = {}): Application {
  return {
    id: 'a', company: 'Acme', companyKey: 'acme', role: 'PM', roleKey: 'pm#', reqIds: [],
    status, statusRuleId: 'test', statusReason: 'because', decidedBy: 'rules',
    appliedAt: NOW - 30 * DAY, firstAt: NOW - 30 * DAY, lastAt: NOW - 1 * DAY,
    events: [], threadIds: ['t1'], provenance: { company: 'agent', role: 'agent' },
    flags: {
      recruiterReplied: false, awaitingMyReply: false, iReplied: false,
      deadlineAt: null, deadlineSource: null, deadlineMissed: false,
      interviewAt: null, interviewMissed: false, staleDays: 1,
      duplicateMessages: 0, talentPooled: false, needsReview: false, conflicting: false,
      ...flags,
    },
    ...extra,
  };
}

describe('needsYouReason', () => {
  it('surfaces an upcoming interview above everything', () => {
    const r = needsYouReason(app('interviewing', { interviewAt: NOW + 2 * DAY }), NOW);
    expect(r).toMatch(/Interview on/);
  });

  it('surfaces a human waiting on a reply', () => {
    expect(needsYouReason(app('applied', { recruiterReplied: true, awaitingMyReply: true }), NOW))
      .toBe('A person is waiting on your reply');
  });

  it('surfaces a blocking gate', () => {
    expect(needsYouReason(app('action_needed'), NOW)).toBe('because');
  });

  it('surfaces an interview that went silent', () => {
    // Tekion: interviewed six weeks ago, no outcome. Nobody chases this but him.
    const r = needsYouReason(app('interviewing', { staleDays: 42 }), NOW);
    expect(r).toBe('Interviewed 42 days ago with no outcome - worth following up');
  });

  it('leaves a fresh interview alone', () => {
    expect(needsYouReason(app('interviewing', { staleDays: 3 }), NOW)).toBeNull();
  });

  it('surfaces an unused referral', () => {
    // The eBay referral: a live opportunity that looks like old mail.
    expect(needsYouReason(app('lead'), NOW)).toBe('An opening you have not applied to yet');
  });

  it('surfaces a recently lapsed application', () => {
    expect(needsYouReason(app('lapsed', { staleDays: 26 }), NOW)).toBe('because');
  });

  it('lets an old lapsed application become history', () => {
    // Primetrace's missed interview is 84 days old - a fact, not a to-do.
    expect(needsYouReason(app('lapsed', { staleDays: 84 }), NOW)).toBeNull();
  });

  it.each<JobStatus>(['rejected', 'role_closed', 'withdrawn', 'ghosted'])(
    'never surfaces a closed application (%s)',
    (status) => {
      // Even with every urgent flag set - a closed application is not a to-do.
      expect(
        needsYouReason(app(status, { recruiterReplied: true, awaitingMyReply: true, interviewAt: NOW + DAY }), NOW)
      ).toBeNull();
    }
  );

  it('does not surface a quiet applied application', () => {
    expect(needsYouReason(app('applied', { staleDays: 20 }), NOW)).toBeNull();
  });
});

// Status derivation: a rule ladder over the merged event timeline.
//
// Every rule returns its own id so a test can pin the exact rule that fired and
// the UI can explain itself. `now` is always injected - nothing here reads the
// clock, which is what makes the whole pipeline testable.

import { DEFAULT_SETTINGS, type JobsSettings } from './settings';
import { GENERIC_LOCALPARTS, matchVendor } from './vendors';
import { senderLocalpart } from './normalize';
import type { AppEvent, AppFlags, EventType, StatusResult } from './types';

// Re-exported for the tests and callers that predate the settings store.
// DEFAULT_SETTINGS is the single source of truth for these numbers now.
export const STATUS_CONFIG = DEFAULT_SETTINGS;

export type StatusConfig = JobsSettings;

const DAY = 24 * 3600_000;

const ASKS_SOMETHING =
  /\?|please (?:confirm|share|let me know|reply|advise|send)|your availability|when (?:are|would|can) you|kindly|could you|awaiting your|looking forward to your (?:reply|response)/i;

export interface DeriveInput {
  events: AppEvent[];
  now: number;
  needsReview?: boolean;
  /** Whether the snapshot window even reaches back far enough to judge silence. */
  windowSince?: number;
  cfg?: Partial<StatusConfig>;
}

function has(events: AppEvent[], ...types: EventType[]): boolean {
  return events.some((e) => types.includes(e.type));
}

function last(events: AppEvent[], ...types: EventType[]): AppEvent | undefined {
  return [...events].reverse().find((e) => types.includes(e.type));
}

/**
 * A real human, as opposed to a mail robot or an ATS.
 *
 * Any ATS PLATFORM address is a robot, whether or not it is multi-tenant -
 * `mastercard@myworkday.com` puts the company in the localpart but is still
 * Workday sending automated mail. Only an employer's OWN domain carries both
 * kinds: `recruitment-no-reply@revolut.com` is a robot while
 * `screener.one@toptal.com` is a person, and there the localpart decides.
 *
 * This flag is the highest-value signal on the dashboard, so a false negative
 * here costs more than a false positive.
 */
export function isHumanSender(from: string): boolean {
  if (!from) return false;
  const vendor = matchVendor(from);
  if (vendor && vendor.id !== 'employer_direct') return false;
  const lp = senderLocalpart(from);
  if (!lp || GENERIC_LOCALPARTS.has(lp)) return false;
  // "recruitment-no-reply@revolut.com" is on the employer_direct vendor list,
  // but belt-and-braces for employers not yet listed.
  return !/no-?reply|do-?not-?reply|automated|notification/i.test(lp);
}

export function deriveFlags(input: DeriveInput): AppFlags {
  const { events, now } = input;
  const cfg = { ...STATUS_CONFIG, ...(input.cfg ?? {}) };
  const inbound = events.filter((e) => !e.fromMe);
  const lastEvent = events[events.length - 1];
  const lastInbound = [...inbound].reverse()[0];

  const recruiterReplied = inbound.some((e) => isHumanSender(e.from));
  const iReplied = events.some((e) => e.fromMe);

  // Waiting on him: the last word is theirs, a human wrote it, and it asks
  // something. All three, or every automated ack would look like a question.
  const lastIsInbound = !!lastEvent && !lastEvent.fromMe;
  const awaitingMyReply =
    lastIsInbound &&
    !!lastInbound &&
    isHumanSender(lastInbound.from) &&
    ASKS_SOMETHING.test(`${lastInbound.subject} ${lastInbound.note ?? ''}`);

  const deadlineEvent = last(events.filter((e) => e.deadlineAt), 'assessment', 'action_required', 'interview_invite', 'nudge', 'other');
  const withDeadline = [...events].reverse().find((e) => e.deadlineAt);
  const deadlineAt = withDeadline?.deadlineAt ?? null;
  const deadlineSource = withDeadline?.deadlineSource ?? null;
  void deadlineEvent;

  const withInterview = [...events].reverse().find((e) => e.interviewAt);
  const interviewAt = withInterview?.interviewAt ?? null;

  const interviewMissed =
    has(events, 'interview_missed') ||
    (!!interviewAt &&
      interviewAt < now - cfg.interviewMissedGraceHours * 3600_000 &&
      !has(events, 'offer', 'rejection') &&
      // Something arrived after the slot but it was not progress - suspicious.
      events.some((e) => e.at > interviewAt && e.type === 'other'));

  const lastAt = lastEvent?.at ?? now;
  const staleDays = Math.max(0, Math.floor((now - lastAt) / DAY));

  const deadlineMissed = !!deadlineAt && deadlineAt < now && !events.some((e) => e.at > deadlineAt && e.type !== 'nudge');

  return {
    recruiterReplied,
    awaitingMyReply,
    iReplied,
    deadlineAt,
    deadlineSource,
    deadlineMissed,
    interviewAt,
    interviewMissed,
    staleDays,
    duplicateMessages: events.reduce((n, e) => n + ((e.duplicateCount ?? 1) - 1), 0),
    talentPooled: has(events, 'talent_pool'),
    needsReview: !!input.needsReview,
    conflicting: false,
  };
}

/**
 * The ladder. First rule to fire wins.
 *
 * Terminal precedence deserves a note: a rejection beats every non-terminal
 * event regardless of order, which is what makes FairMoney (rejected 14 months
 * after the ack, in the same thread) and Revolut (rejected two hours after
 * applying) both come out `rejected`. An offer strictly after the last
 * rejection wins and raises `conflicting` - hiding that anomaly would be worse
 * than showing it.
 */
export function deriveStatus(input: DeriveInput): StatusResult {
  const cfg = { ...STATUS_CONFIG, ...(input.cfg ?? {}) };
  const events = [...input.events].sort((a, b) => a.at - b.at);
  const now = input.now;
  const flags = deriveFlags({ ...input, events });
  const agentDecided = events.some((e) => e.source === 'agent');
  const decidedBy: StatusResult['decidedBy'] = agentDecided ? 'agent' : 'rules';

  const rejection = last(events, 'rejection');
  const offer = last(events, 'offer');
  const withdrawn = last(events, 'role_withdrawn');

  // R1 - an offer after the last rejection.
  if (offer && (!rejection || offer.at > rejection.at)) {
    return {
      status: 'offer',
      ruleId: 'R1-offer',
      reason: rejection
        ? 'An offer arrived after a rejection on this application - worth checking by hand.'
        : 'An offer was extended.',
      flags: { ...flags, conflicting: !!rejection },
      decidedBy,
    };
  }

  // R2 - rejection beats everything non-terminal, in either order.
  if (rejection) {
    return {
      status: 'rejected',
      ruleId: 'R2-rejected',
      reason: 'They explicitly declined to move forward.',
      flags,
      decidedBy,
    };
  }

  // R3 - the role went away. Deliberately NOT a rejection: nothing about him.
  if (withdrawn) {
    return {
      status: 'role_closed',
      ruleId: 'R3-role-closed',
      reason: 'The role was withdrawn or is no longer available - this was not a rejection.',
      flags,
      decidedBy,
    };
  }

  // R4 - he did not show up.
  if (flags.interviewMissed) {
    return {
      status: 'lapsed',
      ruleId: 'R4-interview-missed',
      reason: 'A scheduled interview appears to have been missed.',
      flags,
      decidedBy,
    };
  }

  // R5 - a blown deadline. Only an AGENT-sourced deadline may kill an
  // application; a regex that misreads a date would otherwise silently bury a
  // live one, so rule-derived deadlines fall through to R7 instead.
  if (flags.deadlineMissed && flags.deadlineSource === 'agent') {
    return {
      status: 'lapsed',
      ruleId: 'R5-deadline-missed',
      reason: 'The deadline for a required step has passed with no response.',
      flags,
      decidedBy,
    };
  }

  // R6 - repeated nudges, never answered. This is the Toptal shape: an
  // invitation plus two "take the next step" reminders and no reply.
  const nudges = events.filter((e) => e.type === 'nudge');
  if (nudges.length >= 2) {
    const firstNudge = nudges[0];
    const repliedAfter = events.some((e) => e.fromMe && e.at > firstNudge.at);
    const lastNudge = nudges[nudges.length - 1];
    if (!repliedAfter && now - lastNudge.at > cfg.nudgeLapseDays * DAY) {
      return {
        status: 'lapsed',
        ruleId: 'R6-nudges-ignored',
        reason: `${nudges.length} reminders went unanswered - this process has stalled on your side.`,
        flags,
        decidedBy,
      };
    }
  }

  // R7 - a blocking gate is open. Reached only when any missed deadline was
  // rule-derived (R5 already handled agent-sourced ones), and a regex-parsed
  // date is not trusted enough to bury a live application.
  if (has(events, 'assessment', 'action_required')) {
    const gate = last(events, 'assessment', 'action_required');
    return {
      status: 'action_needed',
      ruleId: 'R7-action-needed',
      reason: gate?.type === 'assessment'
        ? 'An assessment is outstanding and waiting on you.'
        : 'They asked you for something and it is still outstanding.',
      flags,
      decidedBy,
    };
  }

  // R8 - an interview exists. Scheduling requests live here rather than in
  // `action_needed`, so two rules never fight over the same thread.
  if (has(events, 'interview_invite', 'interview_scheduled', 'interview_reminder')) {
    return {
      status: 'interviewing',
      ruleId: 'R8-interviewing',
      reason: flags.interviewAt && flags.interviewAt > now
        ? 'An interview is scheduled.'
        : 'You are in the interview stage, awaiting an outcome.',
      flags,
      decidedBy,
    };
  }

  // R9 - explicitly under review. Narrow on purpose: treating every ATS ack as
  // "in review" would empty out `applied` and make both buckets meaningless.
  if (has(events, 'under_review', 'shortlisted')) {
    return {
      status: 'in_review',
      ruleId: 'R9-in-review',
      reason: 'They confirmed your application is being reviewed.',
      flags,
      decidedBy,
    };
  }

  // R10 - contacted but never applied.
  const applied = has(events, 'applied', 'ack');
  if (!applied && has(events, 'outreach', 'referred', 'talent_pool')) {
    return {
      status: 'lead',
      ruleId: 'R10-lead',
      reason: has(events, 'referred')
        ? 'You were referred but have not applied yet.'
        : 'An opportunity you have not applied to.',
      flags,
      decidedBy,
    };
  }

  // R11 - silence. Clamped to the scanned window: without that clamp "no
  // rejection yet" and "the agent did not look that far back" are
  // indistinguishable, and `ghosted` becomes a lie.
  if (applied && flags.staleDays > cfg.ghostDays) {
    const windowOk = input.windowSince === undefined || events[0].at >= input.windowSince;
    if (windowOk) {
      return {
        status: 'ghosted',
        ruleId: 'R11-ghosted',
        reason: `No response in ${flags.staleDays} days.`,
        flags,
        decidedBy,
      };
    }
  }

  return {
    status: 'applied',
    ruleId: 'R12-applied',
    reason: flags.staleDays > cfg.staleWarnDays
      ? `Applied, no news for ${flags.staleDays} days.`
      : 'Applied and acknowledged.',
    flags,
    decidedBy,
  };
}

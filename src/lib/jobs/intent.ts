// Per-message intent detection.
//
// The hardest problem in this file is POLARITY. These two real subjects are
// near-identical strings with opposite meanings:
//
//   Lever      "Thank you for your interest in Paytm"        -> a REJECTION
//   Teamtailor "Thanks For Sharing Your Interest With Us!"   -> an ACK
//
// Guessing wrong in the rejection direction marks a live application dead and
// the user stops chasing it. Guessing wrong the other way leaves a dead
// application looking open, which the next refresh corrects. So the asymmetry
// is deliberate: a rejection is only ever derived from an UNAMBIGUOUS phrase,
// a vendor-scoped template, or an explicit agent override.

import type { AtsVendorId } from './vendors';
import type { EventType } from './types';

export interface IntentMatch {
  type: EventType;
  confidence: number;
  ruleId: string;
}

// ---- Polarity --------------------------------------------------------------

/** Phrases that can only mean "no". Safe to act on from a subject alone. */
const REJECT_UNAMBIGUOUS =
  /\bwas rejected\b|\bnot?\s+be\s+mov(?:e|ing)\s+forward|not\s+mov(?:e|ing)\s+forward|mov(?:e|ing)\s+forward\s+with\s+(?:other|another)|will\s+not\s+be\s+proceeding|not\s+(?:be\s+)?progress(?:ing)?|unsuccessful|regret\s+to\s+inform|decided\s+(?:not\s+to\s+)?(?:to\s+)?(?:move|proceed)\s+with\s+(?:other|another)|no\s+longer\s+under\s+consideration|not\s+(?:be\s+)?selected|(?:un|not\s+be\s+)?able\s+to\s+(?:give\s+it\s+a\s+)?favou?rable|not\s+an?\s+ideal\s+(?:fit|match)|decided\s+not\s+to\s+(?:progress|proceed|move)/i;

/**
 * Phrases that USUALLY accompany a rejection but also head plenty of acks.
 * Never sufficient on their own - they must be corroborated by an unambiguous
 * phrase in the body, a vendor template, or the agent.
 */
const REJECT_AMBIGUOUS =
  /thank you for your interest in|candidacy update|update on your (?:application|candidature)|thank you for your time|your (?:application|candidature) (?:at|with)\b|job application status/i;

/**
 * Vendor-scoped templates. Legitimate because a vendor's transactional
 * vocabulary is stable: Ashby's "Candidacy Update" is always a rejection, and
 * that is the ONLY cue in "Reo.Dev Candidacy Update".
 */
const VENDOR_INTENT_OVERRIDES: Partial<
  Record<AtsVendorId, { re: RegExp; type: EventType; confidence: number; ruleId: string }[]>
> = {
  ashby: [
    { re: /candidacy update/i, type: 'rejection', confidence: 0.75, ruleId: 'vendor/ashby-candidacy-update' },
    { re: /thank you for your interest,/i, type: 'rejection', confidence: 0.7, ruleId: 'vendor/ashby-interest-comma' },
  ],
  lever: [
    { re: /^thank you for your interest in\b(?!.*\bapplication\b)/i, type: 'rejection', confidence: 0.7, ruleId: 'vendor/lever-interest-in' },
  ],
  keka: [
    { re: /was rejected/i, type: 'rejection', confidence: 0.95, ruleId: 'vendor/keka-rejected' },
  ],
};

// ---- Non-polarity patterns -------------------------------------------------
// Ordered: the first match wins, so the specific precedes the generic.

const PATTERNS: { re: RegExp; type: EventType; confidence: number; ruleId: string }[] = [
  // Role withdrawn - distinct from a rejection. Not his fault, and it should
  // never look like one on the dashboard.
  { re: /^unpublished job notification|role is no longer available|position has been (?:closed|withdrawn|put on hold)|requisition (?:closed|cancelled)|no longer (?:recruiting|hiring) for/i, type: 'role_withdrawn', confidence: 0.9, ruleId: 'intent/role-withdrawn' },

  // Talent pool - a soft "no" dressed as a "maybe".
  { re: /stay up[- ]to[- ]date on future|future (?:career )?opportunities|talent (?:pool|community|network)|keep your (?:profile|CV) on file/i, type: 'talent_pool', confidence: 0.8, ruleId: 'intent/talent-pool' },

  // Interviews.
  { re: /^reminder:?\s*(?:your\s+)?upcoming interview|reminder:?\s*interview|gentle reminder for (?:your|the) interview/i, type: 'interview_reminder', confidence: 0.9, ruleId: 'intent/interview-reminder' },
  { re: /interview (?:confirmation|confirmed)|you'?re confirmed for your interview|online interview scheduled|^R\d\s+interview\b|interview scheduled|scheduled your interview/i, type: 'interview_scheduled', confidence: 0.9, ruleId: 'intent/interview-scheduled' },
  { re: /interview invitation|invitation to interview|invite you (?:to|for) an? interview|schedule (?:your|an?) interview|initial interview invitation|book (?:a|your) (?:slot|time)/i, type: 'interview_invite', confidence: 0.85, ruleId: 'intent/interview-invite' },
  { re: /^interview with\b|\binterview\b.*\bwith\s+(?:the\s+)?(?:hiring manager|panel)/i, type: 'interview_scheduled', confidence: 0.7, ruleId: 'intent/interview-with' },

  // Offers. Guarded against "offer" the marketing noun.
  { re: /\boffer letter\b|we(?:'re| are) (?:delighted|pleased|excited) to offer|extend(?:ing)? (?:you )?an offer|your offer (?:of employment|details)/i, type: 'offer', confidence: 0.9, ruleId: 'intent/offer' },

  // A blocking gate on him.
  { re: /complete (?:the |your |an )?online assessment|complete (?:the |your )?assessment|take[- ]home|coding (?:test|challenge)|complete (?:your )?(?:test|evaluation)/i, type: 'assessment', confidence: 0.9, ruleId: 'intent/assessment' },
  { re: /action (?:required|needed)|please (?:complete|submit|record|upload)|record a video|awaiting your (?:response|action)|we need(?: some)? (?:more )?information|your availability/i, type: 'action_required', confidence: 0.75, ruleId: 'intent/action-required' },

  // Nudges. Two of these with no reply between them is how an ignored process
  // is detected, so they must stay separate events (see dedupeEvents).
  { re: /take the next step|it looks like you haven'?t|you have not (?:scheduled|completed|recorded)|still interested|friendly reminder|following up on/i, type: 'nudge', confidence: 0.8, ruleId: 'intent/nudge' },

  // Progress.
  { re: /(?:you(?:'ve| have) been )?shortlisted|moving (?:you )?(?:forward|to the next)|advance(?:d)? to the next (?:round|stage)|pleased to (?:inform|share) .*(?:next|progress)/i, type: 'shortlisted', confidence: 0.8, ruleId: 'intent/shortlisted' },
  { re: /(?:currently |now )?(?:under|in) review|reviewing your application|being reviewed|will be reviewed by/i, type: 'under_review', confidence: 0.7, ruleId: 'intent/under-review' },

  // Referral - an opportunity, not yet an application.
  { re: /you have been referred|has (?:submitted|referred) your (?:information|profile)|employee referral/i, type: 'referred', confidence: 0.9, ruleId: 'intent/referred' },

  // Surveys never change a status, but must not read as silence either.
  { re: /anonymous survey|we want to know what you think|share your (?:feedback|experience)|candidate experience survey/i, type: 'survey', confidence: 0.85, ruleId: 'intent/survey' },

  // Submission confirmations.
  { re: /(?:was |been )submitted successfully|successfully submitted|your application (?:was|has been) (?:received|submitted)|copy of your application data/i, type: 'applied', confidence: 0.95, ruleId: 'intent/applied' },
  { re: /thank you for (?:your )?apply|thank you for applying|thanks for applying|taking the time to apply|thank you for your application|we(?:'ve| have|) received your (?:job |interest and )?application|application (?:for .+ )?received|thank you for your interest in (?:joining|working)|glad to have received|thanks for (?:your interest|sharing your interest)|thank you so much for your interest|your journey with .+ starts here|welcome!? your application/i, type: 'ack', confidence: 0.9, ruleId: 'intent/ack' },
  // "Application to Product Strategy Manager position confirmed" (Revolut)
  { re: /application (?:to|for) .+ (?:position )?confirmed|^your application (?:for|to)\b|application (?:successfully )?confirmed/i, type: 'ack', confidence: 0.85, ruleId: 'intent/ack-confirmed' },
];

const OUTREACH =
  /\b(?:we are|we're|i am|i'm) (?:reaching out|hiring|recruiting)|would you be (?:open|interested|available)|opportunity (?:at|with)|considering joining|explore(?:ing)? (?:a|an|the) (?:role|opportunity)|thrilled that you are considering/i;

/**
 * Real mail is full of typographic quotes: "We’ve Received Your Application"
 * uses U+2019, not an ASCII apostrophe, so every `'` in a pattern missed.
 */
function flatten(s: string): string {
  return (s || '').replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"');
}

export interface DetectOptions {
  vendor?: AtsVendorId;
  /** Agent-trimmed leading text. Always present, and usually decisive. */
  snippet?: string;
  /** Present only where the agent judged the full body load-bearing. */
  bodyText?: string;
}

/**
 * Classify one message. `subject` is always searched; `bodyText` is searched
 * only for polarity corroboration, because bodies are long and full of
 * boilerplate that would otherwise trip every pattern.
 */
export function detectIntent(subject: string, opts: DetectOptions = {}): IntentMatch {
  const s = flatten(subject);
  const snippet = flatten(opts.snippet ?? '');
  const body = flatten(opts.bodyText ?? '');
  // Many real acks carry no intent word in the subject at all - Workable sends
  // "Senior Product Manager (APAC) - Kora" and puts "we have received your
  // application" in the first line of the body.
  const secondary = `${snippet}\n${body}`;

  // 1. Unambiguous rejection anywhere wins outright.
  if (REJECT_UNAMBIGUOUS.test(s)) {
    return { type: 'rejection', confidence: 0.95, ruleId: 'intent/reject-unambiguous-subject' };
  }
  if (secondary.trim() && REJECT_UNAMBIGUOUS.test(secondary)) {
    return { type: 'rejection', confidence: 0.9, ruleId: 'intent/reject-unambiguous-body' };
  }

  // 2. Vendor-scoped templates, before the generic tables.
  const overrides = opts.vendor ? VENDOR_INTENT_OVERRIDES[opts.vendor] : undefined;
  if (overrides) {
    for (const o of overrides) {
      if (o.re.test(s)) return { type: o.type, confidence: o.confidence, ruleId: o.ruleId };
    }
  }

  // 3. Everything else - subject first, because it is the highest-precision
  //    field, then the leading body text at a slight confidence discount.
  for (const p of PATTERNS) {
    if (p.re.test(s)) return { type: p.type, confidence: p.confidence, ruleId: p.ruleId };
  }
  for (const p of PATTERNS) {
    if (secondary.trim() && p.re.test(secondary)) {
      return { type: p.type, confidence: p.confidence - 0.1, ruleId: `${p.ruleId}-body` };
    }
  }

  // 4. Ambiguous polarity with no corroboration. Deliberately downgraded to a
  //    low-confidence `other` rather than a rejection: leaving a dead
  //    application open is recoverable, killing a live one is not.
  if (REJECT_AMBIGUOUS.test(s)) {
    return { type: 'other', confidence: 0.3, ruleId: 'intent/ambiguous-polarity-unresolved' };
  }

  if (OUTREACH.test(s) || (secondary.trim() && OUTREACH.test(secondary))) {
    return { type: 'outreach', confidence: 0.6, ruleId: 'intent/outreach' };
  }

  return { type: 'other', confidence: 0.2, ruleId: 'intent/none' };
}

/** Event types that prove he actually applied (vs merely being contacted). */
export const APPLICATION_EVIDENCE: ReadonlySet<EventType> = new Set<EventType>([
  'applied', 'ack', 'under_review', 'shortlisted', 'assessment', 'action_required',
  'interview_invite', 'interview_scheduled', 'interview_reminder', 'interview_missed',
  'offer', 'rejection', 'role_withdrawn', 'talent_pool', 'survey',
]);

export const TERMINAL_EVENTS: ReadonlySet<EventType> = new Set<EventType>([
  'rejection', 'role_withdrawn', 'offer',
]);

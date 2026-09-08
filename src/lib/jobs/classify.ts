// Thread classification.
//
// Two passes, and the ordering is load-bearing:
//
//   Pass 1  classify ATS threads and harvest the company domains they name.
//   Pass 2  run the human-sender heuristic WITH that set populated, so
//           a recruiter writing from civica.com is recognised as a real
//           person, because a Workable thread already told us Civica is a
//           company he applied to.
//
// Nothing is ever silently dropped. A thread we cannot place becomes `unknown`
// and lands in the review drawer.

import { detectIntent, APPLICATION_EVIDENCE } from './intent';
import { findAmbiguousSender, findDeniedSender, findTopicGate, type AmbiguousSender, type DenyRule } from './noise';
import { extractFromThread } from './extract';
import { companyKey, senderDomain, senderLocalpart } from './normalize';
import { GENERIC_LOCALPARTS, SCHEDULER_DOMAINS, matchVendor, type AtsVendor } from './vendors';
import type { AgentHint, EmailThread, EventType, ThreadKind } from './types';

export type SenderClassKind = 'ats' | 'human' | 'corporate-noreply' | 'denied' | 'ambiguous' | 'unknown';

export interface ClassifyContext {
  hints: Map<string, AgentHint>;
  /** Domains of companies we already know he applied to (built in pass 1). */
  knownCompanyDomains: Set<string>;
  knownCompanyKeys: Set<string>;
}

export interface Classification {
  kind: ThreadKind;
  confidence: number;
  vendor?: AtsVendor;
  senderClass: SenderClassKind;
  /** Rule ids in fire order - the UI's "why?" trail. */
  reasons: string[];
  source: 'agent' | 'rules';
  /** Per-message intents, reused by correlate so we detect only once. */
  intents: { messageId: string; type: EventType; confidence: number; ruleId: string }[];
  noiseRule?: DenyRule;
}

// ---- The human-sender heuristic --------------------------------------------
//
// Additive score, threshold 5. Deliberately does not lean on the localpart
// looking like a name: `krecruiter@tekion.com` is a real recruiter and fails every
// name pattern. The two signals that actually carry are "he replied in this
// thread" and "a scheduling bot is cc'd".

const PERSON_LOCALPART = /^[a-z]+(?:[._-][a-z]{1,20}){1,3}$/;

const ROLE_LANGUAGE =
  /\binterview\b|\bscreening\b|shortlist|\brole\b|\bposition\b|opportunity|notice period|\bCTC\b|availability|your (?:profile|resume|CV)|candidate/i;

interface HumanSignal {
  id: string;
  weight: number;
  test: (t: EmailThread, ctx: ClassifyContext) => boolean;
}

const HUMAN_SIGNALS: HumanSignal[] = [
  {
    id: 'human/personal-localpart',
    weight: 3,
    test: (t) => {
      const lp = firstInboundLocalpart(t);
      return !!lp && PERSON_LOCALPART.test(lp) && !GENERIC_LOCALPARTS.has(lp);
    },
  },
  {
    // Near-conclusive: he does not reply to robots.
    id: 'human/i-replied',
    weight: 4,
    test: (t) => t.messages.some((m) => m.fromMe),
  },
  {
    id: 'human/no-bulk-headers',
    weight: 3,
    test: (t) =>
      !t.messages.some(
        (m) => m.hasUnsubscribe || m.listId || m.labels?.includes('CATEGORY_PROMOTIONS')
      ),
  },
  {
    id: 'human/multi-party',
    weight: 2,
    test: (t) => new Set(t.messages.filter((m) => !m.fromMe).map((m) => m.from.email)).size >= 2,
  },
  {
    // A Greenhouse/Calendly bot in cc means a real interview loop.
    id: 'human/scheduler-cc',
    weight: 2,
    test: (t) =>
      t.messages.some((m) =>
        [...(m.cc ?? []), ...(m.to ?? [])].some((a) =>
          SCHEDULER_DOMAINS.some((d) => senderDomain(a.email).endsWith(d))
        )
      ),
  },
  {
    id: 'human/known-company-domain',
    weight: 3,
    test: (t, ctx) => {
      const host = firstInboundDomain(t);
      if (!host) return false;
      return ctx.knownCompanyDomains.has(host) || ctx.knownCompanyKeys.has(companyKey(host));
    },
  },
  {
    id: 'human/role-language',
    weight: 2,
    test: (t) =>
      ROLE_LANGUAGE.test(
        t.messages.map((m) => `${m.subject} ${m.snippet ?? ''}`).join(' ')
      ),
  },
];

const HUMAN_THRESHOLD = 5;

function firstInbound(t: EmailThread) {
  return t.messages.find((m) => !m.fromMe) ?? t.messages[0];
}
function firstInboundLocalpart(t: EmailThread): string {
  const m = firstInbound(t);
  return m ? senderLocalpart(m.from.email) : '';
}
function firstInboundDomain(t: EmailThread): string {
  const m = firstInbound(t);
  return m ? senderDomain(m.from.email) : '';
}

export function scoreHuman(t: EmailThread, ctx: ClassifyContext): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  for (const s of HUMAN_SIGNALS) {
    if (s.test(t, ctx)) {
      score += s.weight;
      signals.push(s.id);
    }
  }
  return { score, signals };
}

// ---- Classification --------------------------------------------------------

function intentsFor(t: EmailThread, vendor?: AtsVendor) {
  return t.messages
    .filter((m) => !m.fromMe)
    .map((m) => {
      const i = detectIntent(m.subject, { vendor: vendor?.id, snippet: m.snippet, bodyText: m.bodyText });
      return { messageId: m.id, ...i };
    });
}

function applyEventOverrides(
  intents: { messageId: string; type: EventType; confidence: number; ruleId: string }[],
  hint?: AgentHint
) {
  if (!hint?.eventOverrides?.length) return intents;
  const byId = new Map(hint.eventOverrides.map((o) => [o.messageId, o]));
  return intents.map((i) => {
    const o = byId.get(i.messageId);
    return o ? { ...i, type: o.type, confidence: 1, ruleId: 'agent/event-override' } : i;
  });
}

export function classifyThread(t: EmailThread, ctx: ClassifyContext): Classification {
  const reasons: string[] = [];
  const hint = ctx.hints.get(t.id);
  const subjects = t.messages.filter((m) => !m.fromMe).map((m) => m.subject);
  const first = firstInbound(t);
  const vendor = first ? matchVendor(first.from.email) : undefined;
  const intents = applyEventOverrides(intentsFor(t, vendor), hint);

  // 1. An explicit, confident agent verdict short-circuits everything.
  if (hint?.kind && (hint.confidence ?? 1) >= 0.5) {
    reasons.push('agent/kind');
    return {
      kind: hint.kind,
      confidence: hint.confidence ?? 0.9,
      vendor,
      senderClass: vendor ? 'ats' : 'unknown',
      reasons,
      source: 'agent',
      intents,
    };
  }

  // 2. Topic gates, BEFORE the vendor lookup. Being an ATS does not immunise an
  //    OTP - Oracle sends JPMorgan's application mail and "confirm your
  //    identity" from the identical address.
  const gate = findTopicGate(subjects);
  if (gate) {
    reasons.push(gate.rule.id);
    return { kind: gate.kind, confidence: 0.9, vendor, senderClass: 'denied', reasons, source: 'rules', intents, noiseRule: gate.rule };
  }

  // 3. Hard sender denylist.
  const denied = first ? findDeniedSender(first.from.email) : undefined;
  if (denied) {
    reasons.push(denied.rule.id);
    return { kind: denied.kind, confidence: 0.95, vendor, senderClass: 'denied', reasons, source: 'rules', intents, noiseRule: denied.rule };
  }

  // 4. Ambiguous senders: iimjobs carries job ads AND real status relays.
  const ambiguous = first ? findAmbiguousSender(first.from.email) : undefined;
  if (ambiguous) {
    const promoted = promoteAmbiguous(ambiguous, subjects);
    if (promoted) {
      reasons.push(ambiguous.id, 'ambiguous/promoted-to-status-signal');
      return { kind: 'status_signal', confidence: 0.7, vendor, senderClass: 'ambiguous', reasons, source: 'rules', intents };
    }
    reasons.push(ambiguous.id, 'ambiguous/default-noise');
    return { kind: ambiguous.defaultKind, confidence: 0.8, vendor, senderClass: 'ambiguous', reasons, source: 'rules', intents };
  }

  // 5. A known ATS vendor. The allowlist says only "capable of carrying
  //    application mail" - intent decides what this thread actually is.
  if (vendor) {
    reasons.push(`vendor/${vendor.id}`);
    const types = new Set(intents.map((i) => i.type));
    const hasEvidence = intents.some((i) => APPLICATION_EVIDENCE.has(i.type));
    if (hasEvidence) {
      reasons.push('vendor/application-evidence');
      return { kind: 'application', confidence: vendor.trustedAck ? 0.95 : 0.8, vendor, senderClass: 'ats', reasons, source: 'rules', intents };
    }
    if (types.has('referred')) {
      reasons.push('vendor/referral-only');
      return { kind: 'referral', confidence: 0.9, vendor, senderClass: 'ats', reasons, source: 'rules', intents };
    }
    if (types.has('outreach') || types.has('nudge')) {
      reasons.push('vendor/outreach-only');
      return { kind: 'recruiter_outreach', confidence: 0.7, vendor, senderClass: 'ats', reasons, source: 'rules', intents };
    }
    // Honest outcome: an ATS mail we cannot read. Review drawer, not invention.
    reasons.push('vendor/no-intent-matched');
    return { kind: 'unknown', confidence: 0.4, vendor, senderClass: 'ats', reasons, source: 'rules', intents };
  }

  // 6. A human writing from a company domain.
  const human = scoreHuman(t, ctx);
  if (human.score >= HUMAN_THRESHOLD) {
    reasons.push(...human.signals, `human/score-${human.score}`);
    const types = new Set(intents.map((i) => i.type));
    const hasEvidence = intents.some((i) => APPLICATION_EVIDENCE.has(i.type));
    if (hasEvidence) {
      reasons.push('human/application-evidence');
      return { kind: 'application', confidence: 0.8, senderClass: 'human', reasons, source: 'rules', intents };
    }
    if (types.has('referred')) {
      return { kind: 'referral', confidence: 0.8, senderClass: 'human', reasons, source: 'rules', intents };
    }
    reasons.push('human/outreach');
    return { kind: 'recruiter_outreach', confidence: 0.7, senderClass: 'human', reasons, source: 'rules', intents };
  }
  reasons.push(`human/score-${human.score}-below-threshold`);

  // 7. A corporate no-reply we do not recognise, but carrying real evidence.
  const lp = firstInboundLocalpart(t);
  if (GENERIC_LOCALPARTS.has(lp) && intents.some((i) => APPLICATION_EVIDENCE.has(i.type))) {
    reasons.push('corporate-noreply/application-evidence');
    return { kind: 'application', confidence: 0.6, senderClass: 'corporate-noreply', reasons, source: 'rules', intents };
  }

  reasons.push('classify/no-rule-matched');
  return { kind: 'unknown', confidence: 0.2, senderClass: 'unknown', reasons, source: 'rules', intents };
}

function promoteAmbiguous(a: AmbiguousSender, subjects: string[]): boolean {
  return a.statusPatterns.some((p) => subjects.some((s) => p.re.test(s)));
}

// ---- Pass 1: build the context ---------------------------------------------

/**
 * Harvests the company identities that ATS threads reveal, so pass 2's human
 * heuristic can recognise a recruiter writing from one of those domains.
 */
export function buildContext(threads: EmailThread[], hints: AgentHint[]): ClassifyContext {
  const hintMap = new Map(hints.map((h) => [h.threadId, h]));
  const ctx: ClassifyContext = {
    hints: hintMap,
    knownCompanyDomains: new Set(),
    knownCompanyKeys: new Set(),
  };

  for (const t of threads) {
    const first = firstInbound(t);
    if (!first) continue;
    const vendor = matchVendor(first.from.email);
    const hint = hintMap.get(t.id);
    if (!vendor && !hint?.company && !hint?.companyDomain) continue;
    const { company } = extractFromThread(t, vendor, hint);
    if (company) {
      ctx.knownCompanyKeys.add(companyKey(company.value));
    }
    if (hint?.companyDomain) {
      ctx.knownCompanyDomains.add(hint.companyDomain.toLowerCase());
      ctx.knownCompanyKeys.add(companyKey(hint.companyDomain));
    }
  }
  return ctx;
}

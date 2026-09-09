// Company / role / requisition-id extraction, with provenance on every field.
//
// Provenance matters as much as the value: the UI has to be able to say
// "company came from the sender domain" vs "company came from the agent", and
// a rule can only be trusted as far as its weakest source.

import {
  canonicalCompany,
  companyKey,
  extractReqIds,
  parseRole,
  senderDomain,
  senderLocalpart,
  type ParsedRole,
  type ReqId,
} from './normalize';
import { GENERIC_LOCALPARTS, type AtsVendor } from './vendors';
import type { AgentHint, EmailThread, Field, ProvenanceSource } from './types';

export interface Extracted {
  company: Field<string> | null;
  role: Field<string> | null;
  reqIds: ReqId[];
  templateId?: string;
}

// ---- Cleanup ---------------------------------------------------------------

// Trailing sentence fragments that follow a captured company in real subjects:
// "... at SWIGGY is Received", "Your journey with Hupo starts here!".
const COMPANY_TAIL =
  /\s+(?:is\s+received|starts\s+here|was\s+rejected|has\s+been\s+received|team|careers?|hiring team|recruitment|talent acquisition)\b.*$/i;

function cleanCompany(raw: string): string {
  return raw
    .replace(COMPANY_TAIL, '')
    .replace(/[!?.,;:]+\s*$/g, '')
    .replace(/\s*\|\s*$/g, '')
    .replace(/^\s*(?:the|joining|us at|team at)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ROLE_TAIL = /\s+(?:role|position|job|opportunity|opening|vacancy)\b\s*$/i;

function cleanRole(raw: string): string {
  return raw
    .replace(/^\s*(?:the|our|an?|for)\s+/i, '')
    .replace(ROLE_TAIL, '')
    .replace(/[!?.,;:]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A captured "role" that is really a sentence opener, not a job title. */
const COURTESY_PREFIX = /^(?:thanks?|thank you|hi|hello|dear|welcome|congratulations)\b/i;

const ROLE_WORD =
  /manager|engineer|owner|lead|designer|analyst|director|specialist|associate|architect|scientist|consultant|executive|developer|officer|head\b|intern|president|principal|staff/i;

/** Does this string read like a job title rather than a company name? */
export function looksLikeRole(s: string): boolean {
  return ROLE_WORD.test(s);
}

// ---- Subject templates -----------------------------------------------------
// Ordered most-specific first. Every entry is here because a real subject in
// the mailbox needed it; the comment names that subject.

interface Template {
  id: string;
  re: RegExp;
  company?: number;
  role?: number;
  /** Segment-splitting templates handle their own assignment. */
  segments?: 'dash' | 'pipe';
}

const TEMPLATES: Template[] = [
  // "Unpublished Job Notification - ixigo.com - Senior Product Manager - Flights"
  { id: 'tpl/unpublished', re: /^unpublished job notification\s*-\s*([^-]+?)\s*-\s*(.+)$/i, company: 1, role: 2 },

  // "Welcome! Your Application for Senior Product Manager at SWIGGY is Received"
  // "Thank you for your application for Senior Platform Product Manager at Guidewire Software"
  { id: 'tpl/for-role-at-co', re: /application\s+for\s+(.+?)\s+at\s+(.+)$/i, role: 1, company: 2 },

  // "Your application for Product Owner with Rolls-Royce"
  { id: 'tpl/for-role-with-co', re: /application\s+for\s+(.+?)\s+with\s+(.+)$/i, role: 1, company: 2 },

  // "Your candidature with Meesho - Product Manager II - Experience"
  { id: 'tpl/candidature-with-co-role', re: /candidature\s+with\s+([^-]+?)\s*-\s*(.+)$/i, company: 1, role: 2 },

  // "Your application at Revolut - Product Strategy Manager"
  { id: 'tpl/app-at-co-role', re: /application\s+at\s+([^-]+?)\s*-\s*(.+)$/i, company: 1, role: 2 },

  // "Application to Product Strategy Manager position confirmed"
  { id: 'tpl/app-to-role', re: /^application\s+to\s+(.+?)\s+position\b/i, role: 1 },

  // "Thank you for applying for Product Manager II - AI at Meesho!"
  { id: 'tpl/applying-for-role-at-co', re: /appl(?:y|ying)\s+for\s+(?:the\s+)?(.+?)\s+at\s+(.+)$/i, role: 1, company: 2 },

  // "Thanks for applying to ThoughtFull World" / "Thank you for applying to Meta"
  { id: 'tpl/applying-to-co', re: /appl(?:y|ying)\s+to\s+(?:join\s+the\s+team\s+here\s+at\s+)?(.+)$/i, company: 1 },

  // "Thank you for your application to ASAPP"
  { id: 'tpl/app-to-co', re: /application\s+to\s+(.+)$/i, company: 1 },

  // "Thank you for your interest in Paytm" / "Thanks for your interest in Meesho ,Kartikeya"
  { id: 'tpl/interest-in-co', re: /interest\s+in\s+(?:joining\s+(?:us\s+at\s+)?)?([^,]+?)\s*(?:,.*)?$/i, company: 1 },

  // "Your journey with Hupo starts here!"
  { id: 'tpl/journey-with-co', re: /journey\s+with\s+(.+?)\s+starts/i, company: 1 },

  // "Reminder: Your Upcoming Interview with Weave" / "Interview with Tekion"
  { id: 'tpl/interview-with-co', re: /interview\s+with\s+(.+)$/i, company: 1 },

  // "Job Application Status at Blitz" / "You have been referred for a role at eBay!"
  { id: 'tpl/status-at-co', re: /(?:application\s+status|referred\s+for\s+a?\s*role)\s+at\s+(.+)$/i, company: 1 },

  // "Your application with Niyo was rejected !"
  { id: 'tpl/app-with-co', re: /application\s+with\s+(.+?)(?:\s+was\b|$)/i, company: 1 },

  // "Application for Senior Product Manager received, Thank you!" - role only.
  { id: 'tpl/app-for-role', re: /application\s+for\s+(.+?)\s+received/i, role: 1 },

  // "Update on Your Application forSPM - Polo" - the missing space is verbatim.
  { id: 'tpl/update-for-role', re: /application\s+for\s*(.+)$/i, role: 1 },

  // "Tekion Interview Confirmation" / "Reo.Dev Candidacy Update"
  { id: 'tpl/co-interview', re: /^(.+?)\s+(?:interview\s+confirmation|candidacy\s+update|online\s+interview)/i, company: 1 },

  // "R1 Interview | Kartikeya Thapliyal | SPM - Polo | Primetrace Technologies"
  { id: 'tpl/pipe', re: /\|/, segments: 'pipe' },

  // "Product Manager - ThoughtFull World", "Senior Product Manager - Banking - FairMoney",
  // "Technical Product Manager- 12 Months Contract - Civica"
  { id: 'tpl/dash', re: /-/, segments: 'dash' },
];

interface TemplateResult {
  company?: string;
  role?: string;
  templateId: string;
}

function applySegments(subject: string, mode: 'dash' | 'pipe', id: string): TemplateResult | null {
  const parts = subject
    .split(mode === 'pipe' ? '|' : /\s-\s|(?<=[a-z])-\s/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const last = parts[parts.length - 1];
  const first = parts[0];

  // The trailing segment is the company only when it does NOT read like a role
  // and the leading segment does. That is what keeps "Banking" from becoming
  // the company in "Senior Product Manager - Banking - FairMoney".
  if (!looksLikeRole(last) && looksLikeRole(first) && !COURTESY_PREFIX.test(first)) {
    return { company: last, role: parts.slice(0, -1).join(' - '), templateId: id };
  }
  // Pipe form puts the role second-to-last: "... | SPM - Polo | Primetrace".
  if (mode === 'pipe' && parts.length >= 2 && !looksLikeRole(last)) {
    const role = parts[parts.length - 2];
    return { company: last, role: looksLikeRole(role) ? role : undefined, templateId: id };
  }
  return null;
}

export function matchTemplates(subject: string): TemplateResult | null {
  const s = (subject || '').trim();
  if (!s) return null;
  for (const t of TEMPLATES) {
    if (t.segments) {
      if (!t.re.test(s)) continue;
      const r = applySegments(s, t.segments, t.id);
      if (r) return r;
      continue;
    }
    const m = t.re.exec(s);
    if (!m) continue;
    const company = t.company ? m[t.company] : undefined;
    const role = t.role ? m[t.role] : undefined;
    if (!company && !role) continue;
    return { company, role, templateId: t.id };
  }
  return null;
}

// ---- Company from the sender address ---------------------------------------

function companyFromSender(
  email: string,
  vendor: AtsVendor
): { value: string; source: ProvenanceSource } | null {
  switch (vendor.companyFrom.kind) {
    case 'localpart': {
      // mastercard@myworkday.com -> Mastercard
      const lp = senderLocalpart(email);
      if (!lp || GENERIC_LOCALPARTS.has(lp) || lp.length < 2) return null;
      return { value: lp, source: 'sender-localpart' };
    }
    case 'subdomain': {
      // hiring-lead@hupocareers.teamtailor-mail.com -> Hupo(careers)
      const host = senderDomain(email);
      const suffix = vendor.domains.find((d) => host.endsWith(d));
      if (!suffix) return null;
      const prefix = host.slice(0, Math.max(0, host.length - suffix.length)).replace(/\.$/, '');
      if (!prefix) return null;
      // "lyzrai-demo.na" -> "lyzrai"; "hupocareers" -> "hupo"
      const first = prefix.split('.')[0].split('-')[0];
      if (!first || first.length < 2) return null;
      return { value: first.replace(/careers?$/i, '') || first, source: 'sender-subdomain' };
    }
    case 'domain': {
      // application-no-reply@revolut.com -> Revolut
      const host = senderDomain(email);
      const label = host.split('.')[0];
      if (!label || label.length < 2) return null;
      // recruiting.facebook.com -> facebook (the alias map turns it into Meta)
      const parts = host.split('.');
      const candidate = parts.length > 2 ? parts[parts.length - 2] : label;
      return { value: candidate, source: 'sender-domain' };
    }
    case 'body':
    default:
      return null;
  }
}

// ---- Entry point -----------------------------------------------------------

export function extractFromThread(
  thread: EmailThread,
  vendor: AtsVendor | undefined,
  hint?: AgentHint
): Extracted {
  const inbound = thread.messages.filter((m) => !m.fromMe);
  const first = inbound[0] ?? thread.messages[0];

  let company: Field<string> | null = null;
  let role: Field<string> | null = null;
  let templateId: string | undefined;

  // 1. The agent wins - it read the bodies, we did not.
  if (hint?.company) company = { value: canonicalCompany(hint.company), source: 'agent', confidence: 1 };
  if (hint?.role) role = { value: cleanRole(hint.role), source: 'agent', confidence: 1 };

  // 2. Sender address, where the vendor puts the company there at all.
  if (!company && vendor && first) {
    const fromSender = companyFromSender(first.from.email, vendor);
    if (fromSender) {
      company = { value: canonicalCompany(fromSender.value), source: fromSender.source, confidence: 0.9 };
    }
  }

  // 3. Subject templates, across every message - a later subject in the thread
  //    often names what the first one omitted.
  if (!company || !role) {
    for (const m of thread.messages) {
      if (m.fromMe) continue;
      const t = matchTemplates(m.subject);
      if (!t) continue;
      templateId ??= t.templateId;
      if (!company && t.company) {
        const c = cleanCompany(t.company);
        if (c && !looksLikeRole(c) && c.length > 1) {
          company = { value: canonicalCompany(c), source: 'subject-template', confidence: 0.7 };
        }
      }
      if (!role && t.role) {
        const r = cleanRole(t.role);
        if (r && r.length > 2) {
          role = { value: r, source: 'subject-template', confidence: 0.7 };
        }
      }
      if (company && role) break;
    }
  }

  // 4. A human writing from their employer's own domain IS the company.
  if (!company && first && !vendor) {
    const host = senderDomain(first.from.email);
    const label = host.split('.').slice(-2)[0];
    if (label && label.length > 1) {
      company = { value: canonicalCompany(label), source: 'sender-domain', confidence: 0.6 };
    }
  }

  // Requisition ids, from every subject plus any body the agent kept.
  const haystack = thread.messages
    .map((m) => `${m.subject}\n${m.snippet ?? ''}\n${m.bodyText ?? ''}`)
    .join('\n');
  const reqIds = hint?.reqId
    ? [{ id: hint.reqId.toUpperCase().replace(/[^A-Z0-9]/g, ''), trust: 'high' as const }]
    : extractReqIds(haystack);

  return { company, role, reqIds, templateId };
}

export function parsedRoleOf(role: Field<string> | null): ParsedRole | null {
  return role ? parseRole(role.value) : null;
}

export { companyKey, cleanCompany, cleanRole };

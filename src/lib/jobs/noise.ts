// Noise filtering, in three tiers.
//
// This is the part that earns the dashboard its keep. A naive
// `subject:application` search over this mailbox returns ~201 threads of which
// roughly 70% are garbage: fake walk-in-drive blasts, course marketing, IPO
// allotment notices, a GST registration, credit-card offers. Every rule below
// exists because a real message got through without it.

import { hostMatches, senderDomain } from './normalize';

export type NoiseKind =
  | 'spam_consultant'
  | 'marketing'
  | 'job_alert'
  | 'unrelated'
  | 'transactional_noise';

export interface DenyRule {
  id: string;
  domains?: string[];
  emails?: string[];
  subject?: RegExp;
  kind: NoiseKind;
  /** Shown in the "excluded" drawer so a wrong exclusion is discoverable. */
  note: string;
}

// ---- Tier 1: hard sender denylist ------------------------------------------
// Nothing from these senders can ever become an application.

export const DENY_SENDERS: DenyRule[] = [
  {
    id: 'deny/freshersindia',
    domains: ['freshersindia.in'],
    kind: 'spam_consultant',
    note: 'Bulk walk-in-drive spam. "FLIPKART/TCS/IBM - Your Application has been processed" is boilerplate for applications that were never made.',
  },
  {
    id: 'deny/shine',
    domains: ['jobs.shine.com', 'shine.com'],
    kind: 'spam_consultant',
    note: '"You are Shortlisted" mails from unnamed consultancies are profile-completion funnels.',
  },
  {
    id: 'deny/jobboards',
    domains: ['hirist.tech', 'talent500.co', 'ambitionbox.com', 'naukri.com', 'monsterindia.com', 'indeed.com', 'ziprecruiter.com'],
    kind: 'job_alert',
    note: 'Job-board recommendation mail, not application status.',
  },
  {
    id: 'deny/social',
    domains: ['linkedin.com', 'glassdoor.com'],
    kind: 'job_alert',
    note: 'Feed and community notifications. Glassdoor forwards post titles like "I have applied to 300-400+ jobs" which match every keyword.',
  },
  {
    id: 'deny/edu-marketing',
    domains: ['codingninjas.com', 'careercamp.codingninjas.com', 'courses.codingninjas.com', 'insead.edu', 'info.insead.edu', 'emeritus.org', 'greatlearning.in', 'upgrad.com', 'simplilearn.com', 'scaler.com'],
    kind: 'marketing',
    note: 'Course and MBA marketing. "Confirm your application to build a job-ready portfolio" is an ad.',
  },
  {
    id: 'deny/fintech',
    domains: ['bankbazaar.com', 'rbiretaildirect.org.in', 'kytemoney.com', 'altinvest.ai', 'labh.io', 'idfcfirst.bank.in', 'indusind.com'],
    kind: 'unrelated',
    note: 'Personal-finance mail. BankBazaar\'s "your card assessment is complete" matches "assessment".',
  },
  {
    id: 'deny/ipo-registrars',
    domains: ['mpms.mufg.com', 'in.mpms.mufg.com', 'bigshareonline.com', 'linkintime.co.in', 'kfintech.com', 'cameoindia.com'],
    kind: 'unrelated',
    note: 'IPO registrars. "the application made by you in the initial public offering" matches "application".',
  },
  {
    id: 'deny/govt',
    domains: ['gst.gov.in', 'incometax.gov.in', 'nic.in', 'uidai.gov.in'],
    kind: 'unrelated',
    note: 'Government portals. A GST REG-07 registration is an "Application for Registration".',
  },
  {
    id: 'deny/saas-marketing',
    domains: ['openrouter.ai', 'allaboutcircuits.com', 'yourstory.com', 'y-axis.com', 'info.y-axis.com', 'prebrief.co', 'mail.prebrief.co'],
    kind: 'marketing',
    note: 'Product and newsletter marketing. OpenRouter\'s "get the call into your app" matches /application/.',
  },
];

// ---- Tier 2: topic gates ---------------------------------------------------
// Fire regardless of sender, and evaluated BEFORE the vendor lookup. Being on
// the ATS allowlist does not immunise an OTP: Oracle sends both JPMorgan's
// application mail and "Take action to confirm your identity" from the very
// same address.

export const TOPIC_GATES: DenyRule[] = [
  {
    id: 'gate/otp',
    subject: /one[-\s]?time[-\s]?pass(?:code|word)|\bOTP\b|verification code|confirm your identity|verify your (?:email|identity)|passcode/i,
    kind: 'transactional_noise',
    note: 'A login code, not application status.',
  },
  {
    id: 'gate/ipo',
    subject: /initial public offering|\bIPO\b|allotment|\bASBA\b|basis of allotment|unblocking intimation/i,
    kind: 'unrelated',
    note: 'Share allotment.',
  },
  {
    id: 'gate/gst',
    subject: /GST\s?REG-|tax collector at source|\bGSTIN\b|income tax return/i,
    kind: 'unrelated',
    note: 'Tax or GST filing.',
  },
  {
    id: 'gate/walkin',
    subject: /walk[-\s]?in\s+drive|mega\s+(?:walk|drive)|profile\s+matched|pofile\s+matched|application has been processed|application will be processed/i,
    kind: 'spam_consultant',
    note: 'Mass walk-in-drive blast. The typo "Pofile Matched" is verbatim from the real sender.',
  },
  {
    id: 'gate/profile-funnel',
    subject: /(?:verify|complete|update|confirm)\s+(?:your\s+)?profile\s+details?|action needed to complete profile|profile details required/i,
    kind: 'spam_consultant',
    note: 'Lead-generation funnel dressed as a shortlisting.',
  },
  {
    id: 'gate/card',
    subject: /credit card|card\*? assessment|rate alert|personal loan|fuel spends/i,
    kind: 'unrelated',
    note: 'Financial product marketing.',
  },
];

// ---- Tier 3: ambiguous senders ---------------------------------------------
// The same address carries both classes. Default to noise, and promote only on
// an explicit status pattern - and even then only to `status_signal`, which
// contributes events but can never create an application on its own.

export interface AmbiguousSender {
  id: string;
  domains: string[];
  defaultKind: NoiseKind;
  statusPatterns: { re: RegExp; note: string }[];
}

export const AMBIGUOUS_SENDERS: AmbiguousSender[] = [
  {
    id: 'ambiguous/iimjobs',
    domains: ['iimjobs.com', 'hirist.com'],
    defaultKind: 'job_alert',
    statusPatterns: [
      {
        re: /^Unpublished Job Notification/i,
        note: 'iimjobs relays a genuine "the recruiter withdrew this posting" status, on the same address it sends job ads from.',
      },
      { re: /regarding your application for the posting/i, note: 'Application status relay.' },
    ],
  },
];

// ---- Evaluation ------------------------------------------------------------

export interface NoiseHit {
  rule: DenyRule;
  kind: NoiseKind;
}

function matchesSender(rule: DenyRule, email: string): boolean {
  const host = senderDomain(email);
  if (rule.emails?.some((e) => e.toLowerCase() === email.toLowerCase())) return true;
  return !!rule.domains?.some((d) => hostMatches(host, d));
}

export function findDeniedSender(email: string): NoiseHit | undefined {
  for (const rule of DENY_SENDERS) {
    if (matchesSender(rule, email)) return { rule, kind: rule.kind };
  }
  return undefined;
}

/** Any subject in the thread tripping a topic gate condemns the whole thread. */
export function findTopicGate(subjects: string[]): NoiseHit | undefined {
  for (const rule of TOPIC_GATES) {
    if (rule.subject && subjects.some((s) => rule.subject!.test(s))) {
      return { rule, kind: rule.kind };
    }
  }
  return undefined;
}

export function findAmbiguousSender(email: string): AmbiguousSender | undefined {
  const host = senderDomain(email);
  return AMBIGUOUS_SENDERS.find((a) => a.domains.some((d) => hostMatches(host, d)));
}

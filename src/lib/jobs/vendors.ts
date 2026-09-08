// ATS vendor registry.
//
// The allowlist answers one question only: "is this sender CAPABLE of carrying
// application mail?" It deliberately does NOT say "this thread is an
// application" - intent is decided per message in intent.ts. That split is what
// lets `notification@smartrecruiters.com` (a Swiggy application) and
// `notifications@smartrecruiters.com` (an OTP) coexist without special cases.
//
// Matching is always on the sender DOMAIN, never the localpart. Revolut mails
// from both `application-no-reply@` and `recruitment-no-reply@`, and both must
// resolve to one company or its three threads never merge.

import { hostMatches, senderDomain } from './normalize';

export type AtsVendorId =
  | 'workday'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workable'
  | 'teamtailor'
  | 'keka'
  | 'smartrecruiters'
  | 'oracle_hcm'
  | 'icims'
  | 'successfactors'
  | 'taleo'
  | 'jobvite'
  | 'recruitee'
  | 'zoho_recruit'
  | 'darwinbox'
  | 'phenom'
  | 'eightfold'
  | 'freshteam'
  | 'employer_direct';

/** Where, if anywhere, the company name sits in the sender address. */
export type CompanySource =
  | { kind: 'localpart' } // mastercard@myworkday.com
  | { kind: 'subdomain' } // erin@hupocareers.teamtailor-mail.com
  | { kind: 'domain' } // application-no-reply@revolut.com
  | { kind: 'body' }; // keka / lever / ashby - not in the address at all

export interface AtsVendor {
  id: AtsVendorId;
  label: string;
  /** Host-suffix matched. Longest match wins. */
  domains: string[];
  companyFrom: CompanySource;
  /** One address serves many employers - company can never come from it. */
  multiTenant: boolean;
  /** This vendor's "we received your application" mail is reliable. */
  trustedAck: boolean;
}

export const ATS_VENDORS: AtsVendor[] = [
  {
    id: 'workday',
    label: 'Workday',
    domains: ['myworkday.com', 'myworkdayjobs.com', 'workday.com'],
    companyFrom: { kind: 'localpart' },
    multiTenant: false,
    trustedAck: true,
  },
  {
    id: 'lever',
    label: 'Lever',
    domains: ['hire.lever.co', 'lever.co'],
    companyFrom: { kind: 'body' },
    multiTenant: true,
    trustedAck: true,
  },
  {
    id: 'ashby',
    label: 'Ashby',
    domains: ['ashbyhq.com'],
    companyFrom: { kind: 'body' },
    multiTenant: true,
    trustedAck: true,
  },
  {
    id: 'workable',
    label: 'Workable',
    // inbound.workablemail.com is a separate host with a hashed localpart; a
    // naive `candidates.workablemail.com` allowlist misses the Sleek and Kora
    // threads entirely.
    domains: ['candidates.workablemail.com', 'inbound.workablemail.com', 'workablemail.com'],
    companyFrom: { kind: 'body' },
    multiTenant: true,
    trustedAck: true,
  },
  {
    id: 'teamtailor',
    label: 'Teamtailor',
    domains: ['teamtailor-mail.com'],
    companyFrom: { kind: 'subdomain' },
    multiTenant: false,
    trustedAck: true,
  },
  {
    id: 'keka',
    label: 'Keka',
    domains: ['kekamail.com', 'keka.com'],
    companyFrom: { kind: 'body' },
    multiTenant: true,
    trustedAck: true,
  },
  {
    id: 'smartrecruiters',
    label: 'SmartRecruiters',
    domains: ['smartrecruiters.com'],
    companyFrom: { kind: 'body' },
    multiTenant: true,
    trustedAck: true,
  },
  {
    id: 'oracle_hcm',
    label: 'Oracle Recruiting',
    domains: ['cloud.oracle.com', 'oraclecloud.com'],
    companyFrom: { kind: 'body' },
    multiTenant: true,
    trustedAck: true,
  },
  {
    id: 'greenhouse',
    label: 'Greenhouse',
    domains: ['greenhouse.io', 'greenhouse-mail.io'],
    companyFrom: { kind: 'subdomain' },
    multiTenant: false,
    trustedAck: true,
  },
  { id: 'icims', label: 'iCIMS', domains: ['icims.com'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  { id: 'successfactors', label: 'SuccessFactors', domains: ['successfactors.com', 'successfactors.eu'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  { id: 'taleo', label: 'Taleo', domains: ['taleo.net'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  { id: 'jobvite', label: 'Jobvite', domains: ['jobvite.com'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  { id: 'recruitee', label: 'Recruitee', domains: ['recruitee.com'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  { id: 'zoho_recruit', label: 'Zoho Recruit', domains: ['zohorecruit.com'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  { id: 'darwinbox', label: 'Darwinbox', domains: ['darwinbox.com', 'darwinbox.io'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  { id: 'phenom', label: 'Phenom', domains: ['phenompeople.com'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  { id: 'eightfold', label: 'Eightfold', domains: ['eightfold.ai'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  { id: 'freshteam', label: 'Freshteam', domains: ['freshteam.com'], companyFrom: { kind: 'body' }, multiTenant: true, trustedAck: true },
  {
    id: 'employer_direct',
    label: 'Employer',
    // Employers running their own recruiting mail. Same code path, company from
    // the domain - which is exactly why Revolut's two localparts unify.
    domains: ['recruiting.facebook.com', 'revolut.com', 'toptal.com'],
    companyFrom: { kind: 'domain' },
    multiTenant: false,
    trustedAck: true,
  },
];

/** Longest suffix wins, so hire.lever.co beats lever.co. */
export function matchVendor(email: string): AtsVendor | undefined {
  const host = senderDomain(email);
  if (!host) return undefined;
  let best: { vendor: AtsVendor; len: number } | undefined;
  for (const vendor of ATS_VENDORS) {
    for (const suffix of vendor.domains) {
      if (hostMatches(host, suffix) && (!best || suffix.length > best.len)) {
        best = { vendor, len: suffix.length };
      }
    }
  }
  return best?.vendor;
}

export function vendorById(id: string): AtsVendor | undefined {
  return ATS_VENDORS.find((v) => v.id === id);
}

/** Localparts that are a mail robot, never a person and never a company. */
export const GENERIC_LOCALPARTS = new Set([
  'no-reply', 'noreply', 'no_reply', 'donotreply', 'do-not-reply', 'do_not_reply',
  'notification', 'notifications', 'notify', 'alerts', 'alert', 'mailer', 'mail',
  'info', 'support', 'hello', 'hi', 'team', 'careers', 'career', 'recruiting',
  'recruitment', 'talent', 'hr', 'jobs', 'job', 'welcome', 'admin', 'contact',
  'apply', 'application', 'applications', 'candidates', 'candidate', 'schedule',
  'scheduling', 'interviews', 'noreply-jobs', 'automated', 'system', 'service',
]);

/** Bots that cc themselves onto real interview loops - a strong human signal. */
export const SCHEDULER_DOMAINS = [
  'greenhouse.io',
  'greenhouse-mail.io',
  'ashbyhq.com',
  'calendly.com',
  'goodtime.io',
  'modernloop.io',
  'hire.lever.co',
  'cronofy.com',
  'x.ai',
];

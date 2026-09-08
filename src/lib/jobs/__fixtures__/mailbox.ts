// Real threads from the mailbox this dashboard was built against.
//
// Subjects are VERBATIM (including the "Pofile Matched" typo and the missing
// space in "ApplicationforSPM"), because every one of them either broke a rule
// or proved one.
//
// Addresses are verbatim ONLY where they are public transactional robots
// (no-reply@ashbyhq.com, mastercard@myworkday.com). Real people's work
// addresses and names are replaced with placeholders that preserve the exact
// shape the tests depend on - this repo is public, and a recruiter did not
// consent to appearing in it. In particular `krecruiter@tekion.com` stays a
// single token: "a real recruiter whose localpart matches no name pattern" is
// the case it exists to prove. His own address is me@example.com.
//
// If a classifier change breaks a test here, the mailbox is the spec, not the
// test - go and look at the real thread before editing an expectation.

import type { EmailMessage, EmailThread } from '../types';

export const ME = 'me@example.com';

/** 2026-09-08T12:00:00Z - the day the audit was taken. */
export const NOW = Date.parse('2026-09-08T12:00:00Z');

let seq = 0;

export function msg(o: {
  from: string;
  subject: string;
  at: string;
  snippet?: string;
  bodyText?: string;
  fromMe?: boolean;
  cc?: string[];
  to?: string[];
  id?: string;
  hasUnsubscribe?: boolean;
  labels?: string[];
}): EmailMessage {
  return {
    id: o.id ?? `m${++seq}`,
    at: o.at,
    from: { email: o.from },
    to: (o.to ?? [ME]).map((email) => ({ email })),
    cc: o.cc?.map((email) => ({ email })),
    fromMe: o.fromMe ?? false,
    subject: o.subject,
    snippet: o.snippet ?? '',
    bodyText: o.bodyText,
    hasUnsubscribe: o.hasUnsubscribe,
    labels: o.labels,
  };
}

export function thread(id: string, messages: EmailMessage[]): EmailThread {
  return { id, subject: messages[0]?.subject ?? '', messages };
}

// ---- True positives: real applications -------------------------------------

export const T = {
  // Workday, company in the localpart. Role is body-only - the agent must hint it.
  mastercard: thread('t-mastercard', [
    msg({
      from: 'mastercard@myworkday.com',
      subject: 'Thank you for your application!',
      at: '2026-09-03T13:01:24Z',
      snippet:
        'Thank you for applying! Dear Kartikeya, Thank you for your interest in joining Mastercard! We have received your application for the role: Manager, Product Management.',
    }),
  ]),

  guidewire: thread('t-guidewire', [
    msg({
      from: 'guidewire@myworkday.com',
      subject: 'Thank you for your application for Senior Platform Product Manager at Guidewire Software',
      at: '2026-08-11T17:23:16Z',
    }),
  ]),

  meta: thread('t-meta', [
    msg({
      from: 'do-not-reply@recruiting.facebook.com',
      subject: 'Thank you for applying to Meta',
      at: '2026-09-03T12:43:13Z',
    }),
  ]),

  // Ashby never names the employer in its transactional subjects.
  ashbyAck: thread('t-ashby-ack', [
    msg({
      from: 'no-reply@ashbyhq.com',
      subject: 'We’ve Received Your Application',
      at: '2026-09-03T12:35:48Z',
      snippet: 'Hi Kartikeya, We’re glad to have received your interest and application, thank you.',
    }),
  ]),

  // "Candidacy Update" is the ONLY rejection cue here.
  reoDev: thread('t-reodev', [
    msg({
      from: 'no-reply@ashbyhq.com',
      subject: 'Reo.Dev Candidacy Update',
      at: '2026-08-19T17:15:03Z',
      snippet:
        'Thank you for taking the time to speak with us regarding the Growth Product Manager role here at Reo.Dev. After careful consideration we’ve determined that there isn’t an ideal fit.',
    }),
  ]),

  thoughtfull: thread('t-thoughtfull', [
    msg({
      from: 'noreply@candidates.workablemail.com',
      subject: 'Product Manager - ThoughtFull™ World',
      at: '2026-09-03T12:16:04Z',
      snippet:
        'Hi Kartikeya, Thank you for applying for the Product Manager role and for your interest in joining us at ThoughtFull World.',
    }),
  ]),

  hupo: thread('t-hupo', [
    msg({
      from: 'hiring-lead@hupocareers.teamtailor-mail.com',
      subject: 'Your journey with Hupo starts here!',
      at: '2026-09-03T12:04:33Z',
    }),
  ]),

  lyzr: thread('t-lyzr', [
    msg({
      from: 'jrecruiter@lyzrai-demo.na.teamtailor-mail.com',
      subject: 'Thanks For Sharing Your Interest With Us!',
      at: '2026-07-13T04:37:53Z',
      snippet: 'Thanks for applying to Product Manager at Lyzr AI, we’re glad you did.',
    }),
  ]),

  niyo: thread('t-niyo', [
    msg({
      from: 'no-reply@kekamail.com',
      subject: 'Your application with Niyo was rejected !',
      at: '2026-09-03T06:22:32Z',
    }),
  ]),

  // Keka is multi-tenant with a generic subject: GoKwik and Blitz produce
  // byte-identical mail. Only the agent can separate them.
  gokwik: thread('t-gokwik', [
    msg({
      from: 'no-reply@kekamail.com',
      subject: 'Application for Senior Product Manager received, Thank you!',
      at: '2026-08-11T17:18:58Z',
      snippet: 'Thank you for applying to GoKwik Commerce Solutions Pvt. Ltd. for the role of Senior Product Manager.',
    }),
  ]),
  blitzAck: thread('t-blitz-ack', [
    msg({
      from: 'no-reply@kekamail.com',
      subject: 'Application for Senior Product Manager received, Thank you!',
      at: '2026-06-27T15:37:50Z',
      snippet: 'Thank you for applying to Blitz for the role of Senior Product Manager.',
    }),
  ]),
  blitzStatus: thread('t-blitz-status', [
    msg({
      from: 'no-reply@kekamail.com',
      subject: 'Job Application Status at Blitz',
      at: '2026-08-17T17:00:21Z',
    }),
  ]),

  // Paytm sent the identical rejection three times, minutes apart.
  paytm: thread('t-paytm', [
    msg({
      id: 'p1',
      from: 'no-reply@hire.lever.co',
      subject: 'Thank you for your interest in Paytm',
      at: '2026-07-30T18:19:06Z',
      bodyText:
        'Thank you for your interest in the position of Product Management - Paytm Money at Paytm! After carefully reviewing your resume, we regret to inform you that we will not be proceeding.',
    }),
    msg({
      id: 'p2',
      from: 'no-reply@hire.lever.co',
      subject: 'Thank you for your interest in Paytm',
      at: '2026-07-30T18:19:09Z',
    }),
    msg({
      id: 'p3',
      from: 'no-reply@hire.lever.co',
      subject: 'Thank you for your interest in Paytm',
      at: '2026-07-30T18:25:55Z',
    }),
  ]),

  // Two genuinely different Meesho roles. Must NOT merge.
  meeshoAi: thread('t-meesho-ai', [
    msg({
      from: 'no-reply@hire.lever.co',
      subject: 'Thank you for applying for Product Manager II - AI at Meesho!',
      at: '2026-07-19T20:01:03Z',
    }),
  ]),
  meeshoExperience: thread('t-meesho-exp', [
    msg({
      from: 'no-reply@hire.lever.co',
      subject: 'Your candidature with Meesho - Product Manager II - Experience',
      at: '2026-07-10T10:18:42Z',
      snippet:
        'Dear Kartikeya, Thank you for your interest in working with us at Meesho and for submitting your application for the Product Manager II - Experience position.',
    }),
  ]),
  // Same company, no role at all - must not silently attach to either.
  meeshoNoRole: thread('t-meesho-norole', [
    msg({
      from: 'no-reply@hire.lever.co',
      subject: 'Thanks for your interest in Meesho ,Kartikeya',
      at: '2026-07-21T08:03:08Z',
    }),
  ]),

  // Same Gmail thread, ack in May 2025 and rejection in July 2026.
  fairmoney: thread('t-fairmoney', [
    msg({
      from: 'noreply@candidates.workablemail.com',
      subject: 'Senior Product Manager - Banking - FairMoney',
      at: '2025-05-10T18:29:41Z',
      snippet: 'THANK YOU for taking the time to apply for the Senior Product Manager - Banking position at FairMoney.',
    }),
    msg({
      from: 'noreply@candidates.workablemail.com',
      subject: 'Senior Product Manager - Banking - FairMoney',
      at: '2026-07-24T11:34:33Z',
      bodyText:
        'We have taken the time to study your application, but unfortunately, we´ll not be able to give it a favourable response this time.',
    }),
  ]),

  // SmartRecruiters, both classes from one vendor.
  swiggy: thread('t-swiggy', [
    msg({
      from: 'notification@smartrecruiters.com',
      subject: 'Welcome! Your Application for Senior Product Manager at SWIGGY is Received',
      at: '2026-07-22T20:22:57Z',
    }),
  ]),
  swiggyOtp: thread('t-swiggy-otp', [
    msg({
      from: 'notifications@smartrecruiters.com',
      subject: 'Your one-time-passcode',
      at: '2026-07-23T05:11:13Z',
      snippet: 'Your one-time-passcode 924206 Best regards, Hiring Team at SWIGGY',
    }),
  ]),

  // Oracle: application and rejection share no words. Only the req id links them.
  jpmcApplied: thread('t-jpmc-applied', [
    msg({
      from: 'eino.fa.sender@workflow.mail.us2.cloud.oracle.com',
      subject: 'We received your job application (Job Number: 210769925)',
      at: '2026-07-19T19:59:46Z',
      snippet:
        'JPMorgan Chase and Co. Kartikeya, Your application for the position listed below was successfully submitted.',
    }),
  ]),
  jpmcRejected: thread('t-jpmc-rejected', [
    msg({
      from: 'eino.fa.sender@workflow.mail.us2.cloud.oracle.com',
      subject: 'Your job application status (Job number: 210769925)',
      at: '2026-08-19T08:19:32Z',
      bodyText:
        'We appreciate your interest in exploring the Senior Product Associate position at JPMorganChase. At this time, we are sorry to let you know we’re moving forward with other candidates.',
    }),
  ]),
  // Same sender, an OTP. Must not become an application.
  jpmcOtp: thread('t-jpmc-otp', [
    msg({
      from: 'eino.fa.sender@workflow.mail.us2.cloud.oracle.com',
      subject: 'Take action to confirm your identity',
      at: '2026-07-19T19:57:11Z',
    }),
  ]),

  // Revolut: three threads, one application.
  revolutApplied: thread('t-revolut-applied', [
    msg({
      from: 'application-no-reply@revolut.com',
      subject: 'Application to Product Strategy Manager position confirmed',
      at: '2026-08-20T13:50:36Z',
      snippet:
        'Hi Kartikeya Thapliyal, Thank you for your interest in Revolut! We wanted to let you know we received your application for Product Strategy Manager.',
    }),
  ]),
  revolutRejected: thread('t-revolut-rejected', [
    msg({
      from: 'recruitment-no-reply@revolut.com',
      subject: 'Your application at Revolut - Product Strategy Manager',
      at: '2026-08-20T15:04:37Z',
      bodyText:
        'Unfortunately, after careful consideration we will not be moving forward with your application.',
    }),
  ]),
  revolutTalentPool: thread('t-revolut-pool', [
    msg({
      from: 'recruitment-no-reply@revolut.com',
      subject: 'Stay up-to-date on future career opportunities',
      at: '2026-08-21T15:41:08Z',
    }),
  ]),

  // Rolls-Royce: an assessment that was never completed.
  rollsRoyceApplied: thread('t-rr-applied', [
    msg({
      from: 'rollsroyce@myworkday.com',
      subject: 'Your application for Product Owner with Rolls-Royce',
      at: '2026-06-11T13:00:36Z',
      snippet: 'Dear Kartikeya Thank you for applying for the Product Owner opportunity with Rolls-Royce.',
    }),
  ]),
  rollsRoyceAssessment: thread('t-rr-assessment', [
    msg({
      from: 'rollsroyce@myworkday.com',
      subject: 'URGENT – Complete Online Assessments for JR6155469 Product Owner (Evergreen)',
      at: '2026-06-11T14:56:08Z',
      snippet: 'As part of the selection process, you are now required to complete an online assessment.',
    }),
  ]),

  // eBay: a referral he never acted on. Not an application.
  ebayReferral: thread('t-ebay', [
    msg({
      from: 'ebay@myworkday.com',
      subject: 'You have been referred for a role at eBay!',
      at: '2026-06-18T07:12:15Z',
      snippet:
        'A colleague has submitted your information through our Employee Referral program. To be considered as a referral, please apply through the link below.',
    }),
  ]),

  // Primetrace: an interview he did not attend.
  primetraceScheduled: thread('t-primetrace-sched', [
    msg({
      from: 'no-reply@kekamail.com',
      subject: 'R1 Interview | Kartikeya Thapliyal | SPM - Polo | Primetrace Technologies',
      at: '2026-06-15T09:48:35Z',
    }),
    msg({
      from: 'no-reply@kekamail.com',
      subject: 'Reminder: Upcoming interview | Primetrace Technologies | Jun 16, 2026 | 02:00 PM to 02:30 PM',
      at: '2026-06-16T07:31:20Z',
    }),
  ]),
  primetraceMissed: thread('t-primetrace-missed', [
    msg({
      from: 'no-reply@kekamail.com',
      subject: 'Update on Your Application forSPM - Polo',
      at: '2026-06-16T18:04:11Z',
      snippet:
        'As you did not attend the scheduled interview and we have not received any communication or response from your end.',
    }),
  ]),

  // Civica: two Workable threads plus a human recruiter thread he replied to.
  civicaWorkable: thread('t-civica-workable', [
    msg({
      from: 'noreply@candidates.workablemail.com',
      subject: 'Technical Product Manager- 12 Months Contract - Civica',
      at: '2026-07-08T10:58:12Z',
      snippet: 'Hello Kartikeya, Thank you for applying to join the team here at Civica!',
    }),
  ]),
  civicaHuman: thread('t-civica-human', [
    msg({
      from: 'recruiter.one@civica.com',
      subject: 'Technical Product Manager- 12 Months Contract - Civica',
      at: '2026-07-08T12:52:49Z',
      snippet:
        'We are thrilled that you are considering joining Civica’s product team. Could you confirm your availability and notice period?',
    }),
    msg({
      from: ME,
      fromMe: true,
      to: ['recruiter.one@civica.com'],
      subject: 'Re: Technical Product Manager- 12 Months Contract - Civica',
      at: '2026-07-08T14:50:24Z',
    }),
    msg({
      from: 'recruiter.one@civica.com',
      subject: 'Technical Product Manager- 12 Months Contract - Civica',
      at: '2026-09-02T12:04:21Z',
      bodyText:
        'Thank you for your application & interest in working at Civica. We regret to inform that this role is no longer available.',
    }),
  ]),

  // Tekion: a human recruiter with a Greenhouse scheduler cc'd.
  tekion: thread('t-tekion', [
    msg({
      from: 'krecruiter@tekion.com',
      cc: ['schedule@fern.greenhouse.io'],
      subject: 'Tekion Interview Confirmation',
      at: '2026-07-28T05:19:53Z',
      snippet: 'You’re confirmed for your interview with Tekion below! This is a Teams video Interview.',
    }),
  ]),

  // Toptal: an invitation plus two nudges, never answered.
  toptal: thread('t-toptal', [
    msg({
      id: 'tp1',
      from: 'screener.one@toptal.com',
      subject: 'Toptal screening process: Initial interview invitation',
      at: '2026-08-10T12:02:57Z',
    }),
    msg({
      id: 'tp2',
      from: 'screener.one@toptal.com',
      subject: 'Take the Next Step in the Toptal Screening Process',
      at: '2026-08-12T08:53:13Z',
    }),
    msg({
      id: 'tp3',
      from: 'screener.one@toptal.com',
      subject: 'Take the Next Step in the Toptal Screening Process',
      at: '2026-08-13T08:50:52Z',
    }),
  ]),

  // Weave: interviewed, then rejected, then surveyed.
  weaveInterview: thread('t-weave-interview', [
    msg({
      from: 'no-reply@ashbyhq.com',
      subject: 'Reminder: Your Upcoming Interview with Weave',
      at: '2026-06-11T13:04:55Z',
    }),
  ]),
  weaveRejected: thread('t-weave-rejected', [
    msg({
      from: 'no-reply@ashbyhq.com',
      subject: 'Thank you for your interest, Kartikeya!',
      at: '2026-06-15T06:00:59Z',
      snippet:
        'Thank you for taking the time to speak with the hiring manager about the Senior Product Manager, Scheduling Platform position.',
    }),
  ]),

  // Workable acks with no follow-up - the long tail that goes quiet.
  kora: thread('t-kora', [
    msg({
      from: '4ed8ma9sxppo+lj9p@inbound.workablemail.com',
      subject: 'Senior Product Manager (APAC) - Kora',
      at: '2026-07-03T07:09:50Z',
      snippet:
        'Hi Kartikeya, Thank you for your interest in Kora. We have received your application and we are delighted that you are considering joining our team.',
    }),
  ]),
  sleek: thread('t-sleek', [
    msg({
      from: '4ee2xsn39c6j+lj9p@inbound.workablemail.com',
      subject: 'Growth Product Manager (Sleek Business Account and Payroll) - Sleek',
      at: '2026-07-13T13:09:34Z',
      snippet:
        'Dear Kartikeya, Thank you for applying for the Growth Product Manager (Sleek Business Account and Payroll) at Sleek.',
    }),
  ]),
  asapp: thread('t-asapp', [
    msg({
      from: 'no-reply@hire.lever.co',
      subject: 'Thank you for your application to ASAPP',
      at: '2026-07-21T19:44:31Z',
      snippet:
        'Hi Kartikeya, Thank you for your interest in ASAPP! We are reviewing your application for our Senior Technical Product Manager opportunity.',
    }),
  ]),

  // ---- Noise ---------------------------------------------------------------

  freshersindia: thread('n-freshers', [
    msg({
      from: 'bulk.sender@freshersindia.in',
      subject: 'FLIPKART Profile Matched Kartikeya thapliyal.. Your Application has been processed',
      at: '2026-09-06T10:54:07Z',
    }),
  ]),
  freshersindiaIbm: thread('n-freshers-ibm', [
    msg({
      from: 'bulk.sender@freshersindia.in',
      subject: 'IBM Pofile Matched | Your Application has been processed',
      at: '2026-09-05T10:16:04Z',
    }),
  ]),
  shine: thread('n-shine', [
    msg({
      from: 'alerts@jobs.shine.com',
      subject: 'You are Shortlisted – Action Needed to Complete Profile',
      at: '2026-09-03T05:38:34Z',
    }),
  ]),
  codingNinjas: thread('n-coding-ninjas', [
    msg({
      from: 'hello@careercamp.codingninjas.com',
      subject: 'Update: Confirm your application to build a job-ready portfolio',
      at: '2026-08-25T05:30:49Z',
      hasUnsubscribe: true,
    }),
  ]),
  ipo: thread('n-ipo', [
    msg({
      from: 'symbiotecpl.ipo@in.mpms.mufg.com',
      subject: 'Symbiotec Pharmalab Limited – IPO - Allotment Advice cum Unblocking Intimation',
      at: '2026-08-30T00:20:29Z',
      snippet: 'This is with reference to the application made by you in the initial public offering.',
    }),
  ]),
  gst: thread('n-gst', [
    msg({
      from: 'donotreply@gst.gov.in',
      subject: 'Intimation of TRN generated for Application for Registration as Tax Collector at Source in GST REG-07',
      at: '2026-09-08T05:27:33Z',
    }),
  ]),
  bankBazaar: thread('n-bankbazaar', [
    msg({
      from: 'creditcard+ratealert@bankbazaar.com',
      subject: 'INT-ID:RF5435 — your BPCL SBI Card* assessment is complete',
      at: '2026-08-31T13:44:35Z',
    }),
  ]),
  openRouter: thread('n-openrouter', [
    msg({
      from: 'welcome@openrouter.ai',
      subject: 'Get the call into your app, not just the terminal',
      at: '2026-08-23T07:47:47Z',
      snippet: 'Install the OpenRouter SDK and move your terminal test into your application code.',
    }),
  ]),
  glassdoor: thread('n-glassdoor', [
    msg({
      from: 'noreply@glassdoor.com',
      subject: 'Is the job market seriously this bad right now?\n\nI’ve applied to 300–400+ jobs...',
      at: '2026-08-26T10:14:17Z',
    }),
  ]),
  insead: thread('n-insead', [
    msg({
      from: 'mba.info@insead.edu',
      subject: '12 days to go — apply now!',
      at: '2026-09-03T09:46:52Z',
      hasUnsubscribe: true,
    }),
  ]),
  talent500: thread('n-talent500', [
    msg({
      from: 'promo.sender@talent500.co',
      subject: 'Profile Shortlisted: Experienced Professional AI Roadmap Session Today (FREE)',
      at: '2026-08-12T05:51:45Z',
    }),
  ]),

  // iimjobs: the same address carries both a job ad and a real status relay.
  iimjobsAd: thread('n-iimjobs-ad', [
    msg({
      from: 'info@iimjobs.com',
      subject: 'Staff Product Manager - Agency Monetization & Wallet opening at HIGHLEVEL INDIA PRIVATE LIMITED',
      at: '2026-09-05T13:29:58Z',
    }),
  ]),
  ixigoWithdrawn: thread('s-ixigo', [
    msg({
      from: 'info@iimjobs.com',
      subject: 'Unpublished Job Notification - ixigo.com - Senior Product Manager - Flights',
      at: '2026-09-03T05:21:29Z',
      snippet:
        'This is regarding your application for the posting - ixigo.com - Senior Product Manager - Flights. The concerned recruiter has removed the job posting.',
    }),
  ]),
};

export const ALL_TRUE_POSITIVES: EmailThread[] = [
  T.mastercard, T.guidewire, T.meta, T.ashbyAck, T.reoDev, T.thoughtfull, T.hupo,
  T.lyzr, T.niyo, T.gokwik, T.blitzAck, T.blitzStatus, T.paytm, T.meeshoAi,
  T.meeshoExperience, T.fairmoney, T.swiggy, T.jpmcApplied, T.jpmcRejected,
  T.revolutApplied, T.revolutRejected, T.rollsRoyceApplied, T.rollsRoyceAssessment,
  T.primetraceScheduled, T.primetraceMissed, T.civicaWorkable, T.civicaHuman,
  T.tekion, T.toptal, T.weaveInterview, T.weaveRejected, T.kora, T.sleek, T.asapp,
];

export const ALL_NOISE: EmailThread[] = [
  T.freshersindia, T.freshersindiaIbm, T.shine, T.codingNinjas, T.ipo, T.gst,
  T.bankBazaar, T.openRouter, T.glassdoor, T.insead, T.talent500, T.iimjobsAd,
  T.swiggyOtp, T.jpmcOtp,
];

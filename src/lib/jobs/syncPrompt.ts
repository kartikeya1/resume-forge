// Self-contained prompts you can paste into any AI that can read your Gmail.
//
// Why this exists: the dashboard used to say "ask an agent to run the steps in
// JOBS-FORGE.md", which is only actionable on a machine with this repo checked
// out and Claude Code configured. On a borrowed laptop, or in a plain chat
// window, it told you to go and read a file you did not have. These functions
// inline everything an agent needs - the queries, the schema, the hint format
// and the hard rules - so the prompt works on its own.
//
// The duplication with JOBS-FORGE.md is deliberate and known. The runbook is
// the document a person reads; this is the payload a stranger executes.
// syncPrompt.test.ts asserts every ATS domain and every hard rule is still
// present here, so the copy cannot quietly rot into a subset of the runbook.

import type { LabelPlan } from './labelPlan';

export const SNAPSHOT_PATH = '~/Downloads/jobs-forge-snapshot.json';
export const LABEL_PLAN_PATH = '~/Downloads/jobs-forge-label-plan.json';

/** Above this many changes the plan is referenced as a file rather than inlined. */
export const INLINE_PLAN_LIMIT = 40;

const DAY = 86_400_000;

/** Every ATS sender domain query A covers. */
export const ATS_DOMAINS = [
  'myworkday.com', 'greenhouse.io', 'ashbyhq.com', 'lever.co', 'workablemail.com',
  'teamtailor-mail.com', 'kekamail.com', 'smartrecruiters.com', 'icims.com',
  'successfactors.com', 'taleo.net', 'recruiting.facebook.com', 'cloud.oracle.com',
  'darwinbox.com', 'zohorecruit.com', 'jobvite.com', 'eightfold.ai',
  'phenompeople.com', 'recruitee.com', 'freshteam.com',
];

/**
 * How many days back to ask for, from the snapshot's current `until`.
 *
 * Rounded up and clamped to [1, 90]. Asking for a delta rather than a fresh
 * 90-day sweep is the whole point of passing `until` through: a routine
 * refresh should cost one day of mail, not ninety.
 */
export function deltaDays(until: string | null, now: number): number {
  if (!until) return 90;
  const t = Date.parse(until);
  if (!Number.isFinite(t)) return 90;
  return Math.min(90, Math.max(1, Math.ceil((now - t) / DAY)));
}

export interface RefreshPromptInput {
  /** The current snapshot's `window.until`, or null when there is no snapshot yet. */
  until: string | null;
  /** The current snapshot's `window.since`, preserved as the floor. */
  since?: string | null;
  mailbox?: string;
  now: number;
}

function queries(days: number): string {
  return `**Query A - ATS senders (primary).** High precision.

\`\`\`
newer_than:${days}d (${ATS_DOMAINS.map((d) => `from:${d}`).join(' OR ')})
\`\`\`

**Query B - language sweep (secondary).** Catches senders not on the list above.

\`\`\`
newer_than:${days}d (subject:(application OR applying OR applied OR interview OR "next steps" OR offer OR assessment) OR "thank you for applying" OR "we received your application" OR "your application")
\`\`\`

Query B is roughly 70% noise. That is expected - the dashboard filters it. Pass
through anything genuinely job-related anyway, so a new ATS shows up for review
rather than vanishing.

**Query C - human recruiters. Do not skip this one.** The highest-value threads
are people, not robots.

\`\`\`
newer_than:${days}d in:sent (interview OR "notice period" OR availability OR "the role" OR opportunity)
\`\`\`

Fetch each of those **threads** in full, so my own replies are captured.`;
}

const SCHEMA = `\`\`\`json
{
  "kind": "jobs-forge-snapshot",
  "version": 1,
  "generatedAt": "<ISO 8601, now>",
  "mailbox": "<my address>",
  "window": { "since": "<ISO>", "until": "<ISO, now>" },
  "counts": { "scanned": 0, "kept": 0, "skipped": 0 },
  "agent": { "model": "<your model>", "notes": "" },
  "threads": [
    {
      "id": "<Gmail thread id>",
      "subject": "<thread subject>",
      "messages": [
        {
          "id": "<Gmail message id>",
          "at": "<ISO 8601>",
          "from": { "email": "sender@example.com" },
          "to": [{ "email": "me@example.com" }],
          "cc": [],
          "fromMe": false,
          "subject": "<message subject>",
          "snippet": "<first line of the body>",
          "bodyText": "<only when load-bearing>",
          "hasUnsubscribe": false,
          "labels": ["INBOX"]
        }
      ]
    }
  ],
  "hints": []
}
\`\`\``;

const FIELD_NOTES = `- \`snippet\` - **always include it.** Many real acknowledgements carry no intent
  word in the subject at all: Workable sends "Senior Product Manager (APAC) -
  Kora" and puts "we have received your application" in the first line. The
  dashboard searches the snippet.
- \`bodyText\` - only where it is load-bearing: ambiguous polarity, an assessment
  deadline, an interview time. Bodies are large; do not dump them all.
- \`fromMe\` - true for my own sent replies. Getting this wrong hides the most
  important signal on the page.
- \`cc\` - keep it. A \`schedule@*.greenhouse.io\` in cc is how a real interview
  loop is recognised.
- \`hasUnsubscribe\` - true when a \`List-Unsubscribe\` header is present. It is
  what separates a recruiter from a bulk blast.
- \`labels\` - if you can resolve Gmail's label ids to names, do; it makes the
  dashboard's Gmail-sync preview accurate.`;

const HINTS = `About a third of real applications cannot be resolved by rules alone. A hint
is how you supply what only a reader can see. Add one to \`hints\` per thread
that needs it:

\`\`\`json
{
  "threadId": "<Gmail thread id>",
  "company": "Blitz",
  "companyDomain": "blitz.com",
  "role": "Senior Product Manager",
  "reqId": "JR6155469",
  "applicationKey": "blitz:spm",
  "distinctFrom": [],
  "confidence": 0.9,
  "reason": "Body names Blitz; the subject is Keka boilerplate.",
  "eventOverrides": [
    { "messageId": "<id>", "type": "interview_missed", "note": "", "deadlineAt": null, "interviewAt": null }
  ]
}
\`\`\`

Threads sharing an \`applicationKey\` always merge; ids in \`distinctFrom\` never
merge. \`confidence\` must be >= 0.5 for \`kind\` to be authoritative. Keep
\`reason\` short and true - it is rendered verbatim in the dashboard.

**A hint is required in these cases**, all of which are real:

- A multi-tenant ATS whose transactional subject never names the employer -
  Ashby, Lever, Workable, SmartRecruiters, Oracle: supply **company**.
- \`mastercard@myworkday.com\` "Thank you for your application!": the **role** is
  body-only.
- Keka sends a byte-identical "Application for Senior Product Manager received"
  for two different companies: supply **company**, plus an \`applicationKey\` to
  link a company-only thread to a role-only one.
- An assessment mail saying "within 7 days of receipt": supply **\`deadlineAt\`**
  as a real ISO date.
- An interview confirmation carrying a Teams or ICS block: supply
  **\`interviewAt\`**.
- A mail that is textually identical to a routine status update but is actually
  a no-show: supply **\`type: "interview_missed"\`**.
- "Thank you for your interest in X" - could be a rejection or an
  acknowledgement. Read the body and set the event type.

Valid \`eventOverrides[].type\`: \`applied\`, \`ack\`, \`under_review\`,
\`shortlisted\`, \`assessment\`, \`action_required\`, \`interview_invite\`,
\`interview_scheduled\`, \`interview_reminder\`, \`interview_missed\`, \`offer\`,
\`rejection\`, \`role_withdrawn\`, \`talent_pool\`, \`outreach\`, \`referred\`,
\`nudge\`, \`survey\`, \`other\`.

Valid \`kind\`: \`application\`, \`recruiter_outreach\`, \`referral\`,
\`status_signal\`, \`spam_consultant\`, \`marketing\`, \`job_alert\`,
\`transactional_noise\`, \`unrelated\`, \`unknown\`.

Two distinctions that matter:

- **\`rejection\` vs \`role_withdrawn\`** - "we're not moving forward with you" is
  a rejection; "this role is no longer available" is not, and must not be shown
  as one.
- **\`nudge\` vs \`action_required\`** - a nudge is them chasing me, and two
  ignored nudges mean I dropped it. \`action_required\` is a blocking gate.`;

/**
 * Every hard rule from the runbook, in substance. Each one has a real failure
 * behind it, so each says why - an agent that knows the reason will apply the
 * rule to a case the wording did not anticipate.
 */
function hardRules(since: string | null | undefined): string {
  return `1. **Overwrite \`${SNAPSHOT_PATH}\` in place. Never write-then-rename, and
   never \`mv\` over the top.** A rename replaces the filesystem entry and
   silently invalidates the file handle the browser stored, which forces me to
   re-pick the file by hand.
2. **Never invent a company or a role.** Leave the field out and the dashboard
   will flag the item for review. A blank field is honest; a guessed one is a
   lie the dashboard then repeats forever.
3. **Always set \`window.since\` and \`window.until\`** to what you actually
   scanned.${
     since ? ` Keep \`since\` at or before \`${since}\` - that is the floor already established, and moving it forward would silently discard history.` : ''
   } Without an accurate window the dashboard cannot tell "no
   rejection yet" from "nobody looked that far back", and would report silence
   as being ghosted.
4. **Read-only against Gmail.** Refreshing never labels, archives, replies, or
   drafts. Do not label something just because you happened to notice it while
   refreshing - that is a separate job with its own confirmation.
5. **Never guess a rejection.** If a subject is ambiguous, read the body. If the
   body does not clearly say no, do not emit a rejection. Leaving a dead
   application open is recoverable; marking a live one dead means I stop
   chasing it.
6. **Merge, do not replace.** Keep every thread already in the file, and carry
   forward every existing hint that still applies. The window is what makes
   staleness meaningful, and a shrinking file looks like progress while being
   data loss.`;
}

/**
 * The prompt for refreshing the snapshot.
 *
 * With `until: null` this asks for a 90-day backfill, so the same function
 * serves the connect screen before any snapshot exists.
 */
export function buildRefreshPrompt(input: RefreshPromptInput): string {
  const { until, since, mailbox, now } = input;
  const days = deltaDays(until, now);
  const first = until === null;

  return `# Refresh my Jobs Forge snapshot

You have access to my Gmail${mailbox ? ` (${mailbox})` : ''}. ${
    first
      ? 'I have no snapshot yet, so this is a 90-day backfill.'
      : `My snapshot currently covers up to ${until}, so fetch the last ${days} day${days === 1 ? '' : 's'} and merge.`
  } Read this whole message before you start - the rules at the end exist
because each one has already gone wrong once.

Write the result as JSON to \`${SNAPSHOT_PATH}\`, overwriting whatever is there.

## 1. Gather the mail

${queries(days)}

Use your Gmail search with a page size of 50 and follow the pagination until the
window is covered. Then fetch each thread you intend to keep as plain text, plus
any thread whose polarity is unclear.${
    first ? '' : `

Also re-fetch **any thread already in the file whose application is still open** -
a rejection very often arrives on a brand-new thread, and a status change on an
old one.`
  }

Do not fetch full bodies for obvious noise. It wastes your context and the
dashboard filters it anyway.

## 2. Write this exact shape

${SCHEMA}

### Field notes

${FIELD_NOTES}

## 3. Hints - the part only you can do

${HINTS}

## 4. Hard rules

${hardRules(since)}

## 5. When you are done

Tell me what changed: new applications, new rejections, and above all **anything
that now needs me**. Then stop.

If you cannot read this Gmail account, say so plainly and stop. Do not write a
snapshot from guesses - an invented file is worse than a stale one, because I
would trust it.`;
}

/**
 * The prompt for applying a label plan.
 *
 * Two payload shapes: a small plan is embedded inline so it can be pasted
 * anywhere with no file transfer at all, and a large one points at the
 * exported file instead of pushing tens of KB through a chat box.
 */
export function buildLabelApplyPrompt({ plan }: { plan: LabelPlan }): string {
  const inline = plan.changes.length <= INLINE_PLAN_LIMIT;
  const payload = inline
    ? `The plan is below. Use exactly this - do not recompute it.

\`\`\`json
${JSON.stringify(plan, null, 2)}
\`\`\``
    : `The plan is too large to paste, so export it from the dashboard first:
*Gmail sync* -> *Export label plan*, which writes
\`${LABEL_PLAN_PATH}\`. Read that file and use it exactly as written - do not
recompute it.`;

  return `# Apply my Jobs Forge label plan to Gmail

This writes to a mailbox with roughly 181,000 messages in it. Read the whole
message before touching a label.

You do not decide what to label. The dashboard decided, deterministically and
under test, and produced the plan. You execute it. That split is the entire
safety design - do not improve on it by labelling anything the plan does not
mention.

${payload}

## Why this is safe

- **Namespacing.** Every label is under \`JobsForge/\`. Nothing in a plan can
  name one of my real labels.
- **Complete undo.** Deleting the five \`JobsForge/*\` labels removes them from
  every thread and touches nothing else. There is no prior state to rebuild.
- **Noise is never labelled.** Only threads that made it into an application
  appear in a plan.
- **Idempotency.** Re-running is a no-op. An empty plan is the correct result on
  a second run, and is the signal that Gmail is already in sync.

## The five labels

- \`JobsForge/Needs-You\` - blocked on me, or a person is waiting on a reply
- \`JobsForge/Interviewing\` - interview scheduled or done, awaiting an outcome
- \`JobsForge/Active\` - live, submitted, nothing needed right now
- \`JobsForge/Lapsed\` - I stopped responding; recoverable
- \`JobsForge/Closed\` - rejected, withdrawn, role closed, or gone quiet for good

They are **mutually exclusive**: a thread carries exactly one. That is what
makes the Gmail sidebar counts trustworthy.

## Procedure

1. **Check the plan is not stale.** Compare its \`snapshotGeneratedAt\`
   (${plan.snapshotGeneratedAt}) against the snapshot currently at
   \`${SNAPSHOT_PATH}\`. **If the snapshot is newer than the plan, stop and say
   so** - the plan was computed from state that has since changed, and applying
   it would fight the next refresh.
2. **Show me the summary and get a clear yes**: ${plan.changes.length} thread${
    plan.changes.length === 1 ? '' : 's'
  } changing, ${plan.unchanged} already correct, and the per-label counts. Do not
   proceed on silence, or on a vague "sounds good" to some other question.
3. **Ensure the labels exist.** List the labels, create any of the five that are
   missing, and build a name -> id map. **The label-application call takes label
   IDs, not names**, and every label in the plan is a name. If the mapping is
   ambiguous - two labels with similar names - stop and ask.
4. **Apply, thread by thread.** For each entry in \`changes\`: add the ids in
   \`add\` first, then remove the ids in \`remove\`. **Adds before removes**, so a
   thread is never briefly left unlabelled.
5. **Report what actually happened**, including any failures. Do not claim
   success for a thread you did not confirm.

## Hard rules

- **Never remove a label that is not in that thread's \`remove\` list.**
- **Never delete any label except a \`JobsForge/*\` one**, and only if I
  explicitly ask you to undo the whole feature.
- **Never label a thread that does not appear in \`changes\`.** If you think a
  thread is mislabelled, say so - do not act on it. The fix is a classifier rule
  or a hint, not a manual label.
- **Never trash, spam, or archive anything.** Labelling is the entire remit.
- **Do not edit the snapshot while doing this.** Labelling and refreshing are
  separate jobs.`;
}

# Jobs Forge - agent runbook

**You are the agent. This file tells you how to refresh the dashboard at `/jobs`.**

Read it start to finish before touching anything. Everything you need is here; you
should not have to ask the user questions to do a routine refresh.

---

## 1. What this is

The user runs a job search out of a Gmail account with ~180,000 messages. Gmail
cannot tell him where any application stands. `/jobs` answers that in one screen.

The page is a **pure client-side reducer**. It does not talk to Gmail. You do.

```
You (Gmail MCP)  ->  write ~/Downloads/jobs-forge-snapshot.json
                                  |
/jobs  ->  File System Access API re-reads that file on every visit
```

The file never leaves his machine. It is **not** committed - `resume-forge` is a
public repo, and his job-search data must never be published. `.gitignore`
already blocks it.

**Your job:** read Gmail, decide what is real, and write the snapshot.
**The page's job:** classify, correlate, and derive status deterministically.

The split matters. Do not try to write finished conclusions - write evidence plus
your judgments as `hints`, and let the tested pipeline do the rest.

---

## 2. Hard rules

These are not style preferences. Each one has a failure behind it.

1. **Overwrite the file in place. Never write-then-rename.**
   A rename replaces the filesystem entry and silently invalidates the handle the
   browser stored, forcing the user to re-pick the file. Use a plain overwrite
   (`Write` to the same path is fine; `mv` over the top is not).

2. **Never invent a company or a role.** Leave the field out and the page will
   flag the item for review. A blank field is honest; a guessed one is a lie the
   dashboard repeats forever.

3. **Always set `window.since` and `window.until`** to what you *actually*
   scanned. Without it the page cannot tell "no rejection yet" from "the agent
   did not look that far back", and it would report silence as being ghosted.

4. **Read-only against Gmail during a refresh.** Gathering mail and writing the
   snapshot never labels, archives, replies, or drafts. Writing is a separate,
   explicitly-requested job with its own procedure - see section 8 (labels) and
   section 9 (drafts). Do not blend the two: never label something while you
   happen to be refreshing.

5. **Never guess a rejection.** If a subject is ambiguous ("Thank you for your
   interest in X"), read the body. If the body does not clearly say no, do not
   emit a rejection. Leaving a dead application open is recoverable; marking a
   live one dead means he stops chasing it.

6. **Keep `hints[].reason` short and true.** It is rendered verbatim in the UI.

---

## 3. Gather the mail

> **Mirrored in code.** `src/lib/jobs/syncPrompt.ts` inlines these queries so the
> dashboard can hand out a prompt that works on a machine without this repo. If
> you change a query or add an ATS domain here, change it there too -
> `syncPrompt.test.ts` cross-checks this file and will fail if the two drift.

Run **both** queries. The first is the high-precision one; the second is a sweep
that catches senders not yet on the allowlist.

### Query A - ATS senders (primary)

```
newer_than:90d (from:myworkday.com OR from:greenhouse.io OR from:ashbyhq.com OR from:lever.co OR from:workablemail.com OR from:teamtailor-mail.com OR from:kekamail.com OR from:smartrecruiters.com OR from:icims.com OR from:successfactors.com OR from:taleo.net OR from:recruiting.facebook.com OR from:cloud.oracle.com OR from:darwinbox.com OR from:zohorecruit.com OR from:jobvite.com OR from:eightfold.ai OR from:phenompeople.com OR from:recruitee.com OR from:freshteam.com)
```

### Query B - language sweep (secondary)

```
newer_than:90d (subject:(application OR applying OR applied OR interview OR "next steps" OR offer OR assessment) OR "thank you for applying" OR "we received your application" OR "your application")
```

Query B returns roughly 70% noise. That is expected - the page filters it, and
you should still pass through anything genuinely job-related so a new ATS shows
up in the review drawer rather than vanishing.

### Query C - human recruiters (do not skip)

The highest-value threads are people, not robots. Sweep his sent mail for
conversations he replied to:

```
newer_than:90d in:sent (interview OR "notice period" OR availability OR "the role" OR opportunity)
```

Then fetch each of those **threads** in full, so his own replies are captured.

### Fetching

Use `search_threads` with `pageSize: 50` and follow `nextPageToken` until the
window is covered. Then `get_thread` with `messageFormat: PLAIN_TEXT` for every
thread you intend to keep **and** for any thread whose polarity is unclear.

Do not fetch full bodies for obvious noise. It wastes context and you will filter
it anyway.

---

## 4. The snapshot format

> **Mirrored in code**, as above - the schema and the field notes are restated
> in `syncPrompt.ts`.

Write valid JSON to `~/Downloads/jobs-forge-snapshot.json`:

```jsonc
{
  "kind": "jobs-forge-snapshot",     // required, exact
  "version": 1,
  "generatedAt": "2026-09-08T18:30:00Z",
  "mailbox": "kartikeyathapliyal@gmail.com",
  "window": { "since": "2026-06-10T00:00:00Z", "until": "2026-09-08T18:30:00Z" },
  "counts": { "scanned": 214, "kept": 96, "skipped": 118 },
  "agent": { "model": "claude-opus-5", "notes": "90-day backfill" },

  "threads": [
    {
      "id": "19eb72ef80c5564c",              // Gmail thread id - used for deep links
      "subject": "URGENT - Complete Online Assessments for JR6155469 Product Owner (Evergreen)",
      "messages": [
        {
          "id": "19eb72ef80c5564c",          // Gmail message id
          "at": "2026-06-11T14:56:08Z",      // ISO 8601
          "from": { "email": "rollsroyce@myworkday.com" },
          "to": [{ "email": "kartikeyathapliyal@gmail.com" }],
          "cc": [],
          "fromMe": false,                   // true for his own sent replies
          "subject": "URGENT - Complete Online Assessments for JR6155469",
          "snippet": "As part of the selection process, you are now required to complete an online assessment...",
          "bodyText": "...",                 // ONLY when polarity or a date depends on it
          "hasUnsubscribe": false,
          "labels": ["UNREAD", "INBOX"]
        }
      ]
    }
  ],

  "hints": [ /* see section 5 */ ]
}
```

### Field notes

| Field | Why it matters |
|---|---|
| `snippet` | **Always include it.** Many real acks carry no intent word in the subject at all - Workable sends "Senior Product Manager (APAC) - Kora" and puts "we have received your application" in the first line. The pipeline searches the snippet. |
| `bodyText` | Only where it is load-bearing: ambiguous polarity, an assessment deadline, an interview time. Bodies are large; do not dump them all. |
| `fromMe` | Drives `iReplied` and `awaitingMyReply`. Getting this wrong hides the most important signal on the page. |
| `cc` | Keep it. A `schedule@*.greenhouse.io` in cc is how a real interview loop is recognised. |
| `hasUnsubscribe` | Set true when `List-Unsubscribe` is present. It is what separates a recruiter from a bulk blast. |

---

## 5. Hints - the part only you can do

About a third of real applications cannot be resolved by rules alone. This is
where you earn your keep.

```jsonc
{
  "threadId": "1a010aacab7b1495",
  "company": "Blitz",                 // when the sender/subject never names it
  "companyDomain": "blitz.com",
  "role": "Senior Product Manager",   // when the role is body-only
  "reqId": "JR6155469",
  "applicationKey": "blitz:spm",      // threads sharing this ALWAYS merge
  "distinctFrom": ["t-other"],        // these NEVER merge
  "confidence": 0.9,                  // >= 0.5 for `kind` to be authoritative
  "reason": "Body names Blitz; the subject is Keka boilerplate.",
  "eventOverrides": [
    {
      "messageId": "19ed19af1ee37010",
      "type": "interview_missed",
      "note": "He did not attend the scheduled interview.",
      "deadlineAt": "2026-06-18T00:00:00Z",
      "interviewAt": "2026-06-16T08:30:00Z"
    }
  ]
}
```

### When a hint is REQUIRED

These are real cases from this mailbox. Expect more of the same shape.

| Situation | What only you can supply |
|---|---|
| `mastercard@myworkday.com` "Thank you for your application!" | **role** - it is body-only |
| Keka sends byte-identical "Application for Senior Product Manager received" for **both GoKwik and Blitz** | **company**, and an `applicationKey` to link a company-only thread to a role-only one |
| Ashby "We've Received Your Application" | **company** - Ashby's transactional subjects never name the employer |
| Lever / Workable / SmartRecruiters / Oracle | **company** - all multi-tenant, company is body-only |
| An assessment mail ("within 7 days of receipt") | **`deadlineAt`** as a real ISO date |
| An interview confirmation with a Teams/ICS block | **`interviewAt`** |
| "Update on Your Application forSPM - Polo" (he no-showed) | **`type: "interview_missed"`** - textually identical to a routine status mail |
| "Thank you for your interest in Paytm" (a rejection) vs "Thanks For Sharing Your Interest With Us!" (an ack) | **polarity** - read the body and set the event type |

### Valid `eventOverrides[].type`

`applied` · `ack` · `under_review` · `shortlisted` · `assessment` ·
`action_required` · `interview_invite` · `interview_scheduled` ·
`interview_reminder` · `interview_missed` · `offer` · `rejection` ·
`role_withdrawn` · `talent_pool` · `outreach` · `referred` · `nudge` ·
`survey` · `other`

Two distinctions the page cares about and you must respect:

- **`rejection` vs `role_withdrawn`** - "we're not moving forward with you" is a
  rejection; "this role is no longer available" is not, and must not be shown as
  one.
- **`nudge` vs `action_required`** - a nudge is them chasing him; two ignored
  nudges mean he dropped it (`lapsed`). `action_required` is a blocking gate
  (`action_needed`).

### Valid `kind` values

`application` · `recruiter_outreach` · `referral` · `status_signal` ·
`spam_consultant` · `marketing` · `job_alert` · `transactional_noise` ·
`unrelated` · `unknown`

Set `kind` explicitly when the rules will get it wrong - most often for a
first-contact recruiter from a domain with no other history, where an in-house
recruiter and a staffing consultant look identical to the heuristic.

---

## 6. What the page does with it

You do not need to replicate any of this. It is here so you know what NOT to do.

**Statuses** (derived, in ladder order): `offer` → `rejected` → `role_closed` →
`lapsed` (missed interview / blown agent-set deadline / 2+ ignored nudges) →
`action_needed` → `interviewing` → `in_review` → `lead` → `ghosted` (>45 days
silent) → `applied`.

**Flags**: `recruiterReplied`, `awaitingMyReply`, `iReplied`, `deadlineAt`,
`interviewAt`, `staleDays`, `talentPooled`, `needsReview`, `conflicting`.

**Merging**: threads are merged by requisition id, then company + compatible
role. Two different req ids at one company stay two applications. "Product
Manager II - AI" and "Product Manager II - Experience" stay separate.

**Noise**: `freshersindia.in`, `jobs.shine.com`, Coding Ninjas, IPO registrars,
GST, BankBazaar, LinkedIn/Glassdoor feeds and job boards are filtered by rule.
You can pass them through; they land in the "filtered" drawer.

**User corrections (Phase 1) live in the browser, not in the snapshot.** He may
have renamed a company, changed a status by hand, merged or split threads, or
added a manual application - none of that is in the JSON you write. It is
stored separately (`localStorage`, key `jobs-forge:overrides:v1`) and survives
every refresh automatically via `reconcileOverrides`. **You do not need to do
anything about this** - just write the snapshot as described above and his
edits will re-apply on top of it. The one thing worth knowing: if a company you
now name for the first time causes two applications to merge that he had
manually kept separate (or vice versa), his merge/split choice always wins -
that is enforced by the join predicate itself (`J0`/`J1` veto before `J2`/`J3`
force), not by anything you need to check.

---

## 7. Refresh procedure

**Routine refresh** - *Sonnet 5, medium effort*. Mechanical once this file is
followed.

1. Read the existing `~/Downloads/jobs-forge-snapshot.json` if present, and note
   its `window.until`.
2. Run queries A, B and C for `newer_than:` the period since then (use 90d if the
   file is missing or older than 90 days).
3. Fetch the new threads, plus **any thread already in the file whose application
   is still open** - a rejection often arrives on a brand-new thread.
4. Merge with the existing threads. Keep old ones: the window is what makes
   staleness meaningful.
5. Carry forward every existing hint that still applies.
6. Overwrite the file in place.
7. Tell the user what changed - new applications, new rejections, and above all
   **anything that now needs them**.

**Full re-backfill** - *Opus 5, high effort*. Needed when the window changes, the
schema changes, or the classification looks wrong. Same steps with a 90-day (or
longer) window and fresh judgment on every thread.

---

## 8. Gmail write-back (Phase 2)

> **Mirrored in code.** `buildLabelApplyPrompt` in `src/lib/jobs/syncPrompt.ts`
> restates this procedure and its hard rules, for pasting into an AI that cannot
> read this file. Change both together; `syncPrompt.test.ts` cross-checks the
> five label names against this section.

**Read this whole section before touching a label. This is the only part of
Jobs Forge that writes to a mailbox with ~181,000 messages in it.**

You do not decide what to label. The dashboard decides, deterministically and
under test, and exports a plan. You execute the plan. That split is the whole
safety design - do not "improve" on it by labelling things the plan does not
mention.

### What makes this safe

1. **Namespacing.** Every label is under `JobsForge/`. Nothing in a plan can
   name one of his real labels (`axis-office-visit`, `paytm-office-visit`,
   `CC Rewards`, `Amit Thapliyal`, `Notes`). A plan's `remove` list is asserted
   in tests to contain only `JobsForge/` labels.
2. **Complete undo.** Deleting the five `JobsForge/*` labels removes them from
   every thread and touches nothing else. That is the revert - there is no need
   to reconstruct prior state.
3. **Noise is never labelled.** Only threads that made it into an application
   appear in a plan, so a misclassified newsletter is ignored rather than
   tagged.
4. **Idempotency.** Re-running a plan is a no-op. An empty plan is the correct
   output on a second run, and is the signal that Gmail is already in sync.

### The five labels

| Label | Meaning |
|---|---|
| `JobsForge/Needs-You` | Blocked on him, or a person is waiting on a reply |
| `JobsForge/Interviewing` | Interview scheduled or done, awaiting an outcome |
| `JobsForge/Active` | Live, submitted, nothing needed right now |
| `JobsForge/Lapsed` | He stopped responding; recoverable |
| `JobsForge/Closed` | Rejected, withdrawn, role closed, or gone quiet for good |

They are **mutually exclusive** - a thread carries exactly one, which is what
makes the Gmail sidebar counts trustworthy. Five rather than one-per-status
because Gmail's sidebar becomes unusable past a handful, and the dashboard is
already the place for the full eleven-status detail.

### Procedure

1. **He exports the plan.** Dashboard → *Gmail sync* → *Export label plan*,
   which writes `~/Downloads/jobs-forge-label-plan.json`. He has already seen
   the dry-run table on screen before doing this.
2. **Read the plan.** Check `snapshotGeneratedAt` against the snapshot you
   last wrote. **If the plan is older than the current snapshot, stop and say
   so** - it was computed from stale state and would fight the next refresh.
3. **Show him the summary and get a clear yes.** Number of threads changing,
   and the per-label counts. Do not proceed on silence or on a vague
   "sounds good" to some other question.
4. **Ensure the labels exist.** `list_labels`, then `create_label` for any of
   the five that are missing. Build a name → id map: **`label_thread` takes
   label IDs, not names**, and every label in the plan is a name.
5. **Apply, thread by thread.** For each entry in `changes`: `label_thread`
   with the ids for `add`, then `unlabel_thread` with the ids for `remove`.
   Adds before removes, so a thread is never briefly unlabelled.
6. **Report what actually happened**, including any failures. Do not claim
   success for threads you did not confirm.

### Hard rules for this section

- **Never `unlabel_thread` a label that is not in the plan's `remove` list.**
- **Never `delete_label` anything except a `JobsForge/*` label**, and only when
  he explicitly asks you to undo the whole feature.
- **Never label a thread that does not appear in `changes`.** If you think a
  thread is mislabelled, say so - do not act on it. The fix is a classifier
  rule or an agent hint, not a manual label.
- **Never `trash_message`, `trash_thread`, `mark_thread_spam`, or archive
  anything.** Labelling is the entire remit of this phase.
- If the mapping in step 4 comes back ambiguous (two labels with similar
  names), stop and ask.

### Undoing it

> `delete_label` on each of the five `JobsForge/*` labels.

That is the complete revert. It cannot affect any other label, and it is worth
telling him this up front - it is what makes trying the feature cheap.

---

## 9. Follow-up drafts (Phase 2)

The dashboard also exports `~/Downloads/jobs-forge-followup-plan.json` for
applications that have gone quiet where **a real human is on the other end**
(it deliberately never chases a `no-reply@` ATS address).

**The plan's own `instruction` field is a hard rule, and it is this: create
Gmail DRAFTS only. Never send.** An automated follow-up to a real recruiter is
irreversible and carries his reputation, not yours.

1. Read the plan. Each draft has `to`, `threadId`, `subject`, `body`.
2. Use `create_draft`, replying within `threadId` so it threads rather than
   arriving cold.
3. **Stop.** Tell him the drafts are ready. He edits and sends them himself.
4. If a draft has `"to": null`, there is no human address - skip it and say so.

The bodies are generated, so they are a competent starting point rather than
finished prose. Do not talk him out of editing them.

---

## 10. Publishing for phone access (Phase 3)

The desktop path reads a plaintext file from disk. A phone has no File System
Access API and no file, so it reads a **published encrypted snapshot** instead:
`public/jobs-snapshot.enc`, committed to the repo and served with the app.

**You never handle the passphrase.** The browser encrypts, because that is the
only place the passphrase exists. Your entire role is committing a file whose
contents you cannot read.

### Procedure

1. He clicks *Publish for phone* on the dashboard, types his passphrase, and
   gets `~/Downloads/jobs-snapshot.enc`.
2. If he asks you to publish it: move that file to
   `public/jobs-snapshot.enc`, commit, and push. Vercel redeploys and the phone
   picks it up.
3. **Say the snapshot date in your report.** A published snapshot is invisible
   staleness - he cannot tell from his phone that it is three weeks old until
   he unlocks it, so tell him what he just shipped.

### Hard rules

- **Never ask for, accept, store, or log the passphrase.** If he offers it in
  chat, tell him not to and that you do not need it. There is nothing you can
  do with it that he cannot do in the browser.
- **Never try to generate the `.enc` file yourself.** You would need the
  passphrase to do it, which is exactly the thing you must not have.
- **`public/jobs-snapshot.enc` is committed on purpose** - do not add it to
  `.gitignore`. It is ciphertext. The *plaintext*
  `jobs-forge-snapshot.json` is the one that must never be committed, and
  `.gitignore` already blocks that.
- If he wants to stop publishing, `git rm public/jobs-snapshot.enc` and push.
  The phone path simply goes away; nothing else changes.

---

## 11. Scheduled refresh (Phase 3, optional)

A refresh can run on a schedule instead of on request. It is an ordinary
Claude Code scheduled task running section 7's procedure - same runbook, same
Gmail MCP, same output file.

**Scope it to a refresh and nothing else.** A scheduled run must:

- read Gmail and overwrite `~/Downloads/jobs-forge-snapshot.json` in place;
- **never** apply labels (section 8), create drafts (section 9), or publish
  (section 10). Those are the three things that touch something outside the
  snapshot file, and none of them should ever happen while he is not watching.

What a scheduled refresh cannot do, by design: update the *published* snapshot.
That needs the passphrase, which lives only in his browser. So the desktop
dashboard stays current automatically while the phone stays at whatever he last
published - and the unlock screen shows that date, so the staleness is visible
rather than silent.

### No API key is needed for this

The scheduled task uses Claude with the Gmail MCP that is already connected.
A separate inference provider (Groq or anything else) would only be needed for
a standalone script that does *not* run through Claude Code - and such a script
would have to rebuild Gmail OAuth from scratch to replace an MCP that already
works. That is a large amount of new surface for no gain, so this phase
deliberately does not add it.

---

## 12. Extending the rules

When a real sender is misclassified, fix the data table rather than special-casing:

| Change | File |
|---|---|
| New ATS vendor | `src/lib/jobs/vendors.ts` → `ATS_VENDORS` |
| New spam sender | `src/lib/jobs/noise.ts` → `DENY_SENDERS` |
| New off-topic subject class | `src/lib/jobs/noise.ts` → `TOPIC_GATES` |
| New subject shape | `src/lib/jobs/extract.ts` → `TEMPLATES` |
| New status phrasing | `src/lib/jobs/intent.ts` → `PATTERNS` |

**Add a fixture for the real message in `src/lib/jobs/__fixtures__/mailbox.ts`
and a test alongside it.** The fixtures are verbatim real mail; that is what
makes them a spec rather than decoration. Then run:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

---

## 13. Analytics (Phase 4)

The dashboard's *Analytics* panel is entirely derived from what is already in
the snapshot - `src/lib/jobs/funnel.ts`. There is nothing for you to do here on
a routine refresh; this section exists so you understand what it does and does
not measure, in case he asks.

**It only uses three reliably-known facts from real mail:** the event
timeline, the ATS vendor a thread came through, and the role title. Company
size, geography, and "channel" beyond ATS vendor were in the original scope
and were deliberately left out, because nothing in a Gmail thread reliably
states them and this dashboard has never guessed a fact to fill a chart. If he
wants those, see §15 (discovery backlog) - it is not a small addition, since it
needs a real external lookup step you do not currently perform.

If you are asked to improve funnel accuracy, the one rule worth knowing: a
"did he actually apply" check must use `status !== 'lead'`, never
`appliedAt !== null`. A human-recruiter thread that opens directly on an
interview confirmation (no separate "thanks for applying" email) has no
`appliedAt` at all, and gating on it silently erases exactly the
direct/human-recruiter channel this analysis exists to measure - a real bug
that shipped and was caught before merge.

---

## 14. Phase 5 — scrapped

The original plan had a Phase 5: link each application to the specific resume
version sent (`library[].id` in `../src/lib/store.ts`), attribute outcomes to
resume variants, and feed real rejection/interview results back into
ResumeForge's keyword scoring - the point where "Resume Forge" and "Jobs
Forge" would have stopped being two separate tools.

**It will not be built. Do not implement it, and do not resurrect it from an
old plan file without being asked.** If you are asked why: the user decided to
scrap it when reviewing the phase plan on 2026-09-09. No technical reason is
recorded - it was a scope call, not a discovered blocker. Treat "Phase 5" as a
name that no longer refers to anything on this project's roadmap.

If a genuine need for resume-outcome attribution comes up later, it is a new
feature to be scoped fresh, not a resumption of this one - a lot can change in
both codebases before that conversation happens again.

---

## 15. Discovery backlog — not scheduled, not scrapped

Raw material carried forward from the original planning conversation for a
future expansion discussion. None of this is scheduled. Do not build any of it
unless explicitly asked - it is listed here so it is not lost, not so it reads
as a to-do list.

**Pipeline intelligence**
- Auto-detect roles applied to twice by accident (already latent in the
  Meesho/Paytm shape from the Phase 0 backfill)
- Salary/comp extraction from JDs and offer mails, normalized to one currency
- Company-health signals alongside each application (funding, layoffs,
  Glassdoor drift) - this is also where "company size" from the Phase 4 scope
  would actually have to come from: a real external lookup, not a guess from
  mail
- Interviewer research auto-triggered when an interview is scheduled - the
  `career-campaign` agent already does exactly this and could be wired in

**Closing the loop with other repos**
- `whoami` as the source of truth for every application answer
- `opportunity-scout` writes new leads directly into Jobs Forge instead of a
  chat message
- Rejection-reason clustering across the corpus - the honest version of "why
  am I not converting", one level deeper than the Phase 4 breakdowns

**Workflow**
- Calendar integration for interview slots (the Google Calendar MCP is already
  connected)
- One-click follow-up from a stale row, beyond the current export-a-plan
  mechanism from Phase 2
- A weekly digest as a scheduled task, alongside the existing refresh task
- Reference/referral tracker - who referred him where, and when to reciprocate

**Data quality**
- A feedback loop where every manual correction (Phase 1) becomes a test
  fixture, so the classifier provably improves over time rather than by
  accident
- A vendor-coverage report: "N threads from an unrecognized ATS this run - add
  it?", surfaced instead of silently landing in the review drawer every time

---

## 16. First-time setup (user, once)

1. `npm run dev`, open <http://localhost:3000/jobs> (or the deployed `/jobs`).
2. **Choose file** → pick `~/Downloads/jobs-forge-snapshot.json`.
3. Optional but recommended: install the page as an app (Chrome → Install). That
   grants persistent file permission, so refreshes need no clicks at all.

Chrome or Edge is required for automatic re-reading. Safari and Firefox can
still import the file manually - same data, one extra click per refresh.

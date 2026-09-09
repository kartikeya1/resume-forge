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

4. **Read-only against Gmail.** No labels, no archiving, no replies, no drafts.
   Gmail write-back is a later phase and needs the user's explicit go-ahead.

5. **Never guess a rejection.** If a subject is ambiguous ("Thank you for your
   interest in X"), read the body. If the body does not clearly say no, do not
   emit a rejection. Leaving a dead application open is recoverable; marking a
   live one dead means he stops chasing it.

6. **Keep `hints[].reason` short and true.** It is rendered verbatim in the UI.

---

## 3. Gather the mail

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

## 8. Extending the rules

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

## 9. First-time setup (user, once)

1. `npm run dev`, open <http://localhost:3000/jobs> (or the deployed `/jobs`).
2. **Choose file** → pick `~/Downloads/jobs-forge-snapshot.json`.
3. Optional but recommended: install the page as an app (Chrome → Install). That
   grants persistent file permission, so refreshes need no clicks at all.

Chrome or Edge is required for automatic re-reading. Safari and Firefox can
still import the file manually - same data, one extra click per refresh.

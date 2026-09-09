// Follow-up drafts for applications that have gone quiet.
//
// Generates text only. Nothing here sends anything, and the agent that
// consumes a draft plan is instructed to create a Gmail DRAFT and stop - the
// user presses send, always. An automated follow-up to a real recruiter is
// exactly the kind of irreversible, reputation-carrying action that should
// never happen without a human reading it first.

import { isHumanSender } from './status';
import type { Application } from './types';

export interface FollowUpDraft {
  applicationId: string;
  company: string;
  role: string | null;
  /** The most recent human who wrote, if there was one. */
  to: string | null;
  /** Thread to reply within, so it threads rather than starting cold. */
  threadId: string | null;
  subject: string;
  body: string;
  /** Why this one surfaced, for the review list. */
  reason: string;
  daysQuiet: number;
}

/**
 * First name from an address, for a greeting that is not "Hello,".
 *
 * Only trusts a `first.last` shape. A single-token localpart is genuinely
 * ambiguous - `krawat@tekion.com` is far more likely initial-plus-surname than
 * a first name, and opening a real email to a recruiter with their surname is
 * worse than opening it with "Hello,". So an unseparated localpart returns
 * null on purpose.
 */
function firstName(email: string): string | null {
  const local = email.split('@')[0] ?? '';
  if (!/[._-]/.test(local)) return null;
  const first = local.split(/[._-]/)[0];
  if (!first || first.length < 3 || /\d/.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function lastHumanContact(app: Application): { email: string; threadId: string } | null {
  for (let i = app.events.length - 1; i >= 0; i--) {
    const e = app.events[i];
    if (!e.fromMe && isHumanSender(e.from)) return { email: e.from, threadId: e.threadId };
  }
  return null;
}

/**
 * Which applications are worth a nudge.
 *
 * Deliberately narrow. A follow-up is only useful where a real person is on
 * the other end or a concrete step is outstanding; mass-emailing every ATS
 * no-reply address would be noise that costs him credibility.
 */
export function shouldFollowUp(app: Application, staleAfterDays: number): string | null {
  if (app.archived) return null;
  switch (app.status) {
    case 'interviewing':
      return app.flags.staleDays >= staleAfterDays
        ? `Interviewed ${app.flags.staleDays} days ago with no outcome.`
        : null;
    case 'lapsed':
      return app.flags.recruiterReplied
        ? 'A real person was engaged and the thread went cold on your side.'
        : null;
    case 'applied':
    case 'in_review':
      // Only where a human has actually written. Chasing a no-reply@ address
      // achieves nothing.
      return app.flags.recruiterReplied && app.flags.staleDays >= staleAfterDays
        ? `No reply for ${app.flags.staleDays} days.`
        : null;
    default:
      return null;
  }
}

export function buildFollowUpDraft(app: Application, reason: string): FollowUpDraft {
  const contact = lastHumanContact(app);
  const name = contact ? firstName(contact.email) : null;
  const company = app.company ?? 'the team';
  const roleClause = app.role ? `the ${app.role} role` : 'the role I applied for';

  const greeting = name ? `Hi ${name},` : 'Hello,';
  const opening =
    app.status === 'interviewing'
      ? `I wanted to follow up on ${roleClause} at ${company}. It has been about ${app.flags.staleDays} days since we spoke, and I am still very interested - is there an update on next steps, or anything else you need from me?`
      : app.status === 'lapsed'
        ? `Apologies for the delay in coming back to you about ${roleClause} at ${company}. If the process is still open, I would very much like to pick it back up - happy to work around whatever timing suits you.`
        : `I wanted to check in on my application for ${roleClause} at ${company}. I understand these things take time; if there is any update, or anything further I can share, I would be glad to hear from you.`;

  return {
    applicationId: app.id,
    company,
    role: app.role,
    to: contact?.email ?? null,
    threadId: contact?.threadId ?? app.threadIds[0] ?? null,
    subject: app.role ? `Following up - ${app.role}` : `Following up on my application`,
    body: `${greeting}\n\n${opening}\n\nThank you,\nKartikeya`,
    reason,
    daysQuiet: app.flags.staleDays,
  };
}

export interface FollowUpPlan {
  kind: 'jobs-forge-followup-plan';
  version: 1;
  generatedAt: string;
  /** Read by the agent as a hard instruction, and restated in JOBS-FORGE.md. */
  instruction: string;
  drafts: FollowUpDraft[];
}

export function buildFollowUpPlan(
  applications: Application[],
  staleAfterDays: number,
  now: number
): FollowUpPlan {
  const drafts: FollowUpDraft[] = [];
  for (const app of applications) {
    const reason = shouldFollowUp(app, staleAfterDays);
    if (reason) drafts.push(buildFollowUpDraft(app, reason));
  }
  drafts.sort((a, b) => b.daysQuiet - a.daysQuiet);
  return {
    kind: 'jobs-forge-followup-plan',
    version: 1,
    generatedAt: new Date(now).toISOString(),
    instruction:
      'Create these as Gmail DRAFTS only. Do not send anything. The user reviews and sends each one himself.',
    drafts,
  };
}

export function downloadFollowUpPlan(
  plan: FollowUpPlan,
  filename = 'jobs-forge-followup-plan.json'
): void {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

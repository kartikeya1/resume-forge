// Gmail label write-back: computing WHAT to change, never doing it.
//
// The dashboard cannot touch Gmail - it is client-side with no backend. Only
// the agent can, through the Gmail MCP. That split is a safety feature, not a
// limitation: this module turns the derived state into a reviewable plan file,
// the user reads it, and only then does an agent execute it. The judgment is
// deterministic and tested; the agent is a dumb executor.
//
// Three invariants make this safe to point at a 181,000-message mailbox:
//
//   1. Every label is namespaced under `JobsForge/`. Nothing here can ever
//      name one of his real labels, so the blast radius is bounded by
//      construction - and deleting those few labels is a complete undo.
//   2. `remove` only ever contains `JobsForge/` labels. Asserted in tests.
//   3. Noise is never labelled. Only threads that made it into an application
//      appear in a plan at all, so a misclassified newsletter gets ignored
//      rather than tagged.

import { CLOSED_STATUSES } from './labels';
import type { Application, JobStatus } from './types';

export const LABEL_PREFIX = 'JobsForge/';

export const JOBS_LABELS = [
  'JobsForge/Needs-You',
  'JobsForge/Interviewing',
  'JobsForge/Active',
  'JobsForge/Lapsed',
  'JobsForge/Closed',
] as const;

export type JobsLabel = (typeof JOBS_LABELS)[number];

export const LABEL_BLURBS: Record<JobsLabel, string> = {
  'JobsForge/Needs-You': 'Blocked on you, or a person is waiting on a reply.',
  'JobsForge/Interviewing': 'Interview scheduled or done, awaiting an outcome.',
  'JobsForge/Active': 'Live, submitted, nothing needed from you right now.',
  'JobsForge/Lapsed': 'You stopped responding. Recoverable if you act.',
  'JobsForge/Closed': 'Rejected, withdrawn, role closed, or gone quiet for good.',
};

/**
 * Deliberately five mutually-exclusive labels rather than one per status.
 *
 * Gmail's sidebar becomes unusable past a handful of labels, and the dashboard
 * is already the place for the full eleven-status detail. These exist so that
 * *while you are in Gmail* you can see which threads still want something.
 * Mutual exclusivity is what makes the sidebar counts trustworthy - a thread
 * carries exactly one.
 *
 * `Recruiter-Replied` was folded into `Needs-You` rather than shipped as a
 * sixth: the actionable half of "a human replied" is "and they are waiting on
 * you", which `Needs-You` already covers, and a recruiter reply on a rejected
 * application is not something to surface.
 */
export function labelForStatus(status: JobStatus, needsYou: boolean): JobsLabel {
  if (CLOSED_STATUSES.has(status)) return 'JobsForge/Closed';
  if (needsYou) return 'JobsForge/Needs-You';
  if (status === 'interviewing') return 'JobsForge/Interviewing';
  if (status === 'lapsed') return 'JobsForge/Lapsed';
  return 'JobsForge/Active';
}

export interface ThreadLabelChange {
  threadId: string;
  /** Context so the dry-run is readable without cross-referencing. */
  company: string | null;
  role: string | null;
  /** The JobsForge labels the thread already carries, per the snapshot. */
  current: string[];
  /** The single label it should end up with. */
  desired: JobsLabel;
  add: JobsLabel[];
  /** Always a subset of the JobsForge namespace. */
  remove: string[];
  reason: string;
}

export interface LabelPlan {
  kind: 'jobs-forge-label-plan';
  version: 1;
  generatedAt: string;
  /** So the agent can refuse to apply a plan built from a stale snapshot. */
  snapshotGeneratedAt: string;
  /** Every label that must exist before the plan can be applied. */
  labels: JobsLabel[];
  /** Only threads that actually need a change. */
  changes: ThreadLabelChange[];
  /** Threads already carrying the right label - nothing to do. */
  unchanged: number;
  /** Desired end state across every labelled thread, for the summary. */
  counts: Record<JobsLabel, number>;
  /** Applications deliberately left alone: manual entries have no mail. */
  skippedManual: number;
}

export interface LabelPlanInput {
  applications: Application[];
  /** threadId -> the label strings Gmail reports for that thread. */
  threadLabels: Record<string, string[]>;
  /** Which application ids are currently in the "Needs you" strip. */
  needsYouIds: Set<string>;
  snapshotGeneratedAt: string;
  now: number;
}

function jobsForgeLabelsOn(labels: string[] | undefined): string[] {
  return (labels ?? []).filter((l) => l.startsWith(LABEL_PREFIX));
}

/**
 * Collects each thread's Gmail labels from the snapshot.
 *
 * Gmail returns *ids* for user labels (`Label_4615939254519601567`), not
 * names, so this only ever recognises a `JobsForge/` label when the agent has
 * resolved ids to names while writing the snapshot - which JOBS-FORGE.md asks
 * it to do. When it has not, `current` comes back empty and every thread reads
 * as "add", which is still the correct outcome: adding a label a thread
 * already has is a no-op in Gmail. The only cost is a less precise first
 * dry-run, never a wrong write.
 */
export function threadLabelsFromSnapshot(
  threads: { id: string; messages: { labels?: string[] }[] }[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const t of threads) {
    const seen = new Set<string>();
    for (const m of t.messages) for (const l of m.labels ?? []) seen.add(l);
    out[t.id] = [...seen];
  }
  return out;
}

export function buildLabelPlan(input: LabelPlanInput): LabelPlan {
  const changes: ThreadLabelChange[] = [];
  const counts = Object.fromEntries(JOBS_LABELS.map((l) => [l, 0])) as Record<JobsLabel, number>;
  let unchanged = 0;
  let manual = 0;

  for (const app of input.applications) {
    // A manual entry has no mail to label. Nothing to do, and saying so in
    // `skipped` is more honest than silently omitting it.
    if (app.threadIds.length === 0) {
      manual += 1;
      continue;
    }

    // Archiving in the dashboard is an explicit "I am done with this", so it
    // reads as closed in Gmail regardless of what the ladder derived.
    const effectiveStatus: JobStatus = app.archived ? 'withdrawn' : app.status;
    const desired = labelForStatus(effectiveStatus, input.needsYouIds.has(app.id));

    for (const threadId of app.threadIds) {
      counts[desired] += 1;
      const current = jobsForgeLabelsOn(input.threadLabels[threadId]);
      const add: JobsLabel[] = current.includes(desired) ? [] : [desired];
      const remove = current.filter((l) => l !== desired);

      if (add.length === 0 && remove.length === 0) {
        unchanged += 1;
        continue;
      }
      changes.push({
        threadId,
        company: app.company,
        role: app.role,
        current,
        desired,
        add,
        remove,
        reason: app.archived ? 'Archived in Jobs Forge.' : app.statusReason,
      });
    }
  }

  // Sorted so two runs over the same data produce byte-identical files, which
  // is what makes "the plan is empty" a meaningful signal.
  changes.sort((a, b) => a.threadId.localeCompare(b.threadId));

  return {
    kind: 'jobs-forge-label-plan',
    version: 1,
    generatedAt: new Date(input.now).toISOString(),
    snapshotGeneratedAt: input.snapshotGeneratedAt,
    labels: [...JOBS_LABELS],
    changes,
    unchanged,
    counts,
    skippedManual: manual,
  };
}

/** One-line summary for the UI, before anyone opens the file. */
export function summariseLabelPlan(plan: LabelPlan): string {
  if (plan.changes.length === 0) {
    return `Gmail is already up to date - ${plan.unchanged} threads carry the right label.`;
  }
  const adds = plan.changes.filter((c) => c.add.length > 0).length;
  const moves = plan.changes.filter((c) => c.remove.length > 0).length;
  const parts = [`${plan.changes.length} thread${plan.changes.length === 1 ? '' : 's'} to change`];
  if (adds) parts.push(`${adds} to label`);
  if (moves) parts.push(`${moves} to re-label`);
  return `${parts.join(', ')}. ${plan.unchanged} already correct.`;
}

export function downloadLabelPlan(plan: LabelPlan, filename = 'jobs-forge-label-plan.json'): void {
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

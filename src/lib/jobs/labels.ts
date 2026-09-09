// Display vocabulary for statuses. Kept next to the logic so a new JobStatus
// cannot be added without a label and a badge - the Record types force it.

import type { JobStatus } from './types';

export const STATUS_LABELS: Record<JobStatus, string> = {
  lead: 'Lead',
  applied: 'Applied',
  in_review: 'In review',
  action_needed: 'Needs action',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  role_closed: 'Role closed',
  lapsed: 'Lapsed',
  ghosted: 'No response',
  withdrawn: 'Withdrawn',
};

/** One line explaining what the bucket means, shown under each group heading. */
export const STATUS_BLURBS: Record<JobStatus, string> = {
  lead: 'An opportunity you have not applied to yet.',
  applied: 'Submitted and acknowledged. Nothing since.',
  in_review: 'They confirmed it is being reviewed.',
  action_needed: 'Blocked on you. Do these first.',
  interviewing: 'Interview scheduled or done, awaiting the outcome.',
  offer: 'An offer is on the table.',
  rejected: 'They declined to move forward.',
  role_closed: 'The role was withdrawn. Not a rejection.',
  lapsed: 'You stopped responding. Recoverable if you act.',
  ghosted: 'They went quiet and never came back.',
  withdrawn: 'You withdrew.',
};

// Mirrors the semantic scale already used in the app: emerald good, amber
// warning, red bad, neutral inert. See src/components/DocsMenu.tsx.
export const STATUS_BADGE: Record<JobStatus, string> = {
  lead: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  applied: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  in_review: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  action_needed: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  interviewing: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  offer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  role_closed: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
  lapsed: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  ghosted: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
  withdrawn: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
};

/** Live first, dead last. Drives the order of the grouped list. */
export const STATUS_ORDER: JobStatus[] = [
  'action_needed',
  'interviewing',
  'offer',
  'in_review',
  'applied',
  'lead',
  'lapsed',
  'ghosted',
  'rejected',
  'role_closed',
  'withdrawn',
];

/** Statuses that are over. Excluded from the "live pipeline" count. */
export const CLOSED_STATUSES: ReadonlySet<JobStatus> = new Set<JobStatus>([
  'rejected', 'role_closed', 'withdrawn', 'ghosted',
]);

export function gmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${threadId}`;
}

export function relativeTime(from: number, now: number): string {
  const days = Math.floor((now - from) / 86400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

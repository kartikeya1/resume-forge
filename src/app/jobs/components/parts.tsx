'use client';

import { useId, useState } from 'react';
import { interviewPrepPrompt } from '@/lib/jobs/activity';
import { STATUS_BADGE, STATUS_LABELS, gmailThreadUrl, relativeTime } from '@/lib/jobs/labels';
import type { Application, ExcludedThread } from '@/lib/jobs/types';
import { EditPanel } from './EditPanel';
import { WhyPopover } from './WhyPopover';

// Repeated class strings hoisted to module consts, matching the convention in
// src/components/InsightsPanel.tsx.
export const CARD = 'rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800';
export const TEXT = 'text-neutral-700 dark:text-neutral-200';
export const MUTED = 'text-neutral-500 dark:text-neutral-400';
export const CHIP = 'rounded-full px-2 py-0.5 text-[11px] font-medium';

export function StatusPill({ status }: { status: Application['status'] }) {
  return <span className={`${CHIP} ${STATUS_BADGE[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function Flag({ tone, children }: { tone: 'urgent' | 'info'; children: React.ReactNode }) {
  const cls =
    tone === 'urgent'
      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
  return <span className={`${CHIP} ${cls}`}>{children}</span>;
}

export function KpiTile({ label, value, tone }: { label: string; value: number; tone?: 'urgent' }) {
  return (
    <div className={`${CARD} px-3 py-2`}>
      <div
        className={`text-2xl font-semibold tabular-nums ${
          tone === 'urgent' && value > 0
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-neutral-900 dark:text-neutral-100'
        }`}
      >
        {value}
      </div>
      <div className={`text-[11px] uppercase tracking-wide ${MUTED}`}>{label}</div>
    </div>
  );
}

export function ApplicationRow({
  app,
  now,
  reason,
  allApps,
}: {
  app: Application;
  now: number;
  reason?: string | null;
  /** All applications, for the "merge with..." picker in the edit panel. */
  allApps: Application[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const primary = app.company ?? 'Unknown company';
  const href = app.threadIds.length ? gmailThreadUrl(app.threadIds[0]) : undefined;

  return (
    <li className="border-t border-neutral-100 first:border-t-0 dark:border-neutral-700">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2.5">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100"
        >
          {primary}
        </a>
        <span className={`text-sm ${TEXT}`}>{app.role ?? 'Role not stated'}</span>
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {app.flags.recruiterReplied && <Flag tone="info">Human replied</Flag>}
          {app.flags.needsReview && <Flag tone="info">Check</Flag>}
          {app.edited && <Flag tone="info">Edited</Flag>}
          <StatusPill status={app.status} />
          {app.status === 'interviewing' && <PrepButton app={app} />}
          <WhyPopover app={app} />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            {open ? 'Close' : 'Edit'}
          </button>
        </span>
      </div>
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2.5 text-xs ${MUTED}`}>
        <span>{reason ?? app.statusReason}</span>
        <span aria-hidden="true">&middot;</span>
        <span>last activity {relativeTime(app.lastAt, now)}</span>
        {app.reqIds.length > 0 && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="tabular-nums">req {app.reqIds[0]}</span>
          </>
        )}
        {app.threadIds.length > 1 && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span>{app.threadIds.length} threads merged</span>
          </>
        )}
        {app.notes && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="italic">{app.notes}</span>
          </>
        )}
        {app.agentReason && !app.notes && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className="italic">{app.agentReason}</span>
          </>
        )}
      </div>
      {open && <div id={panelId}><EditPanel app={app} allApps={allApps} /></div>}
    </li>
  );
}

/**
 * Hands an interview off to his existing `interview-prep` skill. A copied
 * prompt rather than a link: that skill is a Claude Code invocation, so there
 * is no URL to point at.
 */
function PrepButton({ app }: { app: Application }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(interviewPrepPrompt(app));
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard can be blocked; the popover still shows the prompt.
        }
      }}
      title="Copy a prompt to paste into Claude Code"
      className="rounded-md border border-violet-300 px-2 py-1 text-xs font-medium text-violet-700 transition hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950"
    >
      {copied ? 'Copied' : 'Prep'}
    </button>
  );
}

export function ThreadRow({ t }: { t: ExcludedThread }) {
  return (
    <li className={`border-t border-neutral-100 px-3 py-2 text-xs dark:border-neutral-700 ${MUTED}`}>
      <a
        href={gmailThreadUrl(t.threadId)}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-neutral-700 underline-offset-2 hover:underline dark:text-neutral-200"
      >
        {t.subject || '(no subject)'}
      </a>
      <div className="mt-0.5 flex flex-wrap gap-x-2">
        <span>{t.from}</span>
        <span aria-hidden="true">&middot;</span>
        <span className="font-mono text-[10px]">{t.reasons.join(' → ')}</span>
      </div>
    </li>
  );
}

'use client';

import { useState } from 'react';
import { interviewPrepPrompt } from '@/lib/jobs/activity';
import { gmailThreadUrl } from '@/lib/jobs/labels';
import type { Application, ExcludedThread } from '@/lib/jobs/types';
import { CHIP, MUTED } from './ui';

export function Flag({
  tone,
  title,
  children,
}: {
  tone: 'urgent' | 'info';
  /** The long form, when the flag itself has to stay two words wide. */
  title?: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === 'urgent'
      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
  return (
    <span title={title} className={`${CHIP} ${cls}`}>
      {children}
    </span>
  );
}

/**
 * Hands an interview off to his existing `interview-prep` skill. A copied
 * prompt rather than a link: that skill is a Claude Code invocation, so there
 * is no URL to point at.
 */
export function PrepButton({ app }: { app: Application }) {
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

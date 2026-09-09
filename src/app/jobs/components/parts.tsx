'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const areaId = useId();
  const prompt = interviewPrepPrompt(app);

  // After the commit that mounts the textarea, not in the click handler - see
  // the note in CopyPromptBlock.
  useEffect(() => {
    if (state !== 'failed') return;
    areaRef.current?.focus();
    areaRef.current?.select();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(prompt);
            setState('copied');
            window.setTimeout(() => setState('idle'), 2000);
          } catch {
            // The old version swallowed this in an empty catch, so on any
            // browser that blocks clipboard writes the button simply did
            // nothing and said nothing. Fall back to a selectable textarea.
            setState('failed');
          }
        }}
        title="Copy an interview-prep prompt"
        aria-controls={state === 'failed' ? areaId : undefined}
        className="rounded-md border border-violet-300 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 transition hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950"
      >
        {state === 'copied' ? 'Copied' : 'Prep'}
      </button>
      {state === 'failed' && (
        <textarea
          ref={areaRef}
          id={areaId}
          readOnly
          value={prompt}
          rows={6}
          spellCheck={false}
          aria-label="Interview prep prompt"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 w-full rounded-md border border-neutral-300 bg-neutral-50 p-2 font-mono text-[10px] leading-snug text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
        />
      )}
    </>
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

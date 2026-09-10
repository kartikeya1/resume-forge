'use client';

import { useCallback, useRef, useState } from 'react';
import { gmailThreadUrl } from '@/lib/jobs/labels';
import { useOverridesStore } from '@/lib/jobs/overridesStore';
import type { ExcludedThread } from '@/lib/jobs/types';
import { MUTED } from './ui';

/**
 * The keyboard help line for the review list. Exported so the lane header can
 * carry it: a lane body is just a scroll container, so the list below can move
 * into a lane untouched, but the instructions have to move with it.
 */
export function ReviewHelp() {
  return (
    <>
      Arrow keys to move,{' '}
      <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-600">a</kbd> to add as
      an application,{' '}
      <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-600">x</kbd> to
      dismiss,{' '}
      <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-600">Enter</kbd> to
      open in Gmail.
    </>
  );
}

/**
 * The threads the classifier could not place confidently, as a listbox with
 * roving-tabindex arrow-key navigation - matching the manual keydown-listener
 * pattern already used by Menu in src/components/ui.tsx, since there is no
 * ready-made list-nav primitive in this repo to reuse instead.
 *
 * a = add as a manual application (quick-prefilled from the subject/sender)
 * x = dismiss (not a job - hidden locally, never re-classified)
 * Enter / o = open the Gmail thread
 * up / down = move focus
 *
 * This is the body only - no heading, no wrapper card - so it can be dropped
 * into a board lane or rendered on its own.
 */
export function ReviewList({
  threads,
  onAdd,
}: {
  threads: ExcludedThread[];
  onAdd: (prefill: { company: string; role?: string }) => void;
}) {
  const store = useOverridesStore();
  const dismissed = useOverridesStore((s) => s.overrides.dismissedReview);
  const visible = threads.filter((t) => !dismissed.includes(t.threadId));
  const [active, setActive] = useState(0);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  // Clamped at render time rather than synced back into state via an effect -
  // dismissing the last-focused row (list shrinks) would otherwise need an
  // extra render pass just to notice `active` now points past the end.
  const clampedActive = Math.min(active, Math.max(0, visible.length - 1));

  const focusIndex = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(i, visible.length - 1));
      setActive(clamped);
      itemRefs.current[clamped]?.focus();
    },
    [visible.length]
  );

  if (visible.length === 0) return null;

  return (
    <ul role="listbox" aria-label="Threads needing review">
      {visible.map((t, i) => (
        <li
          key={t.threadId}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          role="option"
          aria-selected={i === clampedActive}
          tabIndex={i === clampedActive ? 0 : -1}
          onFocus={() => setActive(i)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              focusIndex(i + 1);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              focusIndex(i - 1);
            } else if (e.key === 'Enter' || e.key === 'o') {
              window.open(gmailThreadUrl(t.threadId), '_blank', 'noreferrer');
            } else if (e.key === 'a') {
              onAdd({ company: guessCompany(t), role: undefined });
            } else if (e.key === 'x') {
              e.preventDefault();
              store.dismissReview(t.threadId);
              // Focus doesn't move on its own once the row unmounts, so step
              // to the next one deliberately.
              requestAnimationFrame(() => focusIndex(i));
            }
          }}
          className={`border-t border-neutral-100 px-3 py-2 text-xs outline-none first:border-t-0 dark:border-neutral-700 ${
            i === clampedActive ? 'bg-neutral-100 dark:bg-neutral-700/50' : ''
          }`}
        >
          <div className="min-w-0">
            <a
              href={gmailThreadUrl(t.threadId)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-700 underline-offset-2 hover:underline dark:text-neutral-200"
            >
              {t.subject || '(no subject)'}
            </a>
            <div className={`mt-0.5 flex flex-wrap gap-x-2 ${MUTED}`}>
              <span className="truncate">{t.from}</span>
              <span aria-hidden="true">&middot;</span>
              <span className="font-mono text-[10px]">{t.reasons.join(' → ')}</span>
            </div>
          </div>
          {/* Wraps below the text rather than sitting beside it: a lane is
              300px wide, and a row that keeps two buttons on the same line as
              a subject line has room for neither. */}
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-2 py-1 font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-700"
              onClick={() => onAdd({ company: guessCompany(t) })}
            >
              Add
            </button>
            <button
              type="button"
              className="rounded-md border border-neutral-300 px-2 py-1 font-medium text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700"
              onClick={() => store.dismissReview(t.threadId)}
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A first guess at a company name from the sender domain, for the quick-add prefill. */
function guessCompany(t: ExcludedThread): string {
  const domain = t.from.split('@')[1] ?? '';
  const label = domain.split('.').slice(-2)[0] ?? '';
  if (!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

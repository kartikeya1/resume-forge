'use client';

import { useRef, useState } from 'react';
import { buildRefreshPrompt } from '@/lib/jobs/syncPrompt';
import { CopyPromptBlock } from './CopyPromptBlock';
import { BTN_PRIMARY, MUTED, RIBBON_BTN_GHOST, TEXT } from './ui';
import type { ConnectionState } from '@/lib/jobs/useSnapshot';

/**
 * The way in.
 *
 * This is the only screen someone sees before there is any data, so it is the
 * closest thing this app has to a sign-in page - and it was previously a
 * single flat card with four paragraphs and five same-weight buttons stacked
 * in it. Nothing was missing; it just gave no clue that this is a two-step
 * job, or which button to press first.
 *
 * So it is now two numbered steps, in the order they have to happen: you
 * cannot open a snapshot you have not generated. Each step has exactly one
 * primary action, and everything secondary is quiet.
 */
export function ConnectPanel({
  connection,
  pickerSupported,
  busy,
  error,
  onConnect,
  onImport,
  onDrop,
  now,
}: {
  connection: ConnectionState;
  pickerSupported: boolean;
  busy: boolean;
  error: string | null;
  onConnect: () => void;
  onImport: (f: File) => void;
  onDrop: (dt: DataTransfer) => void;
  now: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    // The whole card stays a drop target even though the dashed zone in step 2
    // is what advertises it - a file let go slightly off-target should still
    // land rather than navigate the browser away to a JSON file.
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDrop(e.dataTransfer);
      }}
    >
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Jobs Forge
        </h2>
        <p className={`mt-1 text-sm ${MUTED}`}>
          Every application you have sent, in one board.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
        <Step
          n={1}
          title="Generate your snapshot"
          body={
            <>
              Jobs Forge reads a file that an AI writes from your Gmail. The prompt below carries
              the queries, the file format and the rules, so it works in any chat window on any
              machine.
            </>
          }
        >
          <CopyPromptBlock
            prompt={buildRefreshPrompt({ until: null, since: null, now })}
            label="Copy setup prompt"
          />
          <p className={`mt-2 text-xs ${MUTED}`}>
            It saves to <code className="text-[11px]">~/Downloads/jobs-forge-snapshot.json</code>.
          </p>
        </Step>

        <Step
          n={2}
          title="Open it here"
          last
          body={
            pickerSupported ? (
              <>Point this page at that file once. Every later visit re-reads it on its own.</>
            ) : (
              <>Choose that file to load your board.</>
            )
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={pickerSupported ? onConnect : () => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? 'Opening…' : 'Choose file'}
            </button>
            {pickerSupported && (
              <button
                type="button"
                className={RIBBON_BTN_GHOST}
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                Import once instead
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Import a Jobs Forge snapshot file"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />

          <div
            className={`mt-3 rounded-lg border border-dashed px-3 py-3 text-center text-xs transition ${
              over
                ? 'border-neutral-900 bg-neutral-100 text-neutral-900 dark:border-neutral-300 dark:bg-neutral-700 dark:text-neutral-100'
                : `border-neutral-300 dark:border-neutral-600 ${MUTED}`
            }`}
          >
            {over ? 'Drop to open' : 'or drop the file here'}
          </div>

          {!pickerSupported && connection !== 'loading' && (
            <p className={`mt-3 text-xs ${MUTED}`}>
              This browser cannot re-read a local file on its own, so you will need to import after
              each refresh. Chrome or Edge can do it automatically.
            </p>
          )}
        </Step>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
          {error}
        </p>
      )}

      <p className={`mt-5 text-center text-xs ${MUTED}`}>
        The file never leaves your machine. Nothing is uploaded and nothing is committed.
      </p>
    </div>
  );
}

/** One numbered step. The rule between steps is what makes the order readable. */
function Step({
  n,
  title,
  body,
  last,
  children,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={`Step ${n}: ${title}`}
      className={last ? 'px-4 py-4' : 'border-b border-neutral-200 px-4 py-4 dark:border-neutral-700'}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-full bg-neutral-900 text-[11px] font-semibold tabular-nums text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          {n}
        </span>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      </div>
      <p className={`mt-1.5 pl-[30px] text-sm leading-relaxed ${TEXT}`}>{body}</p>
      <div className="mt-3 pl-[30px]">{children}</div>
    </section>
  );
}

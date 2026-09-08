'use client';

import { useRef, useState } from 'react';
import { CARD, MUTED, TEXT } from './parts';
import type { ConnectionState } from '@/lib/jobs/useSnapshot';

const BTN =
  'inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800';
const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300';

export function ConnectPanel({
  connection,
  pickerSupported,
  busy,
  error,
  onConnect,
  onImport,
  onDrop,
}: {
  connection: ConnectionState;
  pickerSupported: boolean;
  busy: boolean;
  error: string | null;
  onConnect: () => void;
  onImport: (f: File) => void;
  onDrop: (dt: DataTransfer) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
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
      className={`${CARD} px-4 py-5 ${over ? 'border-neutral-900 dark:border-neutral-300' : ''}`}
    >
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Connect your snapshot file
      </h2>
      <p className={`mt-1.5 max-w-prose text-sm ${TEXT}`}>
        Ask an agent to run the steps in <code className="text-xs">JOBS-FORGE.md</code>. It writes{' '}
        <code className="text-xs">~/Downloads/jobs-forge-snapshot.json</code> from your Gmail. Point this
        page at that file once and every later visit re-reads it automatically.
      </p>
      <p className={`mt-1.5 max-w-prose text-xs ${MUTED}`}>
        The file never leaves your machine. Nothing is uploaded and nothing is committed.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {pickerSupported && (
          <button type="button" className={BTN_PRIMARY} onClick={onConnect} disabled={busy}>
            Choose file
          </button>
        )}
        <button type="button" className={BTN} onClick={() => inputRef.current?.click()} disabled={busy}>
          {pickerSupported ? 'Import once' : 'Choose file'}
        </button>
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
        <span className={`text-xs ${MUTED}`}>or drop the file here</span>
      </div>

      {!pickerSupported && connection !== 'loading' && (
        <p className={`mt-3 text-xs ${MUTED}`}>
          This browser cannot re-read a local file on its own, so you will need to import after each
          refresh. Chrome or Edge can do it automatically.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export { BTN, BTN_PRIMARY };

'use client';

import { useId, useState } from 'react';
import { encryptJson, KDF_ITERATIONS } from '@/lib/jobs/crypto';
import { assessPassphrase } from '@/lib/jobs/passphrase';
import type { JobsSnapshot } from '@/lib/jobs/snapshot';
import { BTN_PRIMARY, CARD, MUTED, TEXT } from './ui';

export const PUBLISHED_PATH = '/jobs-snapshot.enc';

/**
 * Encrypt the loaded snapshot so it can be committed and read on a phone.
 *
 * The browser does the encrypting, deliberately. An agent could commit the
 * file just as easily, but only the browser ever sees the passphrase - it is
 * typed here, used once, and never persisted or handed to anything.
 */
export function PublishPanel({ snapshot }: { snapshot: JobsSnapshot }) {
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passId = useId();
  const confirmId = useId();
  const panelId = useId();

  const assessment = assessPassphrase(pass);
  const mismatch = confirm.length > 0 && confirm !== pass;
  const canPublish = assessment.acceptable && !mismatch && confirm === pass && !busy;


  return (
    <div id={panelId} className={`${CARD} w-full px-3 py-3`}>

      <p className={`max-w-prose text-sm ${TEXT}`}>
        Encrypts this snapshot in your browser and downloads it. Commit the file to{' '}
        <code className="text-xs">public/jobs-snapshot.enc</code> and any device can open{' '}
        <code className="text-xs">/jobs</code> with the passphrase - no file picker, no desktop.
      </p>

      <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <strong>Read this once.</strong> The encrypted file goes into a public repo, so anyone can
        download it and attack it offline, forever, with no rate limit. Its only defence is your
        passphrase. Four or five unrelated words - not a password you have used elsewhere. There is
        no recovery: lose it and you simply publish again.
      </div>

      <div className="mt-3 space-y-2">
        <div>
          <label htmlFor={passId} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Passphrase
          </label>
          <input
            id={passId}
            type="password"
            autoComplete="new-password"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setDone(false); setError(null); }}
            placeholder="granite otter caravan thimble ledger"
            aria-describedby={`${passId}-help`}
            className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400"
          />
          <p
            id={`${passId}-help`}
            className={`mt-1 text-xs ${
              assessment.verdict === 'strong'
                ? 'text-emerald-700 dark:text-emerald-400'
                : assessment.acceptable
                  ? 'text-amber-700 dark:text-amber-400'
                  : MUTED
            }`}
          >
            {pass.length === 0 ? 'Four or five unrelated words.' : assessment.message}
          </p>
        </div>

        <div>
          <label htmlFor={confirmId} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Confirm
          </label>
          <input
            id={confirmId}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setDone(false); }}
            className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400"
          />
          {mismatch && (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              These do not match.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={!canPublish}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const envelope = await encryptJson(snapshot, pass, {
                snapshotGeneratedAt: snapshot.generatedAt,
                now: Date.now(),
              });
              const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'jobs-snapshot.enc';
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              // Cleared immediately - there is no reason for it to sit in
              // component state once the file exists.
              setPass('');
              setConfirm('');
              setDone(true);
            } catch {
              setError('Encryption failed. This needs a secure context (https or localhost).');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? `Encrypting (${(KDF_ITERATIONS / 1000).toFixed(0)}k rounds)...` : 'Encrypt and download'}
        </button>
        {done && (
          <span role="status" className="text-xs text-emerald-700 dark:text-emerald-400">
            Downloaded. Move it to <code>public/jobs-snapshot.enc</code> and commit.
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <p className={`mt-3 text-xs ${MUTED}`}>
        AES-256-GCM, key stretched with PBKDF2-SHA256 at {KDF_ITERATIONS.toLocaleString()} rounds.
        The passphrase never leaves this tab and is discarded as soon as the file is written.
      </p>
    </div>
  );
}

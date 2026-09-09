'use client';

import { useId, useState } from 'react';
import { relativeTime } from '@/lib/jobs/labels';
import type { EncryptedEnvelope } from '@/lib/jobs/crypto';
import { BTN_PRIMARY } from './ConnectPanel';
import { CARD, MUTED, TEXT } from './parts';

/**
 * The phone path. A published encrypted snapshot exists, so there is no file
 * to pick - just a passphrase to enter.
 *
 * Deliberately shows how old the snapshot is *before* unlocking: the envelope
 * carries `snapshotGeneratedAt` in the clear precisely so a stale publish is
 * obvious without spending 600,000 PBKDF2 rounds to find out.
 */
export function UnlockPanel({
  envelope,
  onUnlock,
  busy,
  error,
  now,
}: {
  envelope: EncryptedEnvelope;
  onUnlock: (passphrase: string) => void;
  busy: boolean;
  error: string | null;
  now: number;
}) {
  const [pass, setPass] = useState('');
  const passId = useId();
  const generatedAt = Date.parse(envelope.snapshotGeneratedAt);

  return (
    <div className={`${CARD} px-4 py-5`}>
      <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Unlock your dashboard
      </h2>
      <p className={`mt-1.5 max-w-prose text-sm ${TEXT}`}>
        A published snapshot is available on this device. Enter the passphrase you used when you
        published it.
      </p>
      {!Number.isNaN(generatedAt) && (
        <p className={`mt-1.5 text-xs ${MUTED}`}>
          Published snapshot from {relativeTime(generatedAt, now)}.
        </p>
      )}

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pass && !busy) onUnlock(pass);
        }}
      >
        <label htmlFor={passId} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Passphrase
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id={passId}
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400"
          />
          <button type="submit" className={BTN_PRIMARY} disabled={!pass || busy}>
            {busy ? 'Unlocking...' : 'Unlock'}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <p className={`mt-4 text-xs ${MUTED}`}>
        Unlocking runs 600,000 key-stretching rounds, so it takes a second or two on a phone. That
        delay is the point - it is what makes the published file expensive to attack.
      </p>
    </div>
  );
}

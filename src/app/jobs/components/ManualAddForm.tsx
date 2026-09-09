'use client';

import { useId, useState } from 'react';
import { TextInput } from '@/components/ui';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/jobs/labels';
import { useOverridesStore } from '@/lib/jobs/overridesStore';
import type { JobStatus } from '@/lib/jobs/types';
import { BTN, BTN_PRIMARY } from './ConnectPanel';
import { CARD } from './parts';

const SELECT_CLASS =
  'w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400';

/**
 * For anything that never generated email: a LinkedIn Easy Apply, a referral
 * over WhatsApp, a walk-in. Kept intentionally minimal - it produces a
 * ManualApplication, which skips the classify/correlate pipeline entirely.
 */
export function ManualAddForm({
  onDone,
  initial,
}: {
  onDone?: () => void;
  /** Pre-fills and auto-opens - pass a fresh `key` on the element to reset it. */
  initial?: { company: string; role?: string };
}) {
  const store = useOverridesStore();
  const [open, setOpen] = useState(!!initial);
  const [company, setCompany] = useState(initial?.company ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [status, setStatus] = useState<JobStatus>('applied');
  const statusId = useId();

  if (!open) {
    return (
      <button type="button" className={BTN} onClick={() => setOpen(true)}>
        + Add application
      </button>
    );
  }

  return (
    <div className={`${CARD} px-3 py-3`}>
      <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1.2fr]">
        <TextInput label="Company" value={company} onChange={setCompany} placeholder="Company name" />
        <TextInput label="Role" value={role} onChange={setRole} placeholder="Job title (optional)" />
        <div>
          <label htmlFor={statusId} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Status
          </label>
          <select id={statusId} className={SELECT_CLASS} value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={!company.trim()}
          onClick={() => {
            store.addManual({ company, role: role || undefined, status });
            setCompany('');
            setRole('');
            setStatus('applied');
            setOpen(false);
            onDone?.();
          }}
        >
          Add
        </button>
        <button type="button" className={BTN} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

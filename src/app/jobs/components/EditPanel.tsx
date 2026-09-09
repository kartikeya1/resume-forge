'use client';

import { useId, useState } from 'react';
import { AutoTextarea, Label, TextInput } from '@/components/ui';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/jobs/labels';
import { useOverridesStore } from '@/lib/jobs/overridesStore';
import type { Application, JobStatus } from '@/lib/jobs/types';
import { BTN, MUTED, SELECT_CLASS } from './ui';

// Manual is excluded from a status select on a manual entry - it's not a
// derived state, it's the raw truth the user typed in, so every status
// (including the closed ones) is a valid manual choice.

export function EditPanel({ app, allApps }: { app: Application; allApps: Application[] }) {
  const overridesStore = useOverridesStore();
  const [company, setCompanyLocal] = useState(app.company ?? '');
  const [role, setRoleLocal] = useState(app.role ?? '');
  const [notes, setNotesLocal] = useState(app.notes ?? '');
  const [mergeTarget, setMergeTarget] = useState('');
  const statusId = useId();
  const mergeId = useId();

  const isManual = app.id.startsWith('manual:');
  const hasOverride = !!app.edited;
  // Merging is thread-level, so a manual entry (no threads at all) has
  // nothing for the join predicate to act on and is excluded from the list.
  const mergeCandidates = allApps.filter((a) => a.id !== app.id && a.threadIds.length > 0);

  return (
    <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-3 dark:border-neutral-700 dark:bg-neutral-900/40">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* One cell per field - see the note in ManualAddForm. */}
        <div>
          <TextInput label="Company" value={company} onChange={setCompanyLocal} placeholder="Company name" />
        </div>
        <div>
          <TextInput label="Role" value={role} onChange={setRoleLocal} placeholder="Job title" />
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor={statusId} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Status
        </label>
        <select
          id={statusId}
          className={SELECT_CLASS}
          value={app.status}
          onChange={(e) => overridesStore.setStatus(app.id, e.target.value as JobStatus)}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <AutoTextarea label="Notes" value={notes} onChange={setNotesLocal} placeholder="Anything worth remembering" minRows={2} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BTN}
          onClick={() => {
            overridesStore.renameCompany(app.id, company);
            overridesStore.renameRole(app.id, role);
            overridesStore.setNotes(app.id, notes);
          }}
        >
          Save
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() => overridesStore.setArchived(app.id, !app.archived)}
          aria-pressed={!!app.archived}
        >
          {app.archived ? 'Unarchive' : 'Archive'}
        </button>
        {hasOverride && !isManual && (
          <button
            type="button"
            className={BTN}
            onClick={() => overridesStore.clearField(app.id)}
            title="Discard every hand edit and go back to what the pipeline derived"
          >
            Reset to derived
          </button>
        )}
        {isManual && (
          <button
            type="button"
            className={`${BTN} border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950`}
            onClick={() => overridesStore.removeManual(app.id)}
          >
            Delete
          </button>
        )}
      </div>

      {app.threadIds.length > 0 && mergeCandidates.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-700">
          <label htmlFor={mergeId} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            This is the same application as...
          </label>
          <div className="flex flex-wrap gap-2">
            <select id={mergeId} className={`${SELECT_CLASS} max-w-xs`} value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
              <option value="">Pick an application to merge with</option>
              {mergeCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company ?? 'Unknown company'} — {c.role ?? 'role not stated'}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={BTN}
              disabled={!mergeTarget}
              onClick={() => {
                const target = mergeCandidates.find((c) => c.id === mergeTarget);
                if (!target) return;
                overridesStore.mergeThreads([...app.threadIds, ...target.threadIds]);
                setMergeTarget('');
              }}
            >
              Merge
            </button>
          </div>
        </div>
      )}

      {app.threadIds.length > 1 && (
        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-700">
          <Label>Merged threads</Label>
          <ul className="mt-1 space-y-1">
            {app.threadIds.map((threadId) => (
              <li key={threadId} className="flex items-center justify-between gap-2">
                <a
                  href={`https://mail.google.com/mail/u/0/#all/${threadId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`truncate font-mono text-[11px] underline-offset-2 hover:underline ${MUTED}`}
                >
                  {threadId}
                </a>
                <button
                  type="button"
                  className="shrink-0 text-[11px] font-medium text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
                  onClick={() => {
                    // Split this one thread from every other member of the
                    // group, so it can never silently re-merge on a later
                    // classifier improvement.
                    const others = app.threadIds.filter((id) => id !== threadId);
                    for (const other of others) overridesStore.splitThreads([threadId, other]);
                  }}
                >
                  Split out
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

'use client';

import { Menu } from '@/components/ui';
import { CLOSED_STATUSES, STATUS_BADGE, STATUS_LABELS, STATUS_ORDER } from '@/lib/jobs/labels';
import type { JobStatus } from '@/lib/jobs/types';
import { CHIP, MUTED } from './ui';

/**
 * The status pill, turned into the control that changes the status.
 *
 * There is no drag-and-drop on this board and no dependency for it. Moving a
 * card is instead a two-click menu on the pill that already states where the
 * card is - so the card does not have to show a pill AND a separate button
 * meaning the same thing. `triggerClassName` on Menu exists for this.
 *
 * All eleven statuses are offered, `withdrawn` included. "Manual only, never
 * derived" means no *rule* produces it, not that it cannot be chosen; the
 * edit panel's select has always offered all eleven, so anything less here
 * would be a regression in what you can express.
 */
export function StatusDropdown({
  status,
  company,
  onChange,
}: {
  status: JobStatus;
  /** For the trigger's accessible name - "Applied" alone is ambiguous in a lane of cards. */
  company: string;
  onChange: (next: JobStatus) => void;
}) {
  return (
    <Menu
      label={STATUS_LABELS[status]}
      width="w-56"
      triggerClassName={`inline-flex items-center gap-1 ${CHIP} ${STATUS_BADGE[status]}`}
      triggerLabel={`Status of ${company}: ${STATUS_LABELS[status]}. Change status`}
    >
      {(close) => (
        <div>
          <p className={`px-2 py-1 text-[11px] font-medium ${MUTED}`}>Move to</p>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === status}
              onClick={() => {
                if (s !== status) onChange(s);
                close();
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                s === status
                  ? 'font-medium text-neutral-900 dark:text-neutral-100'
                  : 'text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <span aria-hidden="true" className="w-3 text-xs">
                {s === status ? '✓' : ''}
              </span>
              <span className={`${CHIP} ${STATUS_BADGE[s]}`}>{STATUS_LABELS[s]}</span>
              {CLOSED_STATUSES.has(s) && (
                <span aria-hidden="true" className={`ml-auto text-[10px] ${MUTED}`}>
                  closed
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </Menu>
  );
}

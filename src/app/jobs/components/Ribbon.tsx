'use client';

import { Menu } from '@/components/ui';
import { relativeTime } from '@/lib/jobs/labels';
import type { ChipCounts, ChipFilter } from '@/lib/jobs/board';
import { CHIP, MUTED, RIBBON_BTN } from './ui';

/**
 * The top ribbon: identity and freshness on the left, file actions on the
 * right, and the filter chips on a second row.
 *
 * Everything here used to be spread between a header at the top and a button
 * strip below the last status section, which meant the controls you use most
 * were the ones furthest from where you were looking.
 */
export function Ribbon({
  generatedAt,
  now,
  stale,
  staleHours,
  counts,
  filter,
  onFilter,
  closedCount,
  filteredCount,
  showClosed,
  showFiltered,
  onToggleClosed,
  onToggleFiltered,
  addOpen,
  onToggleAdd,
  canRefresh,
  canGrant,
  busy,
  onRefresh,
  onGrant,
  onExportCsv,
  canExportCsv,
  onDisconnect,
  warnings,
  theme,
  onToggleTheme,
}: {
  generatedAt: number | null;
  now: number;
  stale: boolean;
  staleHours: number;
  counts: ChipCounts;
  filter: ChipFilter;
  onFilter: (f: ChipFilter) => void;
  closedCount: number;
  filteredCount: number;
  showClosed: boolean;
  showFiltered: boolean;
  onToggleClosed: () => void;
  onToggleFiltered: () => void;
  addOpen: boolean;
  onToggleAdd: () => void;
  canRefresh: boolean;
  canGrant: boolean;
  busy: boolean;
  onRefresh: () => void;
  onGrant: () => void;
  onExportCsv: () => void;
  canExportCsv: boolean;
  onDisconnect: () => void;
  warnings: string[];
  theme: string;
  onToggleTheme: () => void;
}) {
  return (
    <div className="border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Jobs Forge</h1>

        {generatedAt !== null && (
          <span
            className={`${CHIP} ${
              stale
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
            }`}
            title={stale ? `More than ${staleHours} hours old.` : undefined}
          >
            updated {relativeTime(generatedAt, now)}
          </span>
        )}

        {/* Left of the ribbon, as asked - it is the one control here that
            creates something rather than acting on what already exists. */}
        <button
          type="button"
          className={RIBBON_BTN}
          onClick={onToggleAdd}
          aria-expanded={addOpen}
          aria-controls="add-application-strip"
        >
          {addOpen ? 'Close' : '+ Add application'}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {canRefresh && (
            <button type="button" className={RIBBON_BTN} onClick={onRefresh} disabled={busy}>
              Refresh
            </button>
          )}
          {canGrant && (
            <button type="button" className={RIBBON_BTN} onClick={onGrant} disabled={busy}>
              Reconnect file
            </button>
          )}
          <button type="button" className={RIBBON_BTN} onClick={onExportCsv} disabled={!canExportCsv}>
            Export CSV
          </button>
          <button type="button" className={RIBBON_BTN} onClick={onDisconnect}>
            Disconnect file
          </button>

          {warnings.length > 0 && (
            // Was a <details> at the very bottom of the page. A Menu opens
            // downward, which is what a ribbon can do and a footer cannot.
            <Menu
              label={`${warnings.length} note${warnings.length === 1 ? '' : 's'}`}
              width="w-80"
              align="right"
              triggerClassName={RIBBON_BTN}
              triggerLabel={`${warnings.length} note${warnings.length === 1 ? '' : 's'} about this snapshot`}
            >
              {() => (
                <div className="px-2 py-1.5">
                  <p className={`mb-1 text-xs font-medium ${MUTED}`}>About this snapshot</p>
                  <ul className={`list-disc space-y-1 pl-4 text-xs ${MUTED}`}>
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Menu>
          )}

          <button
            type="button"
            className={RIBBON_BTN}
            onClick={onToggleTheme}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <FilterChip label="Needs you" value={counts.needsYou} active={filter === 'needs_you'} urgent onClick={() => onFilter(filter === 'needs_you' ? 'tracked' : 'needs_you')} />
        <FilterChip label="Live" value={counts.live} active={filter === 'live'} onClick={() => onFilter(filter === 'live' ? 'tracked' : 'live')} />
        <FilterChip label="Interviewing" value={counts.interviewing} active={filter === 'interviewing'} onClick={() => onFilter(filter === 'interviewing' ? 'tracked' : 'interviewing')} />
        <FilterChip label="Tracked" value={counts.tracked} active={filter === 'tracked'} onClick={() => onFilter('tracked')} />

        <span aria-hidden="true" className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-700" />

        <button
          type="button"
          className={RIBBON_BTN}
          onClick={onToggleClosed}
          aria-pressed={showClosed}
        >
          {showClosed ? 'Hide' : 'Show'} closed ({closedCount})
        </button>
        <button
          type="button"
          className={RIBBON_BTN}
          onClick={onToggleFiltered}
          aria-pressed={showFiltered}
        >
          {showFiltered ? 'Hide' : 'Show'} filtered mail ({filteredCount})
        </button>
      </div>
    </div>
  );
}

/**
 * A KPI tile turned into a filter. Keeps the value, the uppercase label and
 * the amber-when-nonzero treatment the tiles had; adds `aria-pressed` because
 * it is now a toggle rather than a readout.
 */
function FilterChip({
  label,
  value,
  active,
  urgent,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  urgent?: boolean;
  onClick: () => void;
}) {
  const alarming = urgent && value > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Filter by ${label}: ${value}`}
      className={`flex items-baseline gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition ${
        active
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
          : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      <span
        className={`text-sm font-semibold tabular-nums ${
          active ? '' : alarming ? 'text-amber-600 dark:text-amber-400' : ''
        }`}
      >
        {value}
      </span>
      <span className="uppercase tracking-wide">{label}</span>
    </button>
  );
}

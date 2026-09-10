'use client';

import { Menu } from '@/components/ui';
import { relativeTime } from '@/lib/jobs/labels';
import type { ChipCounts, ChipFilter } from '@/lib/jobs/board';
import {
  CHIP,
  MUTED,
  RIBBON_BTN,
  RIBBON_BTN_GHOST,
  RIBBON_BTN_PRIMARY,
  SEG_ITEM,
  SEG_OFF,
  SEG_ON,
  SEG_WRAP,
  TOGGLE,
  TOGGLE_OFF,
  TOGGLE_ON,
} from './ui';

/**
 * The top ribbon: two rows with two different jobs.
 *
 * Row one acts on the data - add, refresh, export, disconnect. Row two changes
 * what you are looking at - which filter, which lanes. Keeping those on one
 * undifferentiated row of twelve identical bordered pills is what made this
 * feel cluttered: nothing said which controls mattered, or which were
 * expensive to press.
 *
 * So row one carries three weights (primary / secondary / ghost) and row two
 * carries two patterns (a pick-one segmented control, and two independent
 * toggles). Nothing was removed - every control that was here is still here.
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
  desktop,
  sections,
  activeSection,
  onSelectSection,
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
  /** At or above `md`. Below it the rail is replaced by a Sections menu here. */
  desktop: boolean;
  sections: { id: string; label: string; badge?: string | number }[];
  activeSection: string;
  onSelectSection: (id: string) => void;
}) {
  const noteLabel = `${warnings.length} note${warnings.length === 1 ? '' : 's'}`;

  return (
    <div className="border-b border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      {/* ---- Row 1: identity, and actions on the data ---- */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 pt-2 pb-1.5">
        <h1 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Jobs Forge
        </h1>

        {generatedAt !== null && (
          <span
            className={`${CHIP} ${
              stale
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
            }`}
            title={stale ? `More than ${staleHours} hours old.` : undefined}
          >
            {stale && <span aria-hidden="true">· </span>}
            updated {relativeTime(generatedAt, now)}
          </span>
        )}

        {!desktop && (
          <Menu
            label="Sections"
            width="w-56"
            triggerClassName={RIBBON_BTN_GHOST}
            triggerLabel={`Sections. Currently ${
              sections.find((x) => x.id === activeSection)?.label ?? ''
            }`}
          >
            {(close) => (
              <div>
                {sections.map((sec) => (
                  <MenuChoice
                    key={sec.id}
                    label={sec.label}
                    badge={sec.badge}
                    checked={sec.id === activeSection}
                    onClick={() => {
                      onSelectSection(sec.id);
                      close();
                    }}
                  />
                ))}
              </div>
            )}
          </Menu>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* The one control here that creates something, so the only filled one. */}
          <button
            type="button"
            className={RIBBON_BTN_PRIMARY}
            onClick={onToggleAdd}
            aria-expanded={addOpen}
            aria-controls="add-application-strip"
          >
            {addOpen ? 'Close' : '+ Add application'}
          </button>

          {/* Direct on desktop; below md these live in the File menu instead,
              so row one stays two lines rather than three. Rendering both
              would put two controls named "Refresh" on the same screen. */}
          {desktop && canRefresh && (
            <button type="button" className={RIBBON_BTN} onClick={onRefresh} disabled={busy}>
              {busy ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          {canGrant && (
            <button type="button" className={RIBBON_BTN} onClick={onGrant} disabled={busy}>
              Reconnect file
            </button>
          )}

          {/* Warnings stay visible rather than folding into the menu: hiding a
              data-quality signal behind a click is the wrong trade. */}
          {warnings.length > 0 && (
            <Menu
              label={
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-500" />
                  {noteLabel}
                </span>
              }
              width="w-80"
              align="right"
              triggerClassName={RIBBON_BTN_GHOST}
              triggerLabel={`${noteLabel} about this snapshot`}
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

          {/* Rare and semi-destructive: one click away, not one glance away. */}
          <Menu
            label="File"
            width="w-52"
            align="right"
            triggerClassName={RIBBON_BTN_GHOST}
            triggerLabel="File actions"
          >
            {(close) => (
              <div>
                {!desktop && canRefresh && (
                  <MenuAction
                    label={busy ? 'Refreshing…' : 'Refresh'}
                    disabled={busy}
                    onClick={() => {
                      onRefresh();
                      close();
                    }}
                  />
                )}
                <MenuAction
                  label="Export CSV"
                  disabled={!canExportCsv}
                  onClick={() => {
                    onExportCsv();
                    close();
                  }}
                />
                <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
                <MenuAction
                  label="Disconnect file"
                  destructive
                  onClick={() => {
                    onDisconnect();
                    close();
                  }}
                />
              </div>
            )}
          </Menu>

          <button
            type="button"
            className={RIBBON_BTN_GHOST}
            onClick={onToggleTheme}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {/* ---- Row 2: what you are looking at ---- */}
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain px-3 pb-2 md:flex-wrap md:overflow-x-visible">
        <div role="group" aria-label="Filter applications" className={`${SEG_WRAP} shrink-0`}>
          <Segment label="Needs you" value={counts.needsYou} urgent active={filter === 'needs_you'} onClick={() => onFilter('needs_you')} />
          <Segment label="Live" value={counts.live} active={filter === 'live'} onClick={() => onFilter('live')} />
          <Segment label="Interviewing" value={counts.interviewing} active={filter === 'interviewing'} onClick={() => onFilter('interviewing')} />
          <Segment label="Tracked" value={counts.tracked} active={filter === 'tracked'} onClick={() => onFilter('tracked')} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <LaneToggle label="Closed" count={closedCount} on={showClosed} onClick={onToggleClosed} />
          <LaneToggle label="Filtered mail" count={filteredCount} on={showFiltered} onClick={onToggleFiltered} />
        </div>
      </div>
    </div>
  );
}

/**
 * One option in the pick-one filter group.
 *
 * `aria-pressed` rather than a radio: these are still toggles that happen to
 * be mutually exclusive, and pressing the active one is a no-op rather than an
 * error. The accessible name states what the control does, because "5 Needs
 * you" read aloud is not a sentence.
 */
function Segment({
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
      className={`${SEG_ITEM} ${active ? SEG_ON : SEG_OFF}`}
    >
      <span
        className={`text-xs font-semibold tabular-nums ${
          alarming && !active ? 'text-amber-600 dark:text-amber-400' : ''
        }`}
      >
        {value}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/**
 * An independent lane toggle.
 *
 * The label no longer flips between "Show" and "Hide": `aria-pressed` and the
 * tick already carry the state, and a label that changes under you is harder
 * to hit twice in a row than one that does not.
 */
function LaneToggle({
  label,
  count,
  on,
  onClick,
}: {
  label: string;
  count: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={`${on ? 'Hide' : 'Show'} ${label} (${count})`}
      className={`${TOGGLE} ${on ? TOGGLE_ON : TOGGLE_OFF}`}
    >
      <span
        aria-hidden="true"
        className={`grid size-3.5 shrink-0 place-items-center rounded-[3px] border text-[9px] leading-none ${
          on
            ? 'border-neutral-500 bg-neutral-500 text-white dark:border-neutral-300 dark:bg-neutral-300 dark:text-neutral-900'
            : 'border-neutral-400 dark:border-neutral-500'
        }`}
      >
        {on ? '✓' : ''}
      </span>
      <span className="whitespace-nowrap">
        {label} <span className="tabular-nums opacity-80">({count})</span>
      </span>
    </button>
  );
}

function MenuAction({
  label,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center rounded px-2 py-1.5 text-left text-sm transition disabled:opacity-50 ${
        destructive
          ? 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50'
          : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700'
      }`}
    >
      {label}
    </button>
  );
}

function MenuChoice({
  label,
  badge,
  checked,
  onClick,
}: {
  label: string;
  badge?: string | number;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
        checked
          ? 'font-medium text-neutral-900 dark:text-neutral-100'
          : 'text-neutral-600 dark:text-neutral-300'
      }`}
    >
      <span aria-hidden="true" className="w-3 text-xs">
        {checked ? '✓' : ''}
      </span>
      <span>{label}</span>
      {badge !== undefined && badge !== '' && (
        <span className="ml-auto rounded-full bg-neutral-200 px-1.5 text-[10px] tabular-nums dark:bg-neutral-700">
          {badge}
        </span>
      )}
    </button>
  );
}

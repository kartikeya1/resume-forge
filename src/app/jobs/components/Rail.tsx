'use client';

import { useEffect, useRef, useState } from 'react';
import type { RailPanel } from '@/lib/jobs/boardStore';
import { MUTED, RAIL_ITEM, RAIL_ITEM_ACTIVE, RAIL_ITEM_IDLE } from './ui';

export interface RailSection {
  id: RailPanel;
  label: string;
  /**
   * Two characters shown when the rail is collapsed. Deliberately monograms
   * rather than icons: no icon library is installed, and the obvious Unicode
   * substitutes render as colour emoji on some platforms, which looks like a
   * bug rather than a design.
   */
  mono: string;
  /** A count or "(custom)" marker, preserved from the old panel buttons. */
  badge?: string | number;
}

/**
 * The left rail: the four panels plus the board, as a vertical tab list.
 *
 * Activation is manual (Enter or Space), not on arrow. Arrow-to-activate is
 * the usual default for a tablist, but arrowing past "Publish for phone"
 * would open a passphrase form, and past "Gmail sync" would build a label
 * diff - neither is something to do by accident while looking for Analytics.
 */
export function Rail({
  sections,
  active,
  onSelect,
  open,
  onToggleOpen,
}: {
  sections: RailSection[];
  active: RailPanel;
  onSelect: (id: RailPanel) => void;
  open: boolean;
  onToggleOpen: () => void;
}) {
  // Roving tabindex: the tab list is one stop in the page's Tab order, and
  // arrows move within it.
  const [focusIdx, setFocusIdx] = useState(() => Math.max(0, sections.findIndex((s) => s.id === active)));
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shouldFocus = useRef(false);

  useEffect(() => {
    if (shouldFocus.current) {
      refs.current[focusIdx]?.focus();
      shouldFocus.current = false;
    }
  }, [focusIdx]);

  const move = (delta: number) => {
    shouldFocus.current = true;
    setFocusIdx((i) => (i + delta + sections.length) % sections.length);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        shouldFocus.current = true;
        setFocusIdx(0);
        break;
      case 'End':
        e.preventDefault();
        shouldFocus.current = true;
        setFocusIdx(sections.length - 1);
        break;
    }
  };

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 py-2 transition-[width] print:hidden dark:border-neutral-700 dark:bg-neutral-900 ${
        open ? 'w-52' : 'w-12'
      }`}
    >
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Sections"
        onKeyDown={onKeyDown}
        className="flex flex-col gap-0.5 px-1.5"
      >
        {sections.map((sec, i) => {
          const selected = sec.id === active;
          return (
            <button
              key={sec.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`rail-panel-${sec.id}`}
              tabIndex={i === focusIdx ? 0 : -1}
              onFocus={() => setFocusIdx(i)}
              onClick={() => onSelect(sec.id)}
              aria-label={sec.badge !== undefined && sec.badge !== '' ? `${sec.label}, ${sec.badge}` : sec.label}
              title={open ? undefined : sec.label}
              className={`${RAIL_ITEM} ${selected ? RAIL_ITEM_ACTIVE : RAIL_ITEM_IDLE} ${
                open ? '' : 'justify-center px-0'
              }`}
            >
              <span
                aria-hidden="true"
                className="w-5 shrink-0 text-center text-[11px] font-semibold tabular-nums opacity-70"
              >
                {sec.mono}
              </span>
              {open && <span className="truncate">{sec.label}</span>}
              {open && sec.badge !== undefined && sec.badge !== '' && (
                <span className="ml-auto rounded-full bg-neutral-200 px-1.5 text-[10px] tabular-nums dark:bg-neutral-700">
                  {sec.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        className={`mt-auto mx-1.5 rounded-md px-2 py-1.5 text-left text-xs transition ${RAIL_ITEM_IDLE} ${MUTED} ${
          open ? '' : 'text-center'
        }`}
      >
        <span aria-hidden="true">{open ? '«' : '»'}</span>
        {open && <span aria-hidden="true" className="ml-1.5">Collapse</span>}
      </button>
    </aside>
  );
}

'use client';

import type { RailPanel as RailPanelId } from '@/lib/jobs/boardStore';
import { BTN } from './ui';

/**
 * The frame a rail section renders inside: a heading, a way back to the
 * board, and its own scroll.
 *
 * A rail section REPLACES the board rather than sliding over it. Every one of
 * these needs width - the Gmail diff is a table, Analytics has two breakdown
 * tables, Thresholds has seven labelled rows - and a drawer over a board that
 * is already thirteen lanes wide leaves nothing usable underneath. It is also
 * why none of this is a portal: dark mode here is a class on the page root,
 * so anything mounted to document.body would come out light.
 */
export function RailPanel({
  id,
  title,
  onBack,
  children,
}: {
  id: RailPanelId;
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`rail-panel-${id}`}
      role="tabpanel"
      aria-label={title}
      tabIndex={0}
      className="min-h-0 min-w-0 overflow-auto px-3 py-3"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h2>
          <button type="button" className={BTN} onClick={onBack}>
            Back to board
          </button>
        </div>
        {children}
      </div>
    </section>
  );
}

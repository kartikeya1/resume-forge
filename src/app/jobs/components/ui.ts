// Shared Tailwind class strings for the Jobs Forge dashboard.
//
// These lived in two odd places before the board rebuild: the card/text
// classes in parts.tsx (a component file) and the button classes in
// ConnectPanel.tsx (a *panel* file that seven unrelated components had to
// import from). Neither is where you would look for them. This module is
// plain .ts with no JSX so anything can import it without pulling a
// component tree along.

export const CARD =
  'rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800';
export const TEXT = 'text-neutral-700 dark:text-neutral-200';
export const MUTED = 'text-neutral-500 dark:text-neutral-400';
export const CHIP = 'rounded-full px-2 py-0.5 text-[11px] font-medium';

export const BTN =
  'inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800';
export const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300';

/** The <select> styling that EditPanel and ManualAddForm both carried verbatim. */
export const SELECT_CLASS =
  'w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400';

// ---- Board chrome ---------------------------------------------------------

/** A smaller button for the ribbon, where vertical space is tight. */
export const RIBBON_BTN =
  'inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800';

/** A populated swim lane. Width is fixed so lanes stay scannable while scrolling. */
export const LANE =
  'flex w-[300px] shrink-0 snap-start flex-col rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800';

/**
 * An empty lane: narrower and dashed, so it reads as "nothing here" without
 * disappearing. Deliberately NOT opacity-based - opacity drags the count text
 * below 4.5:1 contrast and no colour choice can recover it.
 */
export const LANE_EMPTY =
  'flex w-[152px] shrink-0 snap-start flex-col rounded-lg border border-dashed border-neutral-300 bg-transparent dark:border-neutral-700';

/** A collapsed lane: a vertical spine holding just its label and count. */
export const LANE_COLLAPSED =
  'flex w-11 shrink-0 snap-start flex-col items-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900';

export const RAIL_ITEM =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition';
export const RAIL_ITEM_ACTIVE =
  'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100';
export const RAIL_ITEM_IDLE =
  'text-neutral-600 hover:bg-neutral-200/60 dark:text-neutral-300 dark:hover:bg-neutral-800';

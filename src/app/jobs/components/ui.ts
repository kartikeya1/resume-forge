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

/**
 * A lane count. Deliberately darker than MUTED: a count is information, not
 * decoration, and an empty lane sits on the page background rather than on a
 * white card, which costs about 0.4 of a contrast ratio. Measured - MUTED on
 * the page ground came out at 4.35:1, just under the 4.5:1 bar, while the
 * same token on a card passed at 4.74:1. This clears both.
 */
export const COUNT = 'text-neutral-600 dark:text-neutral-300';

export const BTN =
  'inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800';
export const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300';

/** The <select> styling that EditPanel and ManualAddForm both carried verbatim. */
export const SELECT_CLASS =
  'w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400';

// ---- Board chrome ---------------------------------------------------------

// ---- Ribbon: three weights, not one ---------------------------------------
//
// The ribbon had twelve controls and every one of them was a bordered
// transparent pill, so "Disconnect file" carried exactly as much visual weight
// as "Refresh" and as a filter chip. That sameness is what made it read as
// clutter rather than as a toolbar. These three levels say how often a control
// is wanted and how much it costs to press.

/** Level 2 - frequent, but not the point of the page. Refresh, Reconnect. */
export const RIBBON_BTN =
  'inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800';

/** Level 1 - the one control here that creates something. */
export const RIBBON_BTN_PRIMARY =
  'inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300';

/** Level 3 - rare, or destructive, or merely informational. Borderless. */
export const RIBBON_BTN_GHOST =
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800';

// ---- Segmented control ----------------------------------------------------
//
// The four KPI filters are mutually exclusive - exactly one is ever active.
// Four separate bordered pills say "four independent toggles", which is a lie
// about how they behave, and it is why they were indistinguishable from the
// closed/filtered toggles sitting next to them. A segmented control says
// "pick one".

export const SEG_WRAP =
  'inline-flex items-center gap-0.5 rounded-lg border border-neutral-300 bg-neutral-100 p-0.5 dark:border-neutral-700 dark:bg-neutral-800';
export const SEG_ITEM =
  'flex items-baseline gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition';
export const SEG_ON =
  'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100';
export const SEG_OFF =
  'text-neutral-600 hover:bg-white/70 dark:text-neutral-300 dark:hover:bg-neutral-950/60';

/**
 * A genuinely independent on/off - the closed and filtered-mail lanes.
 *
 * Deliberately shaped unlike SEG_*: these two are not part of the pick-one
 * group, and rendering them the same way was most of the confusion.
 */
export const TOGGLE =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition';
export const TOGGLE_ON =
  'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100';
export const TOGGLE_OFF =
  'text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800';

/** A populated swim lane. Width is fixed so lanes stay scannable while scrolling. */
export const LANE =
  'flex w-[300px] shrink-0 snap-start flex-col rounded-lg border border-neutral-200 bg-white print:w-full print:break-inside-avoid dark:border-neutral-700 dark:bg-neutral-800';

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

'use client';

import { useSyncExternalStore } from 'react';

/**
 * A media query as an external store, read the same way this repo reads its
 * other external state (see jobs/useNow.ts and useMounted.ts).
 *
 * On the hydration question: this is safe *because* it is only ever read below
 * `useMounted`'s guard. JobsDashboard renders "Loading Jobs Forge..." until
 * mounted, so the server output and the first client render agree, and by the
 * time any consumer of this hook renders, `window.matchMedia` is available and
 * authoritative. The server snapshot below is therefore never the value
 * anything paints with.
 *
 * Chosen over the CSS-only approach of rendering both layouts and hiding one
 * with `hidden md:flex`. That would have kept two full copies of a
 * thirteen-lane board in the DOM, and duplicated every hardcoded id across
 * them - `rail-panel-board` twice in one document is invalid, and
 * `aria-controls` would then point at whichever one the browser found first.
 * One tree is worth the trade.
 */
function makeQuery(query: string) {
  let mql: MediaQueryList | null = null;
  const get = () => {
    if (typeof window === 'undefined') return false;
    mql ??= window.matchMedia(query);
    return mql.matches;
  };
  return {
    subscribe(fn: () => void): () => void {
      if (typeof window === 'undefined') return () => {};
      mql ??= window.matchMedia(query);
      mql.addEventListener('change', fn);
      return () => mql?.removeEventListener('change', fn);
    },
    get,
  };
}

// Cached per query string, so every caller of the same breakpoint shares one
// MediaQueryList and one listener rather than allocating per component.
const stores = new Map<string, ReturnType<typeof makeQuery>>();

function storeFor(query: string) {
  let s = stores.get(query);
  if (!s) {
    s = makeQuery(query);
    stores.set(query, s);
  }
  return s;
}

export function useMediaQuery(query: string): boolean {
  const store = storeFor(query);
  return useSyncExternalStore(
    store.subscribe,
    store.get,
    () => false // server: nothing renders before mount, so this is never painted
  );
}

/** Tailwind's `md` breakpoint. Below this the board becomes a single stacked lane. */
export const MD = '(min-width: 48rem)';

/** True at or above Tailwind's `md`. */
export function useIsDesktop(): boolean {
  return useMediaQuery(MD);
}

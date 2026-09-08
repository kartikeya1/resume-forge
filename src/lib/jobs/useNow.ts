'use client';

import { useSyncExternalStore } from 'react';

// A ticking clock is an external store, so it is read the same way this repo
// reads its other external state (see ../useTheme.ts). Calling Date.now()
// during render is impure - React may re-render at any time, and relative
// timestamps would drift unpredictably between renders of the same commit.
//
// One shared interval for every subscriber, and a one-minute tick: this drives
// "updated 3 days ago" and the staleness banner, neither of which needs to be
// more precise than that.

const TICK_MS = 60_000;

let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (!timer) {
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Stable within a render pass, updated once a minute. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 0 // server snapshot; the dashboard renders nothing until mounted
  );
}

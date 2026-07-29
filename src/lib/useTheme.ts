'use client';

import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'resume-forge:theme';
export type Theme = 'light' | 'dark';

function readStored(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    // Storage can be unavailable (private mode, blocked context).
    return 'light';
  }
}

// Subscribers are notified on toggle, and on `storage` events so the theme
// stays in step across tabs of the same app.
const listeners = new Set<() => void>();

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

// Persisted light/dark preference. The `dark` class is applied to the app root
// (see page.tsx), not <html>, so the toggle is fully client-side.
//
// useSyncExternalStore rather than useState + useEffect: the value lives in
// localStorage (an external store), and reading it in an effect meant a
// second render pass and a flash of the wrong theme on load.
export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(
    subscribe,
    readStored,
    () => 'light' as Theme // server snapshot
  );

  const toggle = useCallback(() => {
    const next: Theme = readStored() === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Preference simply will not persist; the in-session toggle still works.
    }
    listeners.forEach((fn) => fn());
  }, []);

  return { theme, toggle };
}

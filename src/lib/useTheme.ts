'use client';

import { useEffect, useState } from 'react';

const KEY = 'resume-forge:theme';
export type Theme = 'light' | 'dark';

// Persisted light/dark preference. The `dark` class is applied to the app root
// (see page.tsx), not <html>, so the toggle is fully client-side.
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) as Theme | null;
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  const toggle = () =>
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore storage errors */
      }
      return next;
    });

  return { theme, toggle };
}

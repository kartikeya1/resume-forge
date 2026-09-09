// Persisted user thresholds. Separate store from overridesStore because these
// are global preferences rather than per-application corrections, and mixing
// them would mean a settings tweak invalidates the overrides blob.
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createGuardedStorage } from '../storage';
import { coerceSettings, DEFAULT_SETTINGS, type JobsSettings } from './settings';

interface SettingsState {
  settings: JobsSettings;
  setSetting: (key: keyof JobsSettings, value: number) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      // Coerced on every write, not just on load: the input is a number field
      // the user types into, and an out-of-range value would otherwise feed
      // straight into a date comparison.
      setSetting: (key, value) =>
        set({ settings: coerceSettings({ ...get().settings, [key]: value }) }),
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'jobs-forge:settings:v1',
      version: 1,
      storage: createJSONStorage(() =>
        createGuardedStorage(() => (typeof window === 'undefined' ? undefined : window.localStorage))
      ),
      // A hand-edited or older persisted blob is repaired rather than trusted.
      merge: (persisted, current) => ({
        ...current,
        settings: coerceSettings((persisted as { settings?: unknown } | undefined)?.settings),
      }),
    }
  )
);

// Persisted *view* state for the board: which rail section is open, which
// lanes are collapsed, whether the closed and filtered lanes are showing.
//
// A third store alongside overridesStore (data) and settingsStore (settings),
// following the split those two already established - one store per concern,
// so a lane collapse never invalidates the overrides blob.
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createGuardedStorage } from '../storage';

/** The rail's sections. `board` is the default and shows the lanes. */
export type RailPanel = 'board' | 'analytics' | 'thresholds' | 'publish' | 'gmail';

export const RAIL_PANELS: RailPanel[] = ['board', 'analytics', 'thresholds', 'publish', 'gmail'];

interface BoardState {
  railOpen: boolean;
  railPanel: RailPanel;
  /**
   * Lane ids the user has collapsed. A plain array rather than a Set because
   * the persisted blob is JSON, and a Set round-trips to `{}`.
   */
  collapsedLanes: string[];
  showClosed: boolean;
  showFiltered: boolean;

  toggleRail: () => void;
  setRailPanel: (p: RailPanel) => void;
  toggleLane: (id: string) => void;
  setShowClosed: (v: boolean) => void;
  setShowFiltered: (v: boolean) => void;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      railOpen: true,
      railPanel: 'board',
      collapsedLanes: [],
      showClosed: false,
      showFiltered: false,

      toggleRail: () => set({ railOpen: !get().railOpen }),
      setRailPanel: (railPanel) => set({ railPanel }),
      toggleLane: (id) => {
        const cur = get().collapsedLanes;
        set({ collapsedLanes: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      },
      setShowClosed: (showClosed) => set({ showClosed }),
      setShowFiltered: (showFiltered) => set({ showFiltered }),
    }),
    {
      name: 'jobs-forge:board:v1',
      version: 1,
      storage: createJSONStorage(() =>
        createGuardedStorage(() => (typeof window === 'undefined' ? undefined : window.localStorage))
      ),
      // railPanel is deliberately NOT persisted. Landing on the Publish
      // passphrase form or a Gmail diff after a reload is wrong - the board is
      // the home state, and every other section is somewhere you go on
      // purpose.
      partialize: (s) => ({
        railOpen: s.railOpen,
        collapsedLanes: s.collapsedLanes,
        showClosed: s.showClosed,
        showFiltered: s.showFiltered,
      }),
      // A hand-edited or stale blob is repaired rather than trusted, matching
      // settingsStore. An unknown lane id is harmless - ids are only read
      // through `includes` - but a non-array would throw on first render.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        return {
          ...current,
          railOpen: asBool(p.railOpen, current.railOpen),
          collapsedLanes: Array.isArray(p.collapsedLanes)
            ? p.collapsedLanes.filter((x): x is string => typeof x === 'string')
            : [],
          showClosed: asBool(p.showClosed, false),
          showFiltered: asBool(p.showFiltered, false),
        };
      },
    }
  )
);

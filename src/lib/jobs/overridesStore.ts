// Persisted store for user corrections: rename, merge/split, status, archive,
// notes, and manual entries.
//
// Kept entirely separate from the resume library's Zustand store (../store.ts)
// - different domain, different lifecycle, and this repo already treats
// per-feature state as its own store rather than one shared blob.
//
// This DOES go through localStorage (unlike the snapshot itself, which lives
// in IndexedDB - see handleStore.ts): overrides are small, hand-typed edits,
// not a 90-day mail dump, so they fit the quota the resume library already
// shares this key space with. createGuardedStorage is reused so a full quota
// degrades the same way it does everywhere else in the app - a warning, not a
// silent data loss.
'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createGuardedStorage } from '../storage';
import {
  addManual, clearField, dismissReview, mergeThreads, removeManual, renameCompany,
  renameRole, resetThread, setArchived, setField, setNotes, setStatus, splitThreads,
  undismissReview, updateManual,
} from './overrides';
import type { FieldOverride, JobStatus, UserOverrides } from './types';
import { emptyOverrides } from './types';

interface OverridesState {
  overrides: UserOverrides;

  mergeThreads: (threadIds: string[]) => void;
  splitThreads: (threadIds: string[]) => void;
  resetThread: (threadId: string) => void;

  setField: (appId: string, patch: FieldOverride) => void;
  clearField: (appId: string) => void;
  setStatus: (appId: string, status: JobStatus) => void;
  setArchived: (appId: string, archived: boolean) => void;
  setNotes: (appId: string, notes: string) => void;
  renameCompany: (appId: string, company: string) => void;
  renameRole: (appId: string, role: string) => void;

  addManual: (input: { company: string; role?: string; status: JobStatus; notes?: string }) => string;
  updateManual: (id: string, patch: Parameters<typeof updateManual>[2]) => void;
  removeManual: (id: string) => void;

  dismissReview: (threadId: string) => void;
  undismissReview: (threadId: string) => void;

  /** After a fresh snapshot changes an application's id - see reconcileOverrides. */
  replaceOverrides: (next: UserOverrides) => void;
}

export const useOverridesStore = create<OverridesState>()(
  persist(
    (set, get) => ({
      overrides: emptyOverrides(),

      mergeThreads: (ids) => set({ overrides: mergeThreads(get().overrides, ids) }),
      splitThreads: (ids) => set({ overrides: splitThreads(get().overrides, ids) }),
      resetThread: (id) => set({ overrides: resetThread(get().overrides, id) }),

      setField: (appId, patch) => set({ overrides: setField(get().overrides, appId, patch) }),
      clearField: (appId) => set({ overrides: clearField(get().overrides, appId) }),
      setStatus: (appId, status) => set({ overrides: setStatus(get().overrides, appId, status) }),
      setArchived: (appId, archived) => set({ overrides: setArchived(get().overrides, appId, archived) }),
      setNotes: (appId, notes) => set({ overrides: setNotes(get().overrides, appId, notes) }),
      renameCompany: (appId, company) => set({ overrides: renameCompany(get().overrides, appId, company) }),
      renameRole: (appId, role) => set({ overrides: renameRole(get().overrides, appId, role) }),

      addManual: (input) => {
        const { overrides, id } = addManual(get().overrides, input, Date.now());
        set({ overrides });
        return id;
      },
      updateManual: (id, patch) => set({ overrides: updateManual(get().overrides, id, patch) }),
      removeManual: (id) => set({ overrides: removeManual(get().overrides, id) }),

      dismissReview: (threadId) => set({ overrides: dismissReview(get().overrides, threadId) }),
      undismissReview: (threadId) => set({ overrides: undismissReview(get().overrides, threadId) }),

      replaceOverrides: (next) => set({ overrides: next }),
    }),
    {
      name: 'jobs-forge:overrides:v1',
      version: 1,
      storage: createJSONStorage(() =>
        createGuardedStorage(() => (typeof window === 'undefined' ? undefined : window.localStorage))
      ),
    }
  )
);

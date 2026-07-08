import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Resume } from './types';
import { emptyResume, sampleResume } from './sampleData';
import { newId } from './ids';

// ---- Library model (local, no backend) -------------------------------------

export type AppStatus = 'draft' | 'applied' | 'interview' | 'offer' | 'rejected';

export const STATUS_LABELS: Record<AppStatus, string> = {
  draft: 'Draft',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
};

export interface ResumeVersion {
  id: string;
  label: string;
  at: number;
  resume: Resume;
  jobDescription: string;
}

export interface LibraryEntry {
  id: string;
  name: string;
  status: AppStatus;
  isMaster: boolean;
  resume: Resume;
  jobDescription: string;
  versions: ResumeVersion[];
  createdAt: number;
  updatedAt: number;
}

function makeEntry(name: string, resume: Resume, jobDescription: string): LibraryEntry {
  const t = Date.now();
  return {
    id: newId(),
    name,
    status: 'draft',
    isMaster: false,
    resume,
    jobDescription,
    versions: [],
    createdAt: t,
    updatedAt: t,
  };
}

const MAX_VERSIONS = 30;

interface ResumeState {
  // Live working copy = the active document.
  resume: Resume;
  jobDescription: string;
  hasContent: boolean;
  // Library of all documents (the active one is kept in sync here).
  activeId: string;
  library: LibraryEntry[];

  // editing (act on the active document)
  update: (recipe: (draft: Resume) => void) => void;
  setJobDescription: (jd: string) => void;

  // content sources (replace the active document)
  startFresh: () => void;
  loadSample: () => void;
  importResume: (resume: Resume) => void;
  loadSnapshot: (resume: Resume, jobDescription: string) => void;
  isEmpty: () => boolean;

  // library management
  switchDoc: (id: string) => void;
  newDoc: (name?: string, resume?: Resume, jd?: string) => void;
  duplicateActive: () => void;
  newFromMaster: () => void;
  renameDoc: (id: string, name: string) => void;
  deleteDoc: (id: string) => void;
  setStatus: (id: string, status: AppStatus) => void;
  setMaster: (id: string) => void;

  // versions (of the active document)
  saveVersion: (label?: string) => void;
  restoreVersion: (versionId: string) => void;
  deleteVersion: (versionId: string) => void;
}

// Sync a mutation of the active doc's resume/jd back into the library array.
function syncActive(
  library: LibraryEntry[],
  activeId: string,
  patch: Partial<Pick<LibraryEntry, 'resume' | 'jobDescription' | 'versions'>>
): LibraryEntry[] {
  return library.map((e) => (e.id === activeId ? { ...e, ...patch, updatedAt: Date.now() } : e));
}

const firstResume = sampleResume();
const firstEntry = makeEntry('My Resume', firstResume, '');

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      resume: firstEntry.resume,
      jobDescription: '',
      hasContent: false,
      activeId: firstEntry.id,
      library: [firstEntry],

      update: (recipe) =>
        set((s) => {
          const draft = structuredClone(s.resume);
          recipe(draft);
          return { resume: draft, library: syncActive(s.library, s.activeId, { resume: draft }) };
        }),

      setJobDescription: (jd) =>
        set((s) => ({ jobDescription: jd, library: syncActive(s.library, s.activeId, { jobDescription: jd }) })),

      startFresh: () =>
        set((s) => {
          const r = emptyResume();
          return { resume: r, hasContent: true, library: syncActive(s.library, s.activeId, { resume: r }) };
        }),

      loadSample: () =>
        set((s) => {
          const r = sampleResume();
          return { resume: r, hasContent: true, library: syncActive(s.library, s.activeId, { resume: r }) };
        }),

      importResume: (resume) =>
        set((s) => ({ resume, hasContent: true, library: syncActive(s.library, s.activeId, { resume }) })),

      loadSnapshot: (resume, jobDescription) =>
        set((s) => ({
          resume,
          jobDescription,
          hasContent: true,
          library: syncActive(s.library, s.activeId, { resume, jobDescription }),
        })),

      isEmpty: () => {
        const r = get().resume;
        return (
          !r.contact.name.trim() &&
          !r.summary.trim() &&
          r.experience.length === 0 &&
          r.projects.length === 0 &&
          !r.skills.some((sk) => sk.items.length) &&
          r.education.length === 0
        );
      },

      switchDoc: (id) =>
        set((s) => {
          const t = s.library.find((e) => e.id === id);
          if (!t) return {};
          return { activeId: id, resume: t.resume, jobDescription: t.jobDescription, hasContent: true };
        }),

      newDoc: (name, resume, jd) =>
        set((s) => {
          const entry = makeEntry(name ?? `Resume ${s.library.length + 1}`, resume ?? emptyResume(), jd ?? '');
          return {
            library: [...s.library, entry],
            activeId: entry.id,
            resume: entry.resume,
            jobDescription: entry.jobDescription,
            hasContent: true,
          };
        }),

      duplicateActive: () =>
        set((s) => {
          const cur = s.library.find((e) => e.id === s.activeId);
          if (!cur) return {};
          const entry = makeEntry(`${cur.name} copy`, structuredClone(s.resume), s.jobDescription);
          return {
            library: [...s.library, entry],
            activeId: entry.id,
            resume: entry.resume,
            jobDescription: entry.jobDescription,
            hasContent: true,
          };
        }),

      newFromMaster: () =>
        set((s) => {
          const master = s.library.find((e) => e.isMaster) ?? s.library.find((e) => e.id === s.activeId);
          if (!master) return {};
          const entry = makeEntry('Tailored resume', structuredClone(master.resume), '');
          return {
            library: [...s.library, entry],
            activeId: entry.id,
            resume: entry.resume,
            jobDescription: entry.jobDescription,
            hasContent: true,
          };
        }),

      renameDoc: (id, name) =>
        set((s) => ({ library: s.library.map((e) => (e.id === id ? { ...e, name } : e)) })),

      deleteDoc: (id) =>
        set((s) => {
          if (s.library.length <= 1) return {}; // keep at least one
          const library = s.library.filter((e) => e.id !== id);
          if (id !== s.activeId) return { library };
          const next = library[0];
          return { library, activeId: next.id, resume: next.resume, jobDescription: next.jobDescription };
        }),

      setStatus: (id, status) => set((s) => ({ library: s.library.map((e) => (e.id === id ? { ...e, status } : e)) })),

      setMaster: (id) =>
        set((s) => ({ library: s.library.map((e) => ({ ...e, isMaster: e.id === id ? !e.isMaster : false })) })),

      saveVersion: (label) =>
        set((s) => {
          const cur = s.library.find((e) => e.id === s.activeId);
          if (!cur) return {};
          const version: ResumeVersion = {
            id: newId(),
            label: label?.trim() || `Version ${cur.versions.length + 1}`,
            at: Date.now(),
            resume: structuredClone(s.resume),
            jobDescription: s.jobDescription,
          };
          const versions = [version, ...cur.versions].slice(0, MAX_VERSIONS);
          return { library: syncActive(s.library, s.activeId, { versions }) };
        }),

      restoreVersion: (versionId) =>
        set((s) => {
          const cur = s.library.find((e) => e.id === s.activeId);
          const v = cur?.versions.find((x) => x.id === versionId);
          if (!v) return {};
          const resume = structuredClone(v.resume);
          return {
            resume,
            jobDescription: v.jobDescription,
            library: syncActive(s.library, s.activeId, { resume, jobDescription: v.jobDescription }),
          };
        }),

      deleteVersion: (versionId) =>
        set((s) => {
          const cur = s.library.find((e) => e.id === s.activeId);
          if (!cur) return {};
          return { library: syncActive(s.library, s.activeId, { versions: cur.versions.filter((v) => v.id !== versionId) }) };
        }),
    }),
    {
      name: 'resume-forge:v1',
      version: 2,
      partialize: (s) => ({
        resume: s.resume,
        jobDescription: s.jobDescription,
        hasContent: s.hasContent,
        activeId: s.activeId,
        library: s.library,
      }),
      // Migrate the old single-document shape into the library model so
      // existing users don't lose their in-progress resume.
      migrate: (persisted: unknown, version: number) => {
        const p = persisted as Record<string, unknown> | null;
        if (version < 2 && p) {
          const resume = (p.resume as Resume) ?? emptyResume();
          const jd = (p.jobDescription as string) ?? '';
          const entry = makeEntry('My Resume', resume, jd);
          return {
            resume,
            jobDescription: jd,
            hasContent: (p.hasContent as boolean) ?? false,
            activeId: entry.id,
            library: [entry],
          };
        }
        return p;
      },
    }
  )
);

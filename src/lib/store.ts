import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Resume } from './types';
import { emptyResume, sampleResume } from './sampleData';

interface ResumeState {
  resume: Resume;
  jobDescription: string;
  hasContent: boolean; // false until the user starts fresh or imports
  // actions
  update: (recipe: (draft: Resume) => void) => void;
  setJobDescription: (jd: string) => void;
  startFresh: () => void;
  loadSample: () => void;
  importResume: (resume: Resume) => void;
  loadSnapshot: (resume: Resume, jobDescription: string) => void;
  isEmpty: () => boolean;
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set, get) => ({
      resume: sampleResume(),
      jobDescription: '',
      hasContent: false,
      update: (recipe) =>
        set((state) => {
          const draft = structuredClone(state.resume);
          recipe(draft);
          return { resume: draft };
        }),
      setJobDescription: (jd) => set({ jobDescription: jd }),
      startFresh: () => set({ resume: emptyResume(), hasContent: true }),
      loadSample: () => set({ resume: sampleResume(), hasContent: true }),
      importResume: (resume) => set({ resume, hasContent: true }),
      loadSnapshot: (resume, jobDescription) => set({ resume, jobDescription, hasContent: true }),
      isEmpty: () => {
        const r = get().resume;
        return (
          !r.contact.name.trim() &&
          !r.summary.trim() &&
          r.experience.length === 0 &&
          r.projects.length === 0 &&
          !r.skills.some((s) => s.items.length) &&
          r.education.length === 0
        );
      },
    }),
    {
      name: 'resume-forge:v1',
      // Only persist data, not action fns.
      partialize: (s) => ({ resume: s.resume, jobDescription: s.jobDescription, hasContent: s.hasContent }),
    }
  )
);

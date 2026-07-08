// Save / Open: serialize the full working session to a portable .resume.json
// file the user stores wherever they like, and load it back to restore state.
'use client';

import type { Resume } from './types';
import { emptyResume } from './sampleData';
import { buildFilename } from './docxExport';

const SIGNATURE = 'resumeforge';
const FORMAT_VERSION = 1;

export interface Snapshot {
  app: typeof SIGNATURE;
  version: number;
  savedAt: string; // ISO timestamp
  resume: Resume;
  jobDescription: string;
}

export function saveSnapshot(resume: Resume, jobDescription: string): void {
  const snapshot: Snapshot = {
    app: SIGNATURE,
    version: FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    resume,
    jobDescription,
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const filename = buildFilename(resume, 'resume.json');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export class InvalidSnapshotError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'InvalidSnapshotError';
  }
}

// Parse + validate an opened file, tolerating minor shape drift by merging onto
// a known-good empty resume so missing fields never crash the editor.
export async function openSnapshot(file: File): Promise<{ resume: Resume; jobDescription: string }> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new InvalidSnapshotError('This file is not valid JSON.');
  }

  const obj = raw as Partial<Snapshot>;
  if (!obj || obj.app !== SIGNATURE || typeof obj.resume !== 'object' || obj.resume === null) {
    throw new InvalidSnapshotError('This does not look like a ResumeForge save file.');
  }

  const resume = coerceResume(obj.resume as Partial<Resume>);
  const jobDescription = typeof obj.jobDescription === 'string' ? obj.jobDescription : '';
  return { resume, jobDescription };
}

function coerceResume(input: Partial<Resume>): Resume {
  const empty = emptyResume();
  return {
    ...empty,
    ...input,
    contact: { ...empty.contact, ...(input.contact ?? {}), links: input.contact?.links ?? [] },
    experience: Array.isArray(input.experience) ? input.experience : [],
    education: Array.isArray(input.education) ? input.education : [],
    skills: Array.isArray(input.skills) ? input.skills : [],
    projects: Array.isArray(input.projects) ? input.projects : [],
    certifications: Array.isArray(input.certifications) ? input.certifications : [],
    sectionOrder: Array.isArray(input.sectionOrder) && input.sectionOrder.length ? input.sectionOrder : empty.sectionOrder,
    meta: { ...empty.meta, ...(input.meta ?? {}) },
  };
}

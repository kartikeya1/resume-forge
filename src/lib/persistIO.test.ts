import { describe, it, expect } from 'vitest';
import { openSnapshot, InvalidSnapshotError } from './persistIO';
import { emptyResume, sampleResume } from './sampleData';
import type { Resume } from './types';

// openSnapshot is the only path by which foreign data enters the editor, so its
// validation is the app's trust boundary. Node 20 provides File/Blob natively.

function fileFrom(contents: unknown, name = 'test.resume.json'): File {
  const text = typeof contents === 'string' ? contents : JSON.stringify(contents);
  return new File([text], name, { type: 'application/json' });
}

function validSnapshot(resume: Resume = sampleResume(), jobDescription = 'A JD') {
  return {
    app: 'resumeforge',
    version: 1,
    savedAt: new Date('2026-01-01').toISOString(),
    resume,
    jobDescription,
  };
}

describe('openSnapshot — happy path', () => {
  it('restores the resume and job description', async () => {
    const { resume, jobDescription } = await openSnapshot(fileFrom(validSnapshot()));
    expect(jobDescription).toBe('A JD');
    expect(resume.contact.name).toBe(sampleResume().contact.name);
  });

  it('round-trips a resume without losing content', async () => {
    const original = sampleResume();
    const { resume } = await openSnapshot(fileFrom(validSnapshot(original, '')));
    expect(resume).toEqual(original);
  });

  it('defaults a missing job description to an empty string', async () => {
    const snap = validSnapshot();
    delete (snap as Record<string, unknown>).jobDescription;
    const { jobDescription } = await openSnapshot(fileFrom(snap));
    expect(jobDescription).toBe('');
  });

  it('ignores a non-string job description rather than propagating it', async () => {
    const snap = { ...validSnapshot(), jobDescription: { nope: true } };
    const { jobDescription } = await openSnapshot(fileFrom(snap));
    expect(jobDescription).toBe('');
  });
});

describe('openSnapshot — rejects foreign files', () => {
  it('rejects invalid JSON with a readable message', async () => {
    await expect(openSnapshot(fileFrom('{not json'))).rejects.toThrow(InvalidSnapshotError);
    await expect(openSnapshot(fileFrom('{not json'))).rejects.toThrow(/not valid JSON/i);
  });

  it('rejects JSON that is not a ResumeForge save file', async () => {
    await expect(openSnapshot(fileFrom({ hello: 'world' }))).rejects.toThrow(InvalidSnapshotError);
    await expect(openSnapshot(fileFrom({ hello: 'world' }))).rejects.toThrow(/ResumeForge save file/i);
  });

  it('rejects a file with the wrong app signature', async () => {
    const snap = { ...validSnapshot(), app: 'someotherapp' };
    await expect(openSnapshot(fileFrom(snap))).rejects.toThrow(InvalidSnapshotError);
  });

  it('rejects a file with a missing or null resume', async () => {
    await expect(openSnapshot(fileFrom({ app: 'resumeforge', version: 1 }))).rejects.toThrow(
      InvalidSnapshotError
    );
    await expect(
      openSnapshot(fileFrom({ app: 'resumeforge', version: 1, resume: null }))
    ).rejects.toThrow(InvalidSnapshotError);
  });

  it('rejects a top-level JSON array', async () => {
    await expect(openSnapshot(fileFrom([1, 2, 3]))).rejects.toThrow(InvalidSnapshotError);
  });

  it('rejects JSON null', async () => {
    await expect(openSnapshot(fileFrom('null'))).rejects.toThrow(InvalidSnapshotError);
  });
});

describe('openSnapshot — tolerates shape drift without crashing', () => {
  it('fills in missing sections from an empty resume', async () => {
    const partial = { contact: { name: 'Ada' } };
    const { resume } = await openSnapshot(
      fileFrom({ app: 'resumeforge', version: 1, resume: partial })
    );
    expect(resume.contact.name).toBe('Ada');
    expect(resume.experience).toEqual([]);
    expect(resume.education).toEqual([]);
    expect(resume.skills).toEqual([]);
    expect(resume.contact.links).toEqual([]);
    expect(resume.summary).toBe(emptyResume().summary);
  });

  it('coerces non-array list fields to empty arrays instead of trusting them', async () => {
    const hostile = {
      contact: { name: 'Ada' },
      experience: 'not an array',
      skills: { nope: true },
      certifications: 42,
    };
    const { resume } = await openSnapshot(
      fileFrom({ app: 'resumeforge', version: 1, resume: hostile })
    );
    expect(resume.experience).toEqual([]);
    expect(resume.skills).toEqual([]);
    expect(resume.certifications).toEqual([]);
  });

  it('falls back to the default section order when it is missing or empty', async () => {
    for (const sectionOrder of [undefined, [], 'nope']) {
      const { resume } = await openSnapshot(
        fileFrom({ app: 'resumeforge', version: 1, resume: { sectionOrder } })
      );
      expect(resume.sectionOrder).toEqual(emptyResume().sectionOrder);
    }
  });

  it('always returns a resume with every required key present', async () => {
    const { resume } = await openSnapshot(
      fileFrom({ app: 'resumeforge', version: 1, resume: {} })
    );
    for (const key of Object.keys(emptyResume())) {
      expect(resume, `missing key ${key}`).toHaveProperty(key);
    }
  });
});

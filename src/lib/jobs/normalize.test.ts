import { describe, expect, it } from 'vitest';
import {
  baseSimilar,
  companyKey,
  canonicalCompany,
  extractReqIds,
  normalizeReqId,
  parseRole,
  roleCompatible,
} from './normalize';

describe('companyKey', () => {
  // Each pair is a real merge that only happens if these keys collide.
  it.each([
    ['Rolls-Royce', 'rollsroyce'],
    ['Guidewire Software', 'guidewire'],
    ['Primetrace Technologies', 'primetrace'],
    ['HIGHLEVEL INDIA PRIVATE LIMITED', 'highlevel'],
    ['ixigo.com', 'ixigo'],
    ['civica.com', 'civica'],
    ['ThoughtFull™ World', 'thoughtfull'],
    ['GoKwik Commerce Solutions Pvt. Ltd.', 'gokwikcommerce'],
  ])('%s -> %s', (input, expected) => {
    expect(companyKey(input)).toBe(expected);
  });

  it('bridges the sender domain and the subject for Civica', () => {
    // The ONLY thing linking the human recruiter thread to the Workable threads.
    expect(companyKey('civica.com')).toBe(companyKey('Civica'));
  });

  it('strips the (tm) glyph so ThoughtFull matches across templates', () => {
    expect(companyKey('ThoughtFull™ World')).toBe(companyKey('ThoughtFull World'));
  });

  it('keeps a leading generic word that is part of the name', () => {
    expect(companyKey('Tech Mahindra')).toBe('techmahindra');
  });
});

describe('canonicalCompany', () => {
  it.each([
    ['rollsroyce', 'Rolls-Royce'],
    ['ebay', 'eBay'],
    ['facebook', 'Meta'],
    ['lyzrai', 'Lyzr AI'],
  ])('%s -> %s via the alias map', (input, expected) => {
    expect(canonicalCompany(input)).toBe(expected);
  });

  it('keeps a company whose name ends in a TLD-like word', () => {
    // companyKey strips '.dev', so "Reo.Dev" would otherwise display as "Reo".
    expect(canonicalCompany('Reo.Dev')).toBe('Reo.Dev');
  });

  it('title-cases a shouty sender name', () => {
    expect(canonicalCompany('HIGHLEVEL INDIA PRIVATE LIMITED')).toBe('HighLevel');
  });
});

describe('normalizeReqId', () => {
  it('collapses the JPMorgan case difference', () => {
    // "Job Number: 210769925" (application) vs "Job number: 210769925"
    // (rejection). These two subjects share no other words at all.
    expect(normalizeReqId('210769925')).toBe(normalizeReqId('210769925'));
    expect(normalizeReqId('jr6155469')).toBe(normalizeReqId('JR6155469'));
  });
});

describe('extractReqIds', () => {
  it('finds the Workday JR id in the assessment subject', () => {
    const ids = extractReqIds('URGENT – Complete Online Assessments for JR6155469 Product Owner (Evergreen)');
    expect(ids.map((r) => r.id)).toContain('JR6155469');
    expect(ids.find((r) => r.id === 'JR6155469')?.trust).toBe('high');
  });

  it('finds the labelled job number in both casings', () => {
    const a = extractReqIds('We received your job application (Job Number: 210769925)');
    const b = extractReqIds('Your job application status (Job number: 210769925)');
    expect(a.map((r) => r.id)).toContain('210769925');
    expect(b.map((r) => r.id)).toContain('210769925');
  });

  it('does not mistake a bare date for a requisition id', () => {
    // Without the cue-word window this manufactures merges between unrelated
    // companies that happen to share a timestamp.
    expect(extractReqIds('Interview on 20260708 at 2pm').map((r) => r.id)).not.toContain('20260708');
  });
});

describe('parseRole', () => {
  it('splits Meesho AI from Meesho Experience', () => {
    const ai = parseRole('Product Manager II - AI');
    const exp = parseRole('Product Manager II - Experience');
    expect(ai.base).toBe('product manager 2');
    expect(exp.base).toBe('product manager 2');
    expect(ai.qualifiers).toEqual(['ai']);
    expect(exp.qualifiers).toEqual(['experience']);
    expect(ai.key).not.toBe(exp.key);
  });

  it('treats (Evergreen) as noise so Rolls-Royce merges', () => {
    expect(parseRole('Product Owner (Evergreen)').key).toBe(parseRole('Product Owner').key);
  });

  it('expands SPM and keeps Polo as the discriminator', () => {
    const r = parseRole('SPM - Polo');
    expect(r.base).toBe('senior product manager');
    expect(r.qualifiers).toEqual(['polo']);
  });

  it('splits on a dash with no following space', () => {
    // "Technical Product Manager- 12 Months Contract" is verbatim from Civica.
    const a = parseRole('Technical Product Manager- 12 Months Contract');
    const b = parseRole('Technical Product Manager - 12 Months Contract');
    expect(a.base).toBe('technical product manager');
    expect(a.key).toBe(b.key);
  });
});

describe('roleCompatible', () => {
  it('refuses to merge the two Meesho roles', () => {
    expect(roleCompatible(parseRole('Product Manager II - AI'), parseRole('Product Manager II - Experience'))).toBe(false);
  });

  it('merges Product Owner with Product Owner (Evergreen)', () => {
    expect(roleCompatible(parseRole('Product Owner'), parseRole('Product Owner (Evergreen)'))).toBe(true);
  });

  it('keeps Senior Product Manager distinct from Senior Platform Product Manager', () => {
    // 0.75 Jaccard, below the 0.85 bar. Guidewire's platform role is not the
    // same job as a plain senior PM req at the same company.
    expect(baseSimilar('senior product manager', 'senior platform product manager')).toBe(false);
    expect(roleCompatible(parseRole('Senior Product Manager'), parseRole('Senior Platform Product Manager'))).toBe(false);
  });

  it('defers to the company when one side has no role', () => {
    expect(roleCompatible(null, parseRole('Product Strategy Manager'))).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  analyze,
  allBullets,
  resumeToText,
  bulletHasNumber,
  bulletStartsWeak,
  bulletStartsStrong,
} from './scoring';
import { emptyResume, sampleResume } from './sampleData';
import type { Resume } from './types';

// A deliberately "good" resume: complete contact, quantified strong bullets,
// sensible length. Used as the high-score baseline.
function strongResume(): Resume {
  return {
    ...emptyResume(),
    contact: {
      name: 'Ada Lovelace',
      title: 'Product Manager',
      email: 'ada@example.com',
      phone: '+91 98765 43210',
      location: 'Bengaluru',
      links: [{ label: 'LinkedIn', url: 'https://linkedin.com/in/ada' }],
    },
    summary:
      'Product manager with eight years building payments and broker integrations for retail investors across India and SEA.',
    experience: [
      {
        role: 'Senior Product Manager',
        company: 'Acme',
        location: 'Bengaluru',
        start: '2022',
        end: 'Present',
        bullets: [
          'Led the payments replatform that cut settlement failures by 38% across 4 brokers',
          'Launched a self-serve onboarding flow that reduced time-to-first-trade from 9 days to 2',
          'Drove an A/B testing program covering 12 experiments and $1.2M incremental revenue',
          'Scaled the partner integration surface from 3 to 11 brokers in 18 months',
        ],
      },
    ],
    education: [
      { school: 'IIT Delhi', degree: 'B.Tech Computer Science', location: 'Delhi', details: '', start: '2012', end: '2016' },
    ],
    skills: [{ name: 'Product', items: ['Roadmap', 'A/B testing', 'SQL', 'Stakeholder management'] }],
  } as Resume;
}

describe('bullet heuristics', () => {
  it('detects measurable numbers', () => {
    expect(bulletHasNumber('Cut churn by 38%')).toBe(true);
    expect(bulletHasNumber('Generated $1.2M in new revenue')).toBe(true);
    expect(bulletHasNumber('Scaled to 11 brokers')).toBe(true);
    expect(bulletHasNumber('Improved the onboarding experience')).toBe(false);
  });

  it('detects weak openers', () => {
    expect(bulletStartsWeak('Responsible for the roadmap')).toBe(true);
    expect(bulletStartsWeak('Worked on payments')).toBe(true);
    expect(bulletStartsWeak('Helped the team ship')).toBe(true);
    expect(bulletStartsWeak('Led the payments replatform')).toBe(false);
  });

  it('detects strong action verbs, ignoring case and punctuation', () => {
    expect(bulletStartsStrong('Led the replatform')).toBe(true);
    expect(bulletStartsStrong('launched a new flow')).toBe(true);
    expect(bulletStartsStrong('Responsible for delivery')).toBe(false);
  });

  it('treats a weak opener as not-strong (they are mutually exclusive in practice)', () => {
    const weak = 'Worked on the payments replatform';
    expect(bulletStartsWeak(weak)).toBe(true);
    expect(bulletStartsStrong(weak)).toBe(false);
  });
});

describe('text extraction', () => {
  it('collects bullets from both experience and projects, dropping blanks', () => {
    const r: Resume = {
      ...emptyResume(),
      experience: [
        { role: '', company: '', location: '', start: '', end: '', bullets: ['One', '   ', 'Two'] },
      ],
      projects: [{ name: 'Side', link: '', bullets: ['Three', ''] }],
    } as Resume;
    expect(allBullets(r)).toEqual(['One', 'Two', 'Three']);
  });

  it('includes contact, summary, skills and certs in the searchable text', () => {
    const text = resumeToText(strongResume());
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('payments replatform');
    expect(text).toContain('Stakeholder management');
  });
});

describe('analyze - score bounds and invariants', () => {
  it('keeps every score within 0-100', () => {
    for (const r of [emptyResume(), sampleResume(), strongResume()]) {
      const a = analyze(r, 'We need a product manager with SQL and A/B testing experience.');
      expect(a.atsScore).toBeGreaterThanOrEqual(0);
      expect(a.atsScore).toBeLessThanOrEqual(100);
      for (const b of a.breakdown) {
        expect(b.score, `${b.label} out of range`).toBeGreaterThanOrEqual(0);
        expect(b.score, `${b.label} out of range`).toBeLessThanOrEqual(100);
      }
      if (a.jdMatchScore !== null) {
        expect(a.jdMatchScore).toBeGreaterThanOrEqual(0);
        expect(a.jdMatchScore).toBeLessThanOrEqual(100);
      }
    }
  });

  it('always returns the same five breakdown rows in the same order', () => {
    const a = analyze(strongResume(), '');
    expect(a.breakdown.map((b) => b.label)).toEqual([
      'ATS Compatibility',
      'Impact',
      'Recruiter Readability',
      'Formatting',
      'Keyword Match',
    ]);
  });

  it('scores an empty resume far below a complete one', () => {
    const empty = analyze(emptyResume(), '');
    const strong = analyze(strongResume(), '');
    expect(empty.atsScore).toBeLessThan(strong.atsScore);
    expect(strong.atsScore).toBeGreaterThan(70);
  });

  it('does not crash on a completely empty resume, and reports zero impact', () => {
    const a = analyze(emptyResume(), '');
    expect(a.stats.bullets).toBe(0);
    expect(a.breakdown.find((b) => b.label === 'Impact')!.score).toBe(0);
  });
});

describe('analyze - JD behaviour', () => {
  it('returns null jdMatchScore when no JD is supplied', () => {
    expect(analyze(strongResume(), '').jdMatchScore).toBeNull();
    expect(analyze(strongResume(), '   ').jdMatchScore).toBeNull();
  });

  it('does not penalise the keyword sub-score when there is no JD', () => {
    const a = analyze(strongResume(), '');
    expect(a.breakdown.find((b) => b.label === 'Keyword Match')!.score).toBe(100);
  });

  it('scores a matching resume higher than a non-matching one against the same JD', () => {
    const jd =
      'Required: strong SQL and A/B testing. Must have experience with stakeholder management and roadmap ownership.';
    const matching = analyze(strongResume(), jd);
    const nonMatching = analyze(
      { ...strongResume(), skills: [{ name: 'Other', items: ['Woodworking'] }] } as Resume,
      jd
    );
    expect(matching.jdMatchScore!).toBeGreaterThan(nonMatching.jdMatchScore!);
  });

  it('emits a JD actionable for each missing non-optional keyword, and none for present ones', () => {
    const jd = 'Required: Kubernetes. Must have Terraform.';
    const a = analyze(strongResume(), jd);
    const jdActionables = a.actionables.filter((x) => x.source === 'jd');
    expect(jdActionables.length).toBeGreaterThan(0);
    // Every JD actionable refers to a keyword that is genuinely absent.
    for (const item of jdActionables) {
      const kw = a.keywords.find((k) => `jd-${k.canonical}` === item.id);
      expect(kw, `no keyword for actionable ${item.id}`).toBeDefined();
      expect(kw!.present).toBe(false);
      expect(kw!.tier).not.toBe('optional');
    }
  });

  it('marks coverage tallies as [present, total] with present never exceeding total', () => {
    const a = analyze(strongResume(), 'Required: SQL. Preferred: Kubernetes. Roadmap and roadmap again.');
    for (const tier of ['critical', 'important', 'optional'] as const) {
      const [present, total] = a.coverage[tier];
      expect(present).toBeLessThanOrEqual(total);
      expect(present).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('analyze - actionables reflect resume state', () => {
  it('marks contact actionables done on a complete resume', () => {
    const a = analyze(strongResume(), '');
    const byId = Object.fromEntries(a.actionables.map((x) => [x.id, x.done]));
    expect(byId['email']).toBe(true);
    expect(byId['phone']).toBe(true);
    expect(byId['links']).toBe(true);
    expect(byId['summary']).toBe(true);
    expect(byId['experience']).toBe(true);
    expect(byId['skills']).toBe(true);
    expect(byId['education']).toBe(true);
  });

  it('marks them undone on an empty resume', () => {
    const a = analyze(emptyResume(), '');
    expect(a.actionables.filter((x) => x.source === 'ats').every((x) => !x.done)).toBe(true);
  });

  it('flags weak verbs only when a weak bullet exists', () => {
    const clean = analyze(strongResume(), '');
    expect(clean.actionables.find((x) => x.id === 'weak-verbs')!.done).toBe(true);

    const withWeak = strongResume();
    withWeak.experience[0].bullets.push('Responsible for the quarterly roadmap');
    const dirty = analyze(withWeak, '');
    expect(dirty.actionables.find((x) => x.id === 'weak-verbs')!.done).toBe(false);
    expect(dirty.stats.weakBullets).toBe(1);
  });

  it('rejects a phone number that is too short to be real', () => {
    const r = strongResume();
    r.contact.phone = '123';
    expect(analyze(r, '').actionables.find((x) => x.id === 'phone')!.done).toBe(false);
  });

  it('rejects a malformed email', () => {
    const r = strongResume();
    r.contact.email = 'not-an-email';
    expect(analyze(r, '').actionables.find((x) => x.id === 'email')!.done).toBe(false);
  });
});

describe('analyze - determinism', () => {
  it('produces identical output for identical input', () => {
    const jd = 'Required: SQL, roadmap, A/B testing.';
    expect(analyze(strongResume(), jd)).toEqual(analyze(strongResume(), jd));
  });

  it('holds the built-in samples stable (golden guard against silent score drift)', () => {
    // Not asserting exact numbers - those are allowed to change deliberately.
    // Asserting the sample is a *healthy* resume, which it must stay, or the
    // "Load sample" affordance starts teaching users the wrong thing.
    const a = analyze(sampleResume(), '');
    expect(a.atsScore).toBeGreaterThan(60);
    expect(a.stats.bullets).toBeGreaterThan(3);
  });
});

import { describe, it, expect } from 'vitest';
import { checkBullet, firstWord, deepAnalyze } from './analysis';
import { emptyResume, sampleResume } from './sampleData';
import type { Resume } from './types';

function resumeWithBullets(bullets: string[]): Resume {
  return {
    ...emptyResume(),
    contact: { ...emptyResume().contact, name: 'Ada', email: 'ada@example.com' },
    experience: [
      { role: 'PM', company: 'Acme', location: '', start: '2022', end: 'Present', bullets },
    ],
  } as Resume;
}

describe('firstWord', () => {
  it('lowercases and strips punctuation', () => {
    expect(firstWord('  Led, the team')).toBe('led');
    expect(firstWord('"Built" it')).toBe('built');
  });

  it('returns an empty string for empty input', () => {
    expect(firstWord('   ')).toBe('');
  });
});

describe('checkBullet — ratings', () => {
  it('rates a strong verb + number + active voice as strong', () => {
    const c = checkBullet('Led the replatform, cutting settlement failures by 38%');
    expect(c.rating).toBe('strong');
    expect(c.hasNumber).toBe(true);
    expect(c.strongVerb).toBe(true);
    expect(c.passive).toBe(false);
  });

  it('rates a weak opener as weak regardless of numbers', () => {
    const c = checkBullet('Responsible for reducing churn by 38%');
    expect(c.weakStart).toBe(true);
    expect(c.rating).toBe('weak');
  });

  it('rates a bullet with neither a strong verb nor a number as weak', () => {
    expect(checkBullet('Various tasks around the product area').rating).toBe('weak');
  });

  it('rates a very short bullet as weak', () => {
    const c = checkBullet('Did stuff');
    expect(c.rating).toBe('weak');
    expect(c.reasons).toContain('Too short to convey impact.');
  });

  it('rates a strong verb without a number as ok, not strong', () => {
    expect(checkBullet('Led the payments replatform across four brokers').rating).toBe('ok');
  });

  it('detects passive voice and demotes an otherwise strong bullet', () => {
    const c = checkBullet('Revenue was increased by 20% through the new flow');
    expect(c.passive).toBe(true);
    expect(c.rating).not.toBe('strong');
  });

  it('counts words and flags overly long bullets', () => {
    const long = `Led ${'word '.repeat(40)}by 10%`;
    const c = checkBullet(long);
    expect(c.words).toBeGreaterThan(32);
    expect(c.reasons).toContain('Long bullet — tighten toward a single line.');
  });

  it('always returns one of the three ratings', () => {
    for (const text of [
      'Led growth by 10%',
      'Responsible for things',
      'Various tasks',
      'x',
      '',
      'Built the thing',
    ]) {
      expect(['strong', 'ok', 'weak']).toContain(checkBullet(text).rating);
    }
  });

  it('gives a reason for every non-strong bullet', () => {
    for (const text of ['Responsible for things', 'Various tasks around product', 'Did stuff']) {
      expect(checkBullet(text).reasons.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    const text = 'Led the replatform, cutting failures by 38%';
    expect(checkBullet(text)).toEqual(checkBullet(text));
  });
});

describe('deepAnalyze — analytics', () => {
  it('counts bullets and quantified bullets', () => {
    const d = deepAnalyze(resumeWithBullets(['Led growth by 10%', 'Built the tool']), '');
    expect(d.analytics.bullets).toBe(2);
    expect(d.analytics.bulletsWithNumbers).toBe(1);
  });

  it('reports the longest bullet length', () => {
    const d = deepAnalyze(
      resumeWithBullets(['Short one here now', 'Led a much longer bullet that runs on for a while indeed']),
      ''
    );
    expect(d.analytics.longestBulletWords).toBeGreaterThan(d.analytics.avgBulletWords);
  });

  it('produces non-negative analytics on an empty resume without dividing by zero', () => {
    const d = deepAnalyze(emptyResume(), '');
    expect(d.analytics.bullets).toBe(0);
    for (const [key, value] of Object.entries(d.analytics)) {
      expect(Number.isFinite(value), `${key} is not finite`).toBe(true);
      expect(value, `${key} is negative`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('deepAnalyze — flagged bullets and repetition', () => {
  it('flags problem bullets but not strong ones', () => {
    const d = deepAnalyze(
      resumeWithBullets([
        'Led the replatform, cutting failures by 38%',
        'Responsible for the roadmap',
      ]),
      ''
    );
    const flaggedText = d.flagged.map((f) => f.text);
    expect(flaggedText).toContain('Responsible for the roadmap');
    expect(flaggedText).not.toContain('Led the replatform, cutting failures by 38%');
  });

  it('detects a repeated opening verb', () => {
    const d = deepAnalyze(
      resumeWithBullets([
        'Led the replatform by 10%',
        'Led the onboarding rework by 20%',
        'Led the migration by 30%',
      ]),
      ''
    );
    const led = d.repetitions.find((r) => r.verb === 'led');
    expect(led).toBeDefined();
    expect(led!.count).toBe(3);
  });

  it('does not report repetition when verbs vary', () => {
    const d = deepAnalyze(
      resumeWithBullets(['Led growth by 10%', 'Built the tool for 5 teams', 'Reduced cost by 8%']),
      ''
    );
    expect(d.repetitions.every((r) => r.count < 2)).toBe(true);
  });
});

describe('deepAnalyze — structure checks', () => {
  it('reports missing sections on an empty resume', () => {
    const d = deepAnalyze(emptyResume(), '');
    expect(d.structure.missingSections.length).toBeGreaterThan(0);
  });

  it('reports no missing sections on the built-in sample', () => {
    const d = deepAnalyze(sampleResume(), '');
    expect(d.structure.missingSections).toEqual([]);
  });

  it('returns balance figures that are finite and non-negative', () => {
    const d = deepAnalyze(sampleResume(), '');
    for (const [key, value] of Object.entries(d.structure.balance)) {
      expect(Number.isFinite(value), `${key} not finite`).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('deepAnalyze — JD breakdown', () => {
  it('is null when no JD is supplied', () => {
    expect(deepAnalyze(sampleResume(), '').jd).toBeNull();
    expect(deepAnalyze(sampleResume(), '   ').jd).toBeNull();
  });

  it('splits technical from soft skills', () => {
    const d = deepAnalyze(
      sampleResume(),
      'Required: Kubernetes and SQL. Strong leadership and stakeholder management needed.'
    );
    expect(d.jd).not.toBeNull();
    const soft = d.jd!.soft.map((k) => k.canonical);
    const technical = d.jd!.technical.map((k) => k.canonical);
    expect(soft.some((s) => s === 'leadership' || s === 'stakeholder management')).toBe(true);
    expect(technical).not.toContain('leadership');
  });

  it('lists only genuinely missing terms in the skill gap', () => {
    const d = deepAnalyze(resumeWithBullets(['Led growth by 10%']), 'Required: Kubernetes.');
    expect(d.jd!.skillGap.length).toBeGreaterThan(0);
    const allKeywords = [...d.jd!.technical, ...d.jd!.soft];
    for (const gap of d.jd!.skillGap) {
      const match = allKeywords.find((k) => k.term === gap || k.canonical === gap);
      if (match) expect(match.present).toBe(false);
    }
  });

  it('partitions every keyword into exactly one of technical or soft', () => {
    const d = deepAnalyze(
      sampleResume(),
      'Required: Kubernetes, SQL, leadership, communication, roadmap, roadmap.'
    );
    const technical = new Set(d.jd!.technical.map((k) => k.canonical));
    const soft = new Set(d.jd!.soft.map((k) => k.canonical));
    for (const c of technical) expect(soft.has(c)).toBe(false);
  });

  it('is deterministic', () => {
    const jd = 'Required: Kubernetes and SQL. Leadership matters.';
    expect(deepAnalyze(sampleResume(), jd)).toEqual(deepAnalyze(sampleResume(), jd));
  });
});

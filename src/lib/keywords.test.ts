import { describe, it, expect } from 'vitest';
import { extractKeywords, keywordPresent, normalizeToken, SYNONYMS, type Keyword } from './keywords';

const kw = (canonical: string, term = canonical, tier: Keyword['tier'] = 'important'): Keyword => ({
  canonical,
  term,
  tier,
  count: 1,
});

describe('normalizeToken', () => {
  it('folds aliases onto their canonical form', () => {
    expect(normalizeToken('js')).toBe('javascript');
    expect(normalizeToken('TS')).toBe('typescript');
    expect(normalizeToken('k8s')).toBe('kubernetes');
    expect(normalizeToken('ml')).toBe('machine learning');
  });

  it('lowercases and passes through unknown tokens unchanged', () => {
    expect(normalizeToken('Rust')).toBe('rust');
    expect(normalizeToken('woodworking')).toBe('woodworking');
  });

  it('maps every declared alias back to its canonical key', () => {
    for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
      for (const alias of aliases) {
        expect(normalizeToken(alias), `${alias} should fold to ${canonical}`).toBe(canonical);
      }
    }
  });
});

describe('extractKeywords', () => {
  it('returns nothing for an empty or whitespace JD', () => {
    expect(extractKeywords('')).toEqual([]);
    expect(extractKeywords('   \n  ')).toEqual([]);
  });

  it('picks up known multi-word skills as single keywords', () => {
    const found = extractKeywords('You will own the go-to-market plan and run A/B testing.');
    const canonicals = found.map((k) => k.canonical);
    expect(canonicals).toContain('go-to-market');
    expect(canonicals).toContain('a/b testing');
  });

  it('drops stopwords and pure numbers', () => {
    const found = extractKeywords(
      'The ideal candidate will have 5 years of experience and the ability to work with the team. Kubernetes Kubernetes.'
    );
    const canonicals = found.map((k) => k.canonical);
    expect(canonicals).not.toContain('the');
    expect(canonicals).not.toContain('candidate');
    expect(canonicals).not.toContain('5');
    expect(canonicals).toContain('kubernetes');
  });

  it('ignores one-off noise words but keeps repeated terms', () => {
    const found = extractKeywords('Rust appears once. Elixir Elixir appears twice.');
    const canonicals = found.map((k) => k.canonical);
    expect(canonicals).toContain('elixir');
    expect(canonicals).not.toContain('rust');
  });

  it('keeps a known skill even on a single mention', () => {
    const found = extractKeywords('Some familiarity with Kubernetes is useful.');
    expect(found.map((k) => k.canonical)).toContain('kubernetes');
  });

  it('infers critical tier from requirement cues', () => {
    const found = extractKeywords('Required: deep Kubernetes expertise.');
    expect(found.find((k) => k.canonical === 'kubernetes')?.tier).toBe('critical');
  });

  it('infers optional tier from nice-to-have cues', () => {
    const found = extractKeywords('Nice to have: some Kubernetes exposure.');
    expect(found.find((k) => k.canonical === 'kubernetes')?.tier).toBe('optional');
  });

  it('defaults to important when there is no cue', () => {
    const found = extractKeywords('You will use Kubernetes daily.');
    expect(found.find((k) => k.canonical === 'kubernetes')?.tier).toBe('important');
  });

  it('sorts critical first, then important, then optional', () => {
    const found = extractKeywords(
      'Required: SQL. You will use Kubernetes daily. Nice to have: familiarity with Terraform Terraform.'
    );
    const rank = { critical: 0, important: 1, optional: 2 } as const;
    const ranks = found.map((k) => rank[k.tier]);
    expect([...ranks]).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('respects the limit argument', () => {
    const jd = Array.from({ length: 60 }, (_, i) => `term${i} term${i}`).join(' ');
    expect(extractKeywords(jd, 5)).toHaveLength(5);
    expect(extractKeywords(jd).length).toBeLessThanOrEqual(24);
  });

  it('never returns duplicate canonicals', () => {
    const found = extractKeywords(
      'We use JS and JavaScript and ecmascript throughout. JS JS JavaScript ecmascript.'
    );
    const canonicals = found.map((k) => k.canonical);
    expect(new Set(canonicals).size).toBe(canonicals.length);
  });

  it('is deterministic', () => {
    const jd = 'Required: SQL and Kubernetes. Preferred: Terraform Terraform.';
    expect(extractKeywords(jd)).toEqual(extractKeywords(jd));
  });
});

describe('keywordPresent', () => {
  it('matches the canonical term', () => {
    expect(keywordPresent(kw('kubernetes'), 'deployed to kubernetes clusters')).toBe(true);
  });

  it('matches via a synonym, so an alias in the resume satisfies the JD term', () => {
    expect(keywordPresent(kw('kubernetes'), 'ran workloads on k8s')).toBe(true);
    expect(keywordPresent(kw('machine learning'), 'shipped an llm-backed feature')).toBe(true);
    expect(keywordPresent(kw('javascript'), 'wrote js for the frontend')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(keywordPresent(kw('kubernetes'), 'MIGRATED TO KUBERNETES')).toBe(true);
  });

  it('respects word boundaries so substrings do not false-positive', () => {
    // "go" must not match inside "going" / "algorithm".
    expect(keywordPresent(kw('go'), 'algorithms and going forward')).toBe(false);
  });

  it('tolerates punctuation around skills', () => {
    expect(keywordPresent(kw('sql'), 'skills: sql, python, excel')).toBe(true);
    expect(keywordPresent(kw('ci/cd'), 'owned the ci/cd pipeline')).toBe(true);
  });

  it('returns false when the term is genuinely absent', () => {
    expect(keywordPresent(kw('kubernetes'), 'built spreadsheets and decks')).toBe(false);
  });

  it('also matches on the display term when it differs from the canonical', () => {
    expect(keywordPresent(kw('machine learning', 'nlp'), 'worked on nlp pipelines')).toBe(true);
  });
});

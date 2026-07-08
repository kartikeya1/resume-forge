// Deterministic keyword engine (no LLM). Extracts meaningful keywords from a
// job description and checks whether each is present in the resume, using a
// curated skill dictionary + light synonym map so "ML" matches "machine
// learning", "AI", etc.

export type KeywordTier = 'critical' | 'important' | 'optional';

export interface Keyword {
  term: string; // display form
  canonical: string; // normalized key used for matching
  tier: KeywordTier;
  count: number; // occurrences in the JD
}

const STOPWORDS = new Set(
  `a an and or the of to in on at for with by from as is are be been being this that these those you your our we they it its their will shall can may
  role position job candidate ideal preferred required responsibilities requirements qualifications experience years year work working team teams company
  including etc such about into over under across per via using use used also more most than then them who whom which what when where why how all any some
  strong ability able help helping helped ensure ensuring build building built develop developing developed drive driving driven support supporting new good
  great excellent plus nice must should would could have has had do does did not no yes if but so up out down off if while during within without both each
  other others up down high low well like within across around`
    .split(/\s+/)
    .filter(Boolean)
);

// Canonical skill/concept -> aliases. Matching folds all aliases to the
// canonical term, so a resume that says "LLMs" satisfies a JD asking for "AI".
export const SYNONYMS: Record<string, string[]> = {
  javascript: ['js', 'ecmascript'],
  typescript: ['ts'],
  'machine learning': ['ml', 'ai', 'artificial intelligence', 'deep learning', 'neural networks', 'nlp', 'llm', 'llms', 'predictive models'],
  react: ['reactjs', 'react.js'],
  node: ['nodejs', 'node.js'],
  postgres: ['postgresql', 'psql'],
  kubernetes: ['k8s'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous delivery', 'continuous deployment'],
  'a/b testing': ['ab testing', 'split testing', 'experimentation'],
  'go-to-market': ['gtm', 'go to market'],
  'stakeholder management': ['stakeholder', 'stakeholders', 'cross-functional', 'cross functional'],
  roadmap: ['roadmapping', 'product roadmap'],
  okrs: ['okr', 'objectives and key results'],
  'user research': ['user interviews', 'customer research', 'customer insights'],
  sql: ['mysql', 'sqlite'],
  'rest': ['rest api', 'restful', 'apis', 'api'],
  aws: ['amazon web services'],
  gcp: ['google cloud', 'google cloud platform'],
  'data-driven': ['data driven', 'metrics-driven', 'metrics driven'],
  leadership: ['led', 'leading', 'mentored', 'managed'],
};

// Multi-word skills we want to catch as single keywords even if frequency-based
// extraction would miss them.
const KNOWN_MULTIWORD = Object.keys(SYNONYMS).filter((k) => k.includes(' ') || k.includes('/') || k.includes('-'));

// Build reverse alias -> canonical lookup.
const ALIAS_TO_CANONICAL: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
  ALIAS_TO_CANONICAL[canonical] = canonical;
  for (const a of aliases) ALIAS_TO_CANONICAL[a.toLowerCase()] = canonical;
}

export function normalizeToken(t: string): string {
  const lower = t.toLowerCase();
  return ALIAS_TO_CANONICAL[lower] ?? lower;
}

// Which requirement tier a keyword falls into, inferred from nearby cue words
// in the JD. Falls back to "important".
function tierFromContext(jdLower: string, term: string): KeywordTier {
  const idx = jdLower.indexOf(term.toLowerCase());
  if (idx === -1) return 'important';
  const windowStart = Math.max(0, idx - 120);
  const context = jdLower.slice(windowStart, idx + term.length + 40);
  if (/(require|must have|must-have|essential|need to|proficien|expert)/.test(context)) return 'critical';
  if (/(nice to have|nice-to-have|bonus|preferred|a plus|plus if|optional|familiar)/.test(context)) return 'optional';
  return 'important';
}

// Extract the top keywords from a job description.
export function extractKeywords(jd: string, limit = 24): Keyword[] {
  if (!jd.trim()) return [];
  const lower = jd.toLowerCase();

  const counts: Record<string, { display: string; count: number }> = {};

  const bump = (canonical: string, display: string, by = 1) => {
    if (!counts[canonical]) counts[canonical] = { display, count: 0 };
    counts[canonical].count += by;
  };

  // 1) Catch known multi-word skills first.
  for (const phrase of KNOWN_MULTIWORD) {
    const re = new RegExp(escapeRegex(phrase), 'gi');
    const m = lower.match(re);
    if (m) bump(phrase, phrase, m.length);
  }

  // 2) Single tokens (nouns-ish), skipping stopwords and short tokens.
  const tokens = lower
    .replace(/[^a-z0-9+#./\-\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const raw of tokens) {
    const tok = raw.replace(/^[-./]+|[-./]+$/g, '');
    if (tok.length < 3) continue;
    if (STOPWORDS.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    const canonical = normalizeToken(tok);
    // If this token already contributed via a multiword phrase, still count it —
    // it reinforces the canonical concept.
    bump(canonical, canonical.length <= tok.length ? canonical : tok);
  }

  const keywords: Keyword[] = Object.entries(counts)
    .map(([canonical, { display, count }]) => ({
      canonical,
      term: display,
      count,
      tier: tierFromContext(lower, display),
    }))
    // A single mention of a stray common word is noise; require either a known
    // skill or 2+ mentions.
    .filter((k) => k.count >= 2 || k.canonical in SYNONYMS)
    .sort((a, b) => {
      const tierRank = { critical: 0, important: 1, optional: 2 };
      if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
      return b.count - a.count;
    })
    .slice(0, limit);

  return keywords;
}

// Is a keyword (or any of its aliases) present in the resume text?
export function keywordPresent(keyword: Keyword, resumeTextLower: string): boolean {
  const forms = new Set<string>([keyword.canonical]);
  const aliases = SYNONYMS[keyword.canonical];
  if (aliases) aliases.forEach((a) => forms.add(a.toLowerCase()));
  forms.add(keyword.term.toLowerCase());

  for (const form of forms) {
    if (containsPhrase(resumeTextLower, form)) return true;
  }
  return false;
}

function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  // Word-boundary-ish match that tolerates the punctuation common in skills.
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`, 'i');
  return re.test(haystack);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

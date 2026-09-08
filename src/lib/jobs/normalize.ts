// Normalization: turning messy real-world strings into keys that can be compared.
//
// Every merge and every split in the pipeline ultimately rests on the three
// functions here, so each carries the real mailbox case that motivated it.

// ---- Companies -------------------------------------------------------------

/** Display-name fixes that no algorithm would get right. */
export const COMPANY_ALIASES: Record<string, string> = {
  rollsroyce: 'Rolls-Royce',
  ebay: 'eBay',
  mastercard: 'Mastercard',
  facebook: 'Meta',
  metacareers: 'Meta',
  recruitingfacebook: 'Meta',
  lyzrai: 'Lyzr AI',
  jpmc: 'JPMorganChase',
  jpmorganchase: 'JPMorganChase',
  jpmorgan: 'JPMorganChase',
  gokwik: 'GoKwik',
  thoughtfull: 'ThoughtFull World',
  fairmoney: 'FairMoney',
  ixigo: 'ixigo',
  asapp: 'ASAPP',
  swiggy: 'Swiggy',
  guidewire: 'Guidewire Software',
  reodev: 'Reo.Dev',
  // companyKey strips '.dev' as a TLD, so 'Reo.Dev' keys to 'reo'.
  reo: 'Reo.Dev',
  tekion: 'Tekion',
  toptal: 'Toptal',
  civica: 'Civica',
  revolut: 'Revolut',
  meesho: 'Meesho',
  paytm: 'Paytm',
  niyo: 'Niyo',
  blitz: 'Blitz',
  weave: 'Weave',
  primetrace: 'Primetrace Technologies',
  hupo: 'Hupo',
  sleek: 'Sleek',
  kora: 'Kora',
  ajaib: 'Ajaib',
  checkmate: 'Checkmate',
  fam: 'Fam',
  highlevel: 'HighLevel',
};

// Legal, geographic and generic-industry suffixes. Stripped so a sender-derived
// key ("civica" from civica.com) meets a subject-derived one ("Civica").
const COMPANY_STOP_SUFFIXES = new Set([
  'pvt', 'private', 'limited', 'ltd', 'inc', 'llc', 'llp', 'gmbh', 'plc',
  'corp', 'corporation', 'co', 'company', 'incorporated',
  'technologies', 'technology', 'tech', 'software', 'solutions', 'systems',
  'labs', 'group', 'holdings', 'ventures', 'india', 'usa', 'global', 'world',
]);

const TLD_SUFFIXES = /\.(com|in|io|co|net|org|ai|dev|tech|me|us|uk|sg|id|xyz)(\.[a-z]{2})?$/i;

/**
 * Match key for a company. Aggressive on purpose: a false merge is visible on
 * screen and one click to split, while a false split hides an application in a
 * second row the user never notices.
 */
export function companyKey(raw: string): string {
  if (!raw) return '';
  let s = raw
    .toLowerCase()
    .replace(/[™®©]/g, '') // (tm) (r) (c) - "ThoughtFull(tm) World"
    .replace(TLD_SUFFIXES, '') // "ixigo.com" -> "ixigo"
    .replace(/&/g, ' and ')
    .trim();

  const tokens = s.split(/[^a-z0-9]+/).filter(Boolean);
  // Strip trailing generic words only - "Tech Mahindra" must keep its "tech".
  while (tokens.length > 1 && COMPANY_STOP_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  s = tokens.join('');
  return s;
}

/** Human-facing name: canonical casing via the alias map, else title-cased. */
export function canonicalCompany(raw: string): string {
  const key = companyKey(raw);
  if (COMPANY_ALIASES[key]) return COMPANY_ALIASES[key];
  const cleaned = raw.replace(/[™®©]/g, '').replace(TLD_SUFFIXES, '').trim();
  if (!cleaned) return raw.trim();
  // ALL CAPS senders ("HIGHLEVEL INDIA PRIVATE LIMITED") read badly verbatim.
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    return cleaned
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
  return cleaned;
}

// ---- Roles -----------------------------------------------------------------

const ROLE_ABBREV: Record<string, string> = {
  spm: 'senior product manager',
  pm: 'product manager',
  apm: 'associate product manager',
  tpm: 'technical product manager',
  gpm: 'group product manager',
  po: 'product owner',
  em: 'engineering manager',
  tpgm: 'technical program manager',
};

const ROLE_LEVELS: Record<string, string> = {
  ii: '2', iii: '3', iv: '4', i: '1',
  sr: 'senior', snr: 'senior', jr: 'junior',
};

/**
 * Qualifier tokens carrying no discriminating information. Dropping these is
 * what lets "Product Owner" and "Product Owner (Evergreen)" merge.
 */
const QUALIFIER_NOISE = new Set([
  'evergreen', 'contract', 'contractual', 'contractor', 'fulltime', 'full', 'time',
  'permanent', 'months', 'month', 'remote', 'hybrid', 'onsite', 'req', 'opening',
  'role', 'position', 'job', 'the', 'a', 'an', 'and', 'or', 'of', 'for', 'at', 'in',
  'india', 'us', 'uk', 'emea', 'apac', 'global', '2025', '2026', 'new',
]);

// Longest match wins, so "senior product manager" beats "product manager".
const TITLE_LEXICON = [
  'associate product manager',
  'group product manager',
  'senior platform product manager',
  'platform product manager',
  'technical product manager',
  'senior technical product manager',
  'senior product manager',
  'staff product manager',
  'principal product manager',
  'product strategy manager',
  'growth product manager',
  'product manager',
  'product owner',
  'senior product associate',
  'product associate',
  'technical program manager',
  'senior technical program manager',
  'program manager',
  'project manager',
  'engineering manager',
  'business analyst',
  'product analyst',
].sort((a, b) => b.length - a.length);

export interface ParsedRole {
  raw: string;
  /** Canonical title: "senior product manager", "product owner". */
  base: string;
  /** Sorted discriminators: ["ai"], ["experience"], ["polo"]. */
  qualifiers: string[];
  /** base + '#' + qualifiers.join('+'). */
  key: string;
}

export function parseRole(raw: string): ParsedRole {
  const norm = (raw || '')
    .toLowerCase()
    .replace(/[™®©]/g, '')
    // Split on structural punctuation. Note "Manager- 12 Months" has no space
    // after the dash, so splitting on the character (not " - ") is required.
    .replace(/[-–—/(),|:&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const expanded = norm
    .split(' ')
    .filter(Boolean)
    .map((t) => ROLE_ABBREV[t] ?? ROLE_LEVELS[t] ?? t)
    .join(' ');

  let base = '';
  let rest = expanded;
  for (const title of TITLE_LEXICON) {
    const i = expanded.indexOf(title);
    if (i !== -1) {
      base = title;
      rest = (expanded.slice(0, i) + ' ' + expanded.slice(i + title.length)).trim();
      break;
    }
  }
  if (!base) {
    base = expanded;
    rest = '';
  }

  // A bare level word left over ("2" from "Product Manager II") belongs to the
  // title, not to the qualifiers - otherwise PM II and PM III look "different
  // qualifier sets" rather than different titles.
  const restTokens = rest.split(/\s+/).filter(Boolean);
  const levelTokens = restTokens.filter((t) => /^[1-9]$/.test(t));
  if (levelTokens.length) base = `${base} ${levelTokens.join(' ')}`;

  const qualifiers = Array.from(
    new Set(
      restTokens.filter((t) => !QUALIFIER_NOISE.has(t) && !/^[1-9]$/.test(t) && t.length > 1)
    )
  ).sort();

  return { raw, base, qualifiers, key: `${base}#${qualifiers.join('+')}` };
}

function jaccard(a: string, b: string): number {
  const sa = new Set(a.split(/\s+/).filter(Boolean));
  const sb = new Set(b.split(/\s+/).filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter++;
  });
  return inter / (sa.size + sb.size - inter);
}

/** Two near-identical titles from different templates for the same req. */
export function baseSimilar(a: string, b: string): boolean {
  return jaccard(a, b) >= 0.85;
}

/**
 * Compatible == plausibly the same application.
 *
 * The load-bearing case: Meesho's "Product Manager II - AI" and
 * "Product Manager II - Experience" share a base but carry different
 * qualifiers, so they must NOT merge. Rolls-Royce's "Product Owner" and
 * "Product Owner (Evergreen)" must.
 */
export function roleCompatible(a: ParsedRole | null, b: ParsedRole | null): boolean {
  if (!a || !b) return true; // one side unknown - defer to company
  if (a.base !== b.base) return baseSimilar(a.base, b.base);
  if (a.qualifiers.length === 0 || b.qualifiers.length === 0) return true;
  return sameSet(a.qualifiers, b.qualifiers);
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function parseRoleKey(key: string): { base: string; qualifiers: string[] } {
  const [base, quals = ''] = key.split('#');
  return { base, qualifiers: quals ? quals.split('+') : [] };
}

// ---- Requisition ids -------------------------------------------------------

export interface ReqId {
  id: string;
  trust: 'high' | 'low';
}

const REQ_ID_PATTERNS: { id: string; re: RegExp; trust: 'high' | 'low' }[] = [
  // The prefix is captured, not stripped: a bare "6155469" could collide with
  // an unrelated labelled job number and manufacture a merge.
  { id: 'workday-jr', re: /\b(JR[-_\s]?\d{5,})\b/gi, trust: 'high' },
  { id: 'labelled', re: /\bJob\s*(?:Number|ID|Code|Requisition)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,})/gi, trust: 'high' },
  { id: 'req', re: /\b(REQ[-_\s]?\d{3,})\b/gi, trust: 'high' },
  { id: 'r-dash', re: /\b(R-\d{4,})\b/g, trust: 'high' },
  { id: 'bare-long', re: /\b(\d{8,10})\b/g, trust: 'low' },
];

const REQ_CUE = /job|requisition|position|application|vacancy|\bref\b/i;

/**
 * Uppercasing is what makes "Job Number: 210769925" and "Job number: 210769925"
 * collide - and that collision is the ONLY thing linking JPMorgan's
 * application to its rejection, whose subjects share no other words.
 */
export function normalizeReqId(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function extractReqIds(text: string): ReqId[] {
  const out = new Map<string, ReqId>();
  for (const p of REQ_ID_PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const captured = m[1];
      if (!captured) continue;
      if (p.trust === 'low') {
        // A bare 9-digit run is as likely a date or an amount. Require a cue
        // word nearby or it manufactures merges between unrelated companies.
        const from = Math.max(0, m.index - 40);
        const window = text.slice(from, m.index + m[0].length + 40);
        if (!REQ_CUE.test(window)) continue;
      }
      const id = normalizeReqId(captured);
      if (id.length < 4) continue;
      const prev = out.get(id);
      if (!prev || (prev.trust === 'low' && p.trust === 'high')) out.set(id, { id, trust: p.trust });
    }
  }
  return Array.from(out.values());
}

// ---- Misc ------------------------------------------------------------------

/** Strips Re:/Fwd: and collapses whitespace, for dedupe keys. */
export function normalizeSubject(s: string): string {
  return (s || '')
    .replace(/^\s*(?:re|fwd|fw)\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function senderDomain(email: string): string {
  const at = (email || '').lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase().trim();
}

export function senderLocalpart(email: string): string {
  const at = (email || '').lastIndexOf('@');
  const lp = at === -1 ? email : email.slice(0, at);
  return lp.toLowerCase().split('+')[0].trim();
}

/** host === suffix, or a true subdomain of it. Never a bare `includes`. */
export function hostMatches(host: string, suffix: string): boolean {
  if (!host || !suffix) return false;
  return host === suffix || host.endsWith('.' + suffix);
}

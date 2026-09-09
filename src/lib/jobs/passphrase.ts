// Passphrase strength, enforced rather than advised.
//
// This is the one place in Jobs Forge where being permissive is dangerous. The
// ciphertext is public and attackable offline forever, so a weak passphrase is
// not "the user's risk to take" in any meaningful sense - they would be taking
// it without understanding it. The publish button stays disabled until the
// passphrase is genuinely strong.
//
// Deliberately not a character-class checker. "P@ssw0rd!" satisfies every
// upper/lower/digit/symbol rule ever written and is in every cracking
// dictionary. What actually resists an offline attack is length and
// unpredictability, so that is what this measures.

export type PassphraseVerdict = 'too-short' | 'weak' | 'fair' | 'strong';

export interface PassphraseAssessment {
  verdict: PassphraseVerdict;
  /** Rough guessing-entropy estimate, in bits. */
  bits: number;
  /** Shown verbatim under the field. */
  message: string;
  /** The publish button is enabled only when this is true. */
  acceptable: boolean;
}

/** Below this, no amount of KDF stretching saves you. */
export const MIN_LENGTH = 16;

// These thresholds are calibrated *including* the KDF's contribution, which is
// the only honest way to read them: 600,000 PBKDF2 iterations multiplies the
// cost of every guess by ~600k, worth about 19 extra bits
// (log2(600000) ~= 19.2). So a five-word passphrase at ~68 bits of guessing
// entropy costs an attacker ~87 bits of work, which is comfortably beyond
// reach; four words at ~56 bits costs ~75, which is still a serious wall.
//
// The resulting ladder: three words is refused, four is accepted with a nudge,
// five is strong. Demanding more than that just pushes people towards writing
// it on a sticky note.
const STRONG_BITS = 60;
const FAIR_BITS = 45;

// Cheap dictionary of things people actually reach for. Not exhaustive - it
// only has to catch the obvious, because length does the real work.
const COMMON = [
  'password', 'passphrase', 'letmein', 'welcome', 'qwerty', 'iloveyou',
  'admin', 'secret', 'changeme', 'monkey', 'dragon', 'football',
  'jobsforge', 'resumeforge', 'kartikeya', 'thapliyal', 'gmail',
];

function charsetSize(s: string): number {
  let size = 0;
  if (/[a-z]/.test(s)) size += 26;
  if (/[A-Z]/.test(s)) size += 26;
  if (/[0-9]/.test(s)) size += 10;
  if (/[^a-zA-Z0-9]/.test(s)) size += 32;
  return size || 1;
}

/**
 * Word-count entropy for a passphrase, character entropy otherwise, whichever
 * is *lower* - so "correct horse battery staple" is credited as four words
 * (~44 bits) rather than 28 characters (~130 bits), which is the honest
 * estimate against a dictionary attack.
 */
function estimateBits(s: string): number {
  const charBits = s.length * Math.log2(charsetSize(s));
  const words = s.trim().split(/[\s\-_.]+/).filter((w) => w.length > 1);
  if (words.length >= 3) {
    // ~12.9 bits per word from a large word list, plus a little for casing
    // and separators.
    const wordBits = words.length * 12.9 + 4;
    return Math.min(charBits, wordBits);
  }
  return charBits;
}

function hasLowVariety(s: string): boolean {
  // "aaaaaaaaaaaaaaaaaaaa" is long and worthless.
  return new Set(s.toLowerCase()).size < Math.min(8, Math.ceil(s.length / 3));
}

function isSequential(s: string): boolean {
  const lower = s.toLowerCase();
  return /(?:abcdef|qwerty|asdfgh|123456|987654)/.test(lower);
}

export function assessPassphrase(input: string): PassphraseAssessment {
  const s = input ?? '';

  if (s.length < MIN_LENGTH) {
    return {
      verdict: 'too-short',
      bits: 0,
      message: `At least ${MIN_LENGTH} characters. Four or five unrelated words is the easiest way to get there.`,
      acceptable: false,
    };
  }

  const lower = s.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) {
    return {
      verdict: 'weak',
      bits: 0,
      message: 'Contains a word an attacker would try first. Pick something unrelated to you or this app.',
      acceptable: false,
    };
  }
  if (hasLowVariety(s) || isSequential(s)) {
    return {
      verdict: 'weak',
      bits: 0,
      message: 'Too repetitive or too predictable to resist an offline attack.',
      acceptable: false,
    };
  }

  const bits = Math.round(estimateBits(s));
  if (bits >= STRONG_BITS) {
    return {
      verdict: 'strong',
      bits,
      message: `Strong (about ${bits} bits). Save it in your password manager - losing it means re-publishing.`,
      acceptable: true,
    };
  }
  if (bits >= FAIR_BITS) {
    return {
      verdict: 'fair',
      bits,
      message: `Usable (about ${bits} bits), but one more word would make it comfortably out of reach.`,
      acceptable: true,
    };
  }
  return {
    verdict: 'weak',
    bits,
    message: `Only about ${bits} bits. This ciphertext is public, so add more words before publishing.`,
    acceptable: false,
  };
}

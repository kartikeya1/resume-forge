// Client-side encryption for the published snapshot.
//
// THREAT MODEL, stated plainly because it drives every choice below:
// the ciphertext is committed to a PUBLIC repo and served from a public URL.
// Anyone can fetch it and attack it offline, for as long as they like, on as
// much hardware as they like. There is no server to rate-limit them and no
// account to lock. The passphrase is the only thing standing between a
// stranger and his entire job search.
//
// That is why:
//   - PBKDF2-HMAC-SHA256 at 600,000 iterations (OWASP's 2023 floor), which
//     makes each guess expensive rather than free.
//   - A long passphrase is *enforced*, not suggested - see passphrase.ts. An
//     8-character password behind 600k iterations is still crackable; a
//     five-word passphrase is not.
//   - AES-256-GCM, so a wrong passphrase fails authentication cleanly instead
//     of yielding plausible garbage.
//
// Argon2id would be the better KDF, but it needs a WASM dependency and this
// repo deliberately ships none. PBKDF2 is native to WebCrypto, so it is the
// strongest option available without adding a dependency to a static site.
// Documented rather than hidden.

export const KDF_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const ENVELOPE_KIND = 'jobs-forge-encrypted';
const ENVELOPE_VERSION = 1;

export interface EncryptedEnvelope {
  kind: typeof ENVELOPE_KIND;
  version: number;
  /** When the plaintext snapshot was generated, so staleness shows pre-unlock. */
  snapshotGeneratedAt: string;
  encryptedAt: string;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    /** base64 */
    salt: string;
  };
  cipher: 'AES-GCM';
  /** base64 */
  iv: string;
  /** base64 */
  ciphertext: string;
}

export class DecryptError extends Error {
  constructor(
    msg: string,
    /** `passphrase` when the key was wrong; `format` when the file is not ours. */
    readonly kind: 'passphrase' | 'format' | 'unsupported'
  ) {
    super(msg);
    this.name = 'DecryptError';
  }
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new DecryptError(
      'This browser does not expose WebCrypto, which requires a secure context (https or localhost).',
      'unsupported'
    );
  }
  return c.subtle;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle().deriveKey(
    // BufferSource: a fresh ArrayBuffer copy keeps TS happy across lib targets.
    { name: 'PBKDF2', salt: salt.slice().buffer as ArrayBuffer, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson(
  value: unknown,
  passphrase: string,
  meta: { snapshotGeneratedAt: string; now: number }
): Promise<EncryptedEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const buf = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer },
    key,
    plaintext
  );
  return {
    kind: ENVELOPE_KIND,
    version: ENVELOPE_VERSION,
    snapshotGeneratedAt: meta.snapshotGeneratedAt,
    encryptedAt: new Date(meta.now).toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS, salt: toBase64(salt) },
    cipher: 'AES-GCM',
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(buf)),
  };
}

export function isEncryptedEnvelope(v: unknown): v is EncryptedEnvelope {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.kind === ENVELOPE_KIND && typeof o.ciphertext === 'string' && typeof o.iv === 'string';
}

export async function decryptJson(envelope: unknown, passphrase: string): Promise<unknown> {
  if (!isEncryptedEnvelope(envelope)) {
    throw new DecryptError('This file is not a Jobs Forge encrypted snapshot.', 'format');
  }
  const kdf = envelope.kdf;
  if (kdf?.name !== 'PBKDF2' || kdf.hash !== 'SHA-256' || envelope.cipher !== 'AES-GCM') {
    throw new DecryptError(
      'This snapshot uses an encryption scheme this version does not know how to read.',
      'unsupported'
    );
  }
  // The iteration count is read from the file rather than assumed, so an
  // envelope written before a future bump still opens.
  const iterations = typeof kdf.iterations === 'number' && kdf.iterations > 0
    ? kdf.iterations
    : KDF_ITERATIONS;

  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    salt = fromBase64(kdf.salt);
    iv = fromBase64(envelope.iv);
    ciphertext = fromBase64(envelope.ciphertext);
  } catch {
    throw new DecryptError('This snapshot file is corrupt.', 'format');
  }

  const key = await deriveKey(passphrase, salt, iterations);
  let buf: ArrayBuffer;
  try {
    buf = await subtle().decrypt(
      { name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer },
      key,
      ciphertext.slice().buffer as ArrayBuffer
    );
  } catch {
    // AES-GCM authenticates, so this is the only failure mode a wrong
    // passphrase can produce - it can never decrypt to plausible garbage.
    throw new DecryptError('Wrong passphrase.', 'passphrase');
  }
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new DecryptError('Decrypted, but the contents were not valid JSON.', 'format');
  }
}

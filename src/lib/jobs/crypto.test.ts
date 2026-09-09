import { describe, expect, it } from 'vitest';
import { decryptJson, DecryptError, encryptJson, isEncryptedEnvelope, KDF_ITERATIONS } from './crypto';
import { assessPassphrase, MIN_LENGTH } from './passphrase';

const PASS = 'granite otter caravan thimble ledger';
const META = { snapshotGeneratedAt: '2026-09-09T10:00:00Z', now: Date.parse('2026-09-09T11:00:00Z') };
const PAYLOAD = { kind: 'jobs-forge-snapshot', threads: [{ id: 't1', subject: 'Secret role' }] };

describe('round trip', () => {
  it('decrypts back to exactly what went in', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    expect(await decryptJson(env, PASS)).toEqual(PAYLOAD);
  });

  it('survives unicode in the payload and the passphrase', async () => {
    const payload = { company: 'ThoughtFull™ World', note: 'café — 日本語' };
    const pass = 'ünrelated wörds thimble ledger caravan';
    const env = await encryptJson(payload, pass, META);
    expect(await decryptJson(env, pass)).toEqual(payload);
  });

  it('handles a realistically large snapshot', async () => {
    const big = { threads: Array.from({ length: 400 }, (_, i) => ({ id: `t${i}`, body: 'x'.repeat(500) })) };
    const env = await encryptJson(big, PASS, META);
    expect(await decryptJson(env, PASS)).toEqual(big);
  });
});

describe('secrecy', () => {
  it('leaks no plaintext into the envelope', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    const serialised = JSON.stringify(env);
    expect(serialised).not.toContain('Secret role');
    expect(serialised).not.toContain('jobs-forge-snapshot');
  });

  it('never stores the passphrase or the derived key', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    const serialised = JSON.stringify(env);
    expect(serialised).not.toContain(PASS);
    expect(serialised).not.toContain('granite');
  });

  it('produces different ciphertext each time for identical input', async () => {
    // A fresh salt and IV per encryption. Without this, two publishes of the
    // same data would be byte-identical and reveal that nothing changed.
    const a = await encryptJson(PAYLOAD, PASS, META);
    const b = await encryptJson(PAYLOAD, PASS, META);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('pins the KDF cost at the OWASP floor', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    expect(env.kdf.iterations).toBe(KDF_ITERATIONS);
    expect(KDF_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });
});

describe('wrong passphrase', () => {
  it('fails cleanly rather than returning garbage', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    await expect(decryptJson(env, 'granite otter caravan thimble ledgeR')).rejects.toThrow(DecryptError);
  });

  it('reports the failure as a passphrase problem, not a corrupt file', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    await expect(decryptJson(env, 'completely different words here')).rejects.toMatchObject({
      kind: 'passphrase',
    });
  });

  it('rejects an empty passphrase', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    await expect(decryptJson(env, '')).rejects.toMatchObject({ kind: 'passphrase' });
  });
});

describe('tampering', () => {
  it('rejects a modified ciphertext', async () => {
    // AES-GCM authenticates, so a flipped byte is detected rather than
    // decrypting to something subtly wrong.
    const env = await encryptJson(PAYLOAD, PASS, META);
    const bytes = atob(env.ciphertext).split('');
    bytes[5] = String.fromCharCode(bytes[5].charCodeAt(0) ^ 0x40);
    await expect(decryptJson({ ...env, ciphertext: btoa(bytes.join('')) }, PASS)).rejects.toMatchObject({
      kind: 'passphrase',
    });
  });

  it('rejects a swapped IV', async () => {
    const a = await encryptJson(PAYLOAD, PASS, META);
    const b = await encryptJson(PAYLOAD, PASS, META);
    await expect(decryptJson({ ...a, iv: b.iv }, PASS)).rejects.toThrow(DecryptError);
  });

  it('rejects a swapped salt', async () => {
    const a = await encryptJson(PAYLOAD, PASS, META);
    const b = await encryptJson(PAYLOAD, PASS, META);
    await expect(
      decryptJson({ ...a, kdf: { ...a.kdf, salt: b.kdf.salt } }, PASS)
    ).rejects.toThrow(DecryptError);
  });
});

describe('malformed input', () => {
  it('rejects a foreign file as a format problem', async () => {
    await expect(decryptJson({ kind: 'jobs-forge-snapshot' }, PASS)).rejects.toMatchObject({
      kind: 'format',
    });
  });

  it('rejects an unknown cipher rather than guessing', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    await expect(decryptJson({ ...env, cipher: 'AES-CBC' }, PASS)).rejects.toMatchObject({
      kind: 'unsupported',
    });
  });

  it('rejects non-base64 payloads without crashing', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    await expect(decryptJson({ ...env, ciphertext: 'not!base64!' }, PASS)).rejects.toThrow(DecryptError);
  });

  it('identifies its own envelopes', async () => {
    expect(isEncryptedEnvelope(await encryptJson(PAYLOAD, PASS, META))).toBe(true);
    expect(isEncryptedEnvelope({ kind: 'jobs-forge-snapshot' })).toBe(false);
    expect(isEncryptedEnvelope(null)).toBe(false);
  });
});

describe('forward compatibility', () => {
  it('honours an iteration count recorded in the file', async () => {
    // So an envelope written before a future cost bump still opens.
    const env = await encryptJson(PAYLOAD, PASS, META);
    const reduced = { ...env, kdf: { ...env.kdf, iterations: 1000 } };
    // Wrong count derives a different key, which must fail rather than silently
    // fall back to the default.
    await expect(decryptJson(reduced, PASS)).rejects.toMatchObject({ kind: 'passphrase' });
  });

  it('exposes when the plaintext was generated, before unlocking', async () => {
    const env = await encryptJson(PAYLOAD, PASS, META);
    expect(env.snapshotGeneratedAt).toBe('2026-09-09T10:00:00Z');
  });
});

describe('assessPassphrase', () => {
  it('refuses anything short regardless of how clever it looks', () => {
    expect(assessPassphrase('Tr0ub4dor&3').acceptable).toBe(false);
    expect(assessPassphrase('a'.repeat(MIN_LENGTH - 1)).verdict).toBe('too-short');
  });

  it('refuses a long but repetitive string', () => {
    expect(assessPassphrase('aaaaaaaaaaaaaaaaaaaaaaaa').acceptable).toBe(false);
  });

  it('refuses a keyboard walk', () => {
    expect(assessPassphrase('qwertyuiopasdfghjkl').acceptable).toBe(false);
  });

  it('refuses something containing an obvious guess', () => {
    // Character-class rules would happily accept this.
    expect(assessPassphrase('MyPassword123456!!').acceptable).toBe(false);
    expect(assessPassphrase('kartikeya-jobs-2026-forge').acceptable).toBe(false);
  });

  it('accepts a genuine multi-word passphrase', () => {
    const a = assessPassphrase('granite otter caravan thimble ledger');
    expect(a.acceptable).toBe(true);
    expect(a.verdict).toBe('strong');
  });

  it('credits a passphrase by words, not by characters', () => {
    // Four short unrelated words must not score as ~30 characters of entropy;
    // a dictionary attack sees four choices, not thirty.
    const a = assessPassphrase('otter caravan thimble ledger');
    expect(a.bits).toBeLessThan(70);
    expect(a.bits).toBeGreaterThan(40);
  });

  it('always returns a message the UI can render', () => {
    for (const p of ['', 'short', 'a'.repeat(40), 'granite otter caravan thimble ledger']) {
      expect(assessPassphrase(p).message.length).toBeGreaterThan(10);
    }
  });
});

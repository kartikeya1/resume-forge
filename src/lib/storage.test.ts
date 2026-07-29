import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isQuotaError,
  describeFailure,
  createGuardedStorage,
  onPersistFailure,
  getPersistFailure,
  resetPersistFailure,
} from './storage';

// Minimal in-memory Storage stand-in whose setItem can be made to fail.
function fakeStorage(onSet?: () => void): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => {
      onSet?.();
      map.set(k, v);
    },
  } as Storage;
}

function quotaError(): DOMException {
  const e = new DOMException('exceeded', 'QuotaExceededError');
  return e;
}

beforeEach(() => resetPersistFailure());

describe('isQuotaError', () => {
  it('recognises the standard QuotaExceededError', () => {
    expect(isQuotaError(quotaError())).toBe(true);
  });

  it('recognises the Firefox name', () => {
    expect(isQuotaError(new DOMException('full', 'NS_ERROR_DOM_QUOTA_REACHED'))).toBe(true);
  });

  it('recognises legacy numeric codes', () => {
    const e = Object.assign(new Error('legacy'), { code: 22 });
    expect(isQuotaError(e)).toBe(true);
    const ff = Object.assign(new Error('legacy ff'), { code: 1014 });
    expect(isQuotaError(ff)).toBe(true);
  });

  it('rejects unrelated errors and non-errors', () => {
    expect(isQuotaError(new Error('something else'))).toBe(false);
    expect(isQuotaError('a string')).toBe(false);
    expect(isQuotaError(null)).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});

describe('describeFailure', () => {
  it('gives a quota-specific message that names the recovery action', () => {
    const f = describeFailure(quotaError());
    expect(f.kind).toBe('quota');
    expect(f.message).toMatch(/storage is full/i);
    expect(f.message).toMatch(/Save to file/i);
  });

  it('falls back to a generic message for other failures', () => {
    const f = describeFailure(new Error('nope'));
    expect(f.kind).toBe('unknown');
    expect(f.message).toMatch(/Save to file/i);
  });
});

describe('createGuardedStorage', () => {
  it('reads and writes through to the backing store when healthy', () => {
    const backing = fakeStorage();
    const s = createGuardedStorage(() => backing);
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
    expect(getPersistFailure()).toBeNull();
  });

  it('does not throw when the quota is exceeded', () => {
    const s = createGuardedStorage(() => fakeStorage(() => { throw quotaError(); }));
    expect(() => s.setItem('k', 'v')).not.toThrow();
  });

  it('records a quota failure so the UI can warn', () => {
    const s = createGuardedStorage(() => fakeStorage(() => { throw quotaError(); }));
    s.setItem('k', 'v');
    expect(getPersistFailure()?.kind).toBe('quota');
  });

  it('notifies subscribers exactly once for a repeated failure', () => {
    const fail = { on: true };
    const s = createGuardedStorage(() =>
      fakeStorage(() => { if (fail.on) throw quotaError(); })
    );
    const seen: Array<string | null> = [];
    onPersistFailure((f) => seen.push(f?.kind ?? null));
    // Initial replay is null, then one transition to 'quota' regardless of how
    // many failing writes follow (autosave fires on every keystroke).
    s.setItem('a', '1');
    s.setItem('b', '2');
    s.setItem('c', '3');
    expect(seen).toEqual([null, 'quota']);
  });

  it('clears the warning once a write succeeds again', () => {
    const fail = { on: true };
    const s = createGuardedStorage(() =>
      fakeStorage(() => { if (fail.on) throw quotaError(); })
    );
    s.setItem('a', '1');
    expect(getPersistFailure()?.kind).toBe('quota');
    fail.on = false; // user deleted some versions
    s.setItem('a', '1');
    expect(getPersistFailure()).toBeNull();
  });

  it('replays the current failure to a late subscriber', () => {
    const s = createGuardedStorage(() => fakeStorage(() => { throw quotaError(); }));
    s.setItem('a', '1');
    const seen: Array<string | null> = [];
    onPersistFailure((f) => seen.push(f?.kind ?? null));
    expect(seen).toEqual(['quota']);
  });

  it('treats a completely unavailable storage as empty rather than crashing', () => {
    const s = createGuardedStorage(() => {
      throw new Error('localStorage is disabled');
    });
    expect(s.getItem('k')).toBeNull();
    expect(() => s.setItem('k', 'v')).not.toThrow();
    expect(() => s.removeItem('k')).not.toThrow();
  });

  it('handles server-side rendering, where there is no storage at all', () => {
    const s = createGuardedStorage(() => undefined);
    expect(s.getItem('k')).toBeNull();
    expect(() => s.setItem('k', 'v')).not.toThrow();
  });

  it('unsubscribes cleanly', () => {
    const fn = vi.fn();
    const off = onPersistFailure(fn);
    off();
    const s = createGuardedStorage(() => fakeStorage(() => { throw quotaError(); }));
    s.setItem('a', '1');
    expect(fn).toHaveBeenCalledTimes(1); // only the initial replay
  });
});

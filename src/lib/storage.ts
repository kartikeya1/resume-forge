// Guarded localStorage for the Zustand persist middleware.
//
// The app is local-first: the browser IS the database. With a resume library
// plus up to 30 versions per resume, a heavy user can genuinely exhaust the
// ~5MB localStorage quota. Previously the write simply threw, the user saw
// nothing, and every subsequent edit was silently discarded - the worst
// possible failure for the one thing the product promises to keep safe.
//
// This wrapper never throws. It records the failure and notifies subscribers so
// the UI can tell the user to export a backup.

export type PersistFailure = {
  kind: 'quota' | 'unavailable' | 'unknown';
  message: string;
};

// A DOMException for an exceeded quota, across browsers. Firefox uses
// NS_ERROR_DOM_QUOTA_REACHED (1014); Safari's private mode historically threw
// with code 22 and an empty name.
export function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = e.name;
  const code = (e as DOMException).code;
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

export function describeFailure(e: unknown): PersistFailure {
  if (isQuotaError(e)) {
    return {
      kind: 'quota',
      message:
        'Your browser\'s storage is full, so recent changes are no longer being saved. Use File → Save to file to back up this resume, then delete old versions or resumes to free space.',
    };
  }
  return {
    kind: 'unknown',
    message:
      'Your browser refused to save this resume locally. Use File → Save to file to keep a copy - changes may be lost when you close the tab.',
  };
}

type Listener = (failure: PersistFailure | null) => void;

const listeners = new Set<Listener>();
let current: PersistFailure | null = null;

export function getPersistFailure(): PersistFailure | null {
  return current;
}

/** Subscribe to persistence failures. Returns an unsubscribe function. */
export function onPersistFailure(fn: Listener): () => void {
  listeners.add(fn);
  // Replay the current state so a late subscriber still sees an earlier failure.
  fn(current);
  return () => listeners.delete(fn);
}

function emit(failure: PersistFailure | null) {
  // Only notify on a real transition, so a repeatedly-failing write (every
  // keystroke, once the quota is hit) does not re-render the tree each time.
  const changed = (current?.kind ?? null) !== (failure?.kind ?? null);
  current = failure;
  if (changed) listeners.forEach((fn) => fn(failure));
}

/** Exposed for tests - clears the module-level failure state. */
export function resetPersistFailure() {
  current = null;
  listeners.clear();
}

// A Storage-shaped object matching what createJSONStorage expects.
export interface GuardedStorage {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
}

export function createGuardedStorage(backing: () => Storage | undefined): GuardedStorage {
  return {
    getItem: (name) => {
      try {
        return backing()?.getItem(name) ?? null;
      } catch {
        // Storage can be entirely unavailable (Safari private mode, blocked
        // third-party context). Treat it as "no saved state" rather than crash.
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        backing()?.setItem(name, value);
        emit(null); // a successful write clears any earlier warning
      } catch (e) {
        emit(describeFailure(e));
      }
    },
    removeItem: (name) => {
      try {
        backing()?.removeItem(name);
      } catch {
        // Nothing useful to do; removal failing cannot lose user data.
      }
    },
  };
}

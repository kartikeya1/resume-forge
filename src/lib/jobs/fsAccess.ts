// File System Access: the page re-reads the agent's file on every visit.
//
// The user picks ~/Downloads/jobs-forge-snapshot.json ONCE. The handle is
// persisted in IndexedDB, so later visits read the same path with no import
// step - which is the whole point of the design. The data never leaves the
// machine: nothing is committed and nothing is uploaded.
//
// Constraints that shape everything here:
//   - Secure context only. https and localhost both qualify.
//   - showOpenFilePicker needs transient user activation, so it must be called
//     synchronously from a click handler - an `await` before it loses the
//     gesture.
//   - Chrome resets read permission to 'prompt' on most page loads. Only an
//     installed PWA gets persistent permission, hence the web manifest.
//   - Firefox does not implement this at all and Safari cannot reliably persist
//     handles, so the file-input/drop fallback is not optional.
'use client';

import { clearHandle, getHandle, putHandle, type FileMeta } from './handleStore';

export type ConnectFailure = 'unsupported' | 'aborted' | 'denied' | 'not-found' | 'invalid' | 'error';

export type ConnectResult =
  | { ok: true; handle?: FileSystemFileHandle; file: File; persistable: boolean }
  | { ok: false; reason: ConnectFailure; error?: unknown };

interface PickerWindow {
  showOpenFilePicker?: (o?: unknown) => Promise<FileSystemFileHandle[]>;
}

export function isPickerSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showOpenFilePicker === 'function';
}

/** MUST be called synchronously inside a click handler. */
export async function pickSnapshotFile(): Promise<ConnectResult> {
  if (!isPickerSupported()) return { ok: false, reason: 'unsupported' };
  try {
    const picker = (window as PickerWindow).showOpenFilePicker!;
    const [handle] = await picker({
      // Chrome remembers the last directory per id, so a second pick starts
      // where the first one ended.
      id: 'jobs-forge-snapshot',
      startIn: 'downloads',
      multiple: false,
      types: [
        { description: 'Jobs Forge snapshot', accept: { 'application/json': ['.json'] } },
      ],
    });
    if (!handle) return { ok: false, reason: 'aborted' };
    const file = await handle.getFile();
    await putHandle(handle);
    // Reduces the chance the browser evicts the cached snapshot.
    void navigator.storage?.persist?.();
    return { ok: true, handle, file, persistable: true };
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return { ok: false, reason: 'aborted' };
    return { ok: false, reason: 'error', error: e };
  }
}

interface PermissionCapableHandle extends FileSystemFileHandle {
  queryPermission?: (d: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (d: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

export async function handlePermission(
  h: FileSystemFileHandle,
  opts: { request?: boolean } = {}
): Promise<PermissionState> {
  const ph = h as PermissionCapableHandle;
  if (!ph.queryPermission) return 'granted'; // no permission model - treat as usable
  let state = await ph.queryPermission({ mode: 'read' });
  if (state === 'prompt' && opts.request && ph.requestPermission) {
    state = await ph.requestPermission({ mode: 'read' });
  }
  return state;
}

/** Revisit path. Pass `{ request: true }` only from a click handler. */
export async function reconnect(opts: { request?: boolean } = {}): Promise<ConnectResult> {
  const h = await getHandle();
  if (!h) return { ok: false, reason: 'not-found' };
  const state = await handlePermission(h, opts);
  if (state !== 'granted') return { ok: false, reason: 'denied' };
  try {
    return { ok: true, handle: h, file: await h.getFile(), persistable: true };
  } catch (e) {
    if ((e as DOMException)?.name === 'NotFoundError') {
      // The agent replaced the file instead of overwriting it in place, so the
      // filesystem entry this handle pointed at is gone. JOBS-FORGE.md makes
      // in-place writes a hard rule precisely to avoid this.
      await clearHandle();
      return { ok: false, reason: 'not-found' };
    }
    return { ok: false, reason: 'error', error: e };
  }
}

// ---- Change detection (duck-typed, so it is unit-testable in node) ----------

export interface FileLike {
  lastModified: number;
  size: number;
  name: string;
  text(): Promise<string>;
}

export interface FileHandleLike {
  getFile(): Promise<FileLike>;
}

export type ReadResult =
  | { changed: false }
  | { changed: true; text: string; meta: Omit<FileMeta, 'readAt'> }
  | { error: 'not-found' | 'error' };

export async function readIfChanged(h: FileHandleLike, prev: FileMeta | null): Promise<ReadResult> {
  let file: FileLike;
  try {
    file = await h.getFile();
  } catch (e) {
    return { error: (e as DOMException)?.name === 'NotFoundError' ? 'not-found' : 'error' };
  }
  // Size is compared as well as mtime: some filesystems only store mtime to
  // second granularity, so a fast rewrite can leave it unchanged.
  if (prev && prev.lastModified === file.lastModified && prev.size === file.size) {
    return { changed: false };
  }
  try {
    return {
      changed: true,
      text: await file.text(),
      meta: { name: file.name, lastModified: file.lastModified, size: file.size },
    };
  } catch {
    return { error: 'error' };
  }
}

/**
 * Poll only while the tab is visible, plus on focus and visibility change.
 * Reading needs granted permission but NOT a fresh gesture, so this is silent.
 */
export function startPolling(
  h: FileHandleLike,
  getPrev: () => FileMeta | null,
  onChange: (r: { text: string; meta: Omit<FileMeta, 'readAt'> }) => void,
  opts: { intervalMs?: number } = {}
): () => void {
  const interval = opts.intervalMs ?? 30_000;
  let stopped = false;

  const check = async () => {
    if (stopped || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    const r = await readIfChanged(h, getPrev());
    if (!stopped && 'changed' in r && r.changed) onChange({ text: r.text, meta: r.meta });
  };

  const timer = setInterval(() => void check(), interval);
  const onFocus = () => void check();
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);

  return () => {
    stopped = true;
    clearInterval(timer);
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onFocus);
  };
}

// ---- Drop / input fallback -------------------------------------------------

interface HandleCapableItem extends DataTransferItem {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
}

/**
 * A dropped file can yield a persistable handle in Chromium, so drag-and-drop
 * is a first-class path rather than a downgrade.
 */
export async function handleFromDrop(dt: DataTransfer): Promise<ConnectResult> {
  const item = dt.items?.[0] as HandleCapableItem | undefined;
  if (item?.getAsFileSystemHandle) {
    try {
      const h = (await item.getAsFileSystemHandle()) as FileSystemFileHandle | null;
      if (h && h.kind === 'file') {
        await putHandle(h);
        return { ok: true, handle: h, file: await h.getFile(), persistable: true };
      }
    } catch {
      // Fall through to the plain File below.
    }
  }
  const file = dt.files?.[0];
  return file ? { ok: true, file, persistable: false } : { ok: false, reason: 'invalid' };
}

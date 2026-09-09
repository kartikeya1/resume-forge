// The one hook the dashboard needs: get me the snapshot, however you can.
//
// Render order matters and is deliberate:
//   1. Cached snapshot from IndexedDB renders IMMEDIATELY, with an "as of" chip.
//   2. The permission check happens in parallel and never blocks the paint.
//
// The failure this avoids is a blank screen while Chrome decides whether the
// handle is still readable. A stale dashboard clearly labelled stale is far
// more useful than an empty one.
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  handleFromDrop,
  handlePermission,
  isPickerSupported,
  pickSnapshotFile,
  readIfChanged,
  reconnect,
  startPolling,
} from './fsAccess';
import { decryptJson, DecryptError, isEncryptedEnvelope, type EncryptedEnvelope } from './crypto';
import { clearCache, clearHandle, getCache, getHandle, putCache, type FileMeta } from './handleStore';
import { InvalidSnapshotError, parseSnapshot, parseSnapshotText, type JobsSnapshot } from './snapshot';

/** Where a published encrypted snapshot is served from, if one was committed. */
const PUBLISHED_PATH = '/jobs-snapshot.enc';

/**
 * Looks for a published snapshot. Absent on most deploys, so a 404 is the
 * normal case and returns null rather than surfacing an error.
 */
async function fetchPublished(): Promise<EncryptedEnvelope | null> {
  try {
    const res = await fetch(PUBLISHED_PATH, { cache: 'no-store' });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    return isEncryptedEnvelope(raw) ? raw : null;
  } catch {
    return null;
  }
}

export type ConnectionState =
  | 'loading'
  | 'none' // nothing connected, nothing cached
  | 'cached' // rendering from cache, file not currently readable
  | 'needs-permission' // handle exists, one click away
  | 'live' // handle connected and readable
  | 'locked' // a published encrypted snapshot exists, needs a passphrase
  | 'unsupported'; // no File System Access - import only

export interface SnapshotState {
  snapshot: JobsSnapshot | null;
  meta: FileMeta | null;
  warnings: string[];
  error: string | null;
  connection: ConnectionState;
  pickerSupported: boolean;
  busy: boolean;
  /** Set when a published snapshot was found and is waiting on a passphrase. */
  envelope: EncryptedEnvelope | null;
}

const INITIAL: SnapshotState = {
  snapshot: null,
  meta: null,
  warnings: [],
  error: null,
  connection: 'loading',
  pickerSupported: false,
  busy: false,
  envelope: null,
};

export function useSnapshot() {
  const [state, setState] = useState<SnapshotState>(INITIAL);
  const metaRef = useRef<FileMeta | null>(null);
  // So `unlock` can read the envelope without depending on `state` and
  // re-creating itself on every render.
  const stateRef = useRef<SnapshotState>(INITIAL);
  stateRef.current = state;
  const stopPolling = useRef<(() => void) | null>(null);

  const accept = useCallback(async (text: string, meta: Omit<FileMeta, 'readAt'>, live: boolean) => {
    try {
      const { snapshot, warnings } = parseSnapshotText(text);
      const full: FileMeta = { ...meta, readAt: Date.now() };
      metaRef.current = full;
      await putCache({ meta: full, snapshot });
      setState((s) => ({
        ...s,
        snapshot,
        meta: full,
        warnings,
        error: null,
        connection: live ? 'live' : 'cached',
        busy: false,
      }));
      return true;
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof InvalidSnapshotError ? e.message : 'That file could not be read.',
        busy: false,
      }));
      return false;
    }
  }, []);

  const beginPolling = useCallback(
    async (handle: FileSystemFileHandle) => {
      stopPolling.current?.();
      stopPolling.current = startPolling(
        handle,
        () => metaRef.current,
        ({ text, meta }) => void accept(text, meta, true)
      );
    },
    [accept]
  );

  // Boot: paint from cache first, then find out whether the file is readable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = isPickerSupported();
      const cached = await getCache();
      if (cancelled) return;

      if (cached) {
        metaRef.current = cached.meta;
        setState((s) => ({
          ...s,
          snapshot: cached.snapshot,
          meta: cached.meta,
          connection: 'cached',
          pickerSupported: supported,
        }));
      }

      if (!supported) {
        // A phone has no File System Access at all, so a published snapshot is
        // the only way it will ever show anything.
        if (!cached) {
          const found = await fetchPublished();
          if (cancelled) return;
          if (found) {
            setState((s) => ({ ...s, pickerSupported: false, connection: 'locked', envelope: found }));
            return;
          }
        }
        setState((s) => ({
          ...s,
          pickerSupported: false,
          connection: cached ? 'cached' : 'unsupported',
        }));
        return;
      }

      const handle = await getHandle();
      if (cancelled) return;
      if (!handle) {
        // Nothing local. A published encrypted snapshot is the phone path, so
        // check for one before falling back to the connect panel.
        if (!cached) {
          const found = await fetchPublished();
          if (cancelled) return;
          if (found) {
            setState((s) => ({ ...s, pickerSupported: true, connection: 'locked', envelope: found }));
            return;
          }
        }
        setState((s) => ({ ...s, pickerSupported: true, connection: cached ? 'cached' : 'none' }));
        return;
      }

      // Query only - requesting permission here would fail without a gesture.
      const permission = await handlePermission(handle);
      if (cancelled) return;
      if (permission !== 'granted') {
        setState((s) => ({ ...s, pickerSupported: true, connection: 'needs-permission' }));
        return;
      }

      const r = await readIfChanged(handle, cached?.meta ?? null);
      if (cancelled) return;
      if ('error' in r) {
        if (r.error === 'not-found') await clearHandle();
        setState((s) => ({ ...s, connection: cached ? 'cached' : 'none' }));
        return;
      }
      if (r.changed) await accept(r.text, r.meta, true);
      else setState((s) => ({ ...s, connection: 'live' }));
      void beginPolling(handle);
    })();

    return () => {
      cancelled = true;
      stopPolling.current?.();
    };
  }, [accept, beginPolling]);

  /**
   * Decrypt a published snapshot. Deliberately does NOT cache the plaintext:
   * on a shared or borrowed device the passphrase should be required again
   * next visit rather than the data sitting in IndexedDB indefinitely.
   */
  const unlock = useCallback(async (passphrase: string) => {
    setState((s) => ({ ...s, busy: true, error: null }));
    const envelope = stateRef.current.envelope;
    if (!envelope) {
      setState((s) => ({ ...s, busy: false, error: 'Nothing published to unlock.' }));
      return;
    }
    try {
      const raw = await decryptJson(envelope, passphrase);
      const { snapshot, warnings } = parseSnapshot(raw);
      setState((s) => ({
        ...s,
        snapshot,
        warnings,
        error: null,
        busy: false,
        connection: 'live',
        envelope: null,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        busy: false,
        error:
          e instanceof DecryptError
            ? e.message
            : e instanceof InvalidSnapshotError
              ? e.message
              : 'Could not open the published snapshot.',
      }));
    }
  }, []);

  /** Must be called straight from a click handler - it needs the gesture. */
  const connect = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    const r = await pickSnapshotFile();
    if (!r.ok) {
      setState((s) => ({
        ...s,
        busy: false,
        error:
          r.reason === 'aborted'
            ? null
            : r.reason === 'unsupported'
              ? 'This browser cannot re-read a local file. Use Chrome or Edge, or import the file below.'
              : 'Could not open that file.',
      }));
      return;
    }
    const ok = await accept(
      await r.file.text(),
      { name: r.file.name, lastModified: r.file.lastModified, size: r.file.size },
      true
    );
    if (ok && r.handle) void beginPolling(r.handle);
  }, [accept, beginPolling]);

  /** The one-click path when Chrome has reset permission to 'prompt'. */
  const grant = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: null }));
    const r = await reconnect({ request: true });
    if (!r.ok) {
      setState((s) => ({
        ...s,
        busy: false,
        connection: r.reason === 'not-found' ? 'none' : s.connection,
        error: r.reason === 'denied' ? 'Permission was not granted.' : null,
      }));
      return;
    }
    const ok = await accept(
      await r.file.text(),
      { name: r.file.name, lastModified: r.file.lastModified, size: r.file.size },
      true
    );
    if (ok && r.handle) void beginPolling(r.handle);
  }, [accept, beginPolling]);

  /** Manual re-read, for when the agent has just rewritten the file. */
  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, busy: true }));
    const handle = await getHandle();
    if (!handle) {
      setState((s) => ({ ...s, busy: false }));
      return;
    }
    const r = await readIfChanged(handle, null); // force a re-read
    if ('error' in r) {
      setState((s) => ({ ...s, busy: false, error: 'Could not re-read the file.' }));
      return;
    }
    if (r.changed) await accept(r.text, r.meta, true);
    else setState((s) => ({ ...s, busy: false }));
  }, [accept]);

  /** Fallback for Safari/Firefox, and for a dropped file. */
  const importFile = useCallback(
    async (file: File) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      await accept(
        await file.text(),
        { name: file.name, lastModified: file.lastModified, size: file.size },
        false
      );
    },
    [accept]
  );

  const importDrop = useCallback(
    async (dt: DataTransfer) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      const r = await handleFromDrop(dt);
      if (!r.ok) {
        setState((s) => ({ ...s, busy: false, error: 'That did not look like a file.' }));
        return;
      }
      const ok = await accept(
        await r.file.text(),
        { name: r.file.name, lastModified: r.file.lastModified, size: r.file.size },
        r.persistable
      );
      if (ok && r.handle) void beginPolling(r.handle);
    },
    [accept, beginPolling]
  );

  const disconnect = useCallback(async () => {
    stopPolling.current?.();
    await clearHandle();
    await clearCache();
    metaRef.current = null;
    setState({ ...INITIAL, connection: 'none', pickerSupported: isPickerSupported() });
  }, []);

  return { ...state, connect, grant, refresh, importFile, importDrop, disconnect, unlock };
}

import { describe, expect, it, vi } from 'vitest';
import { readIfChanged, type FileHandleLike, type FileLike } from './fsAccess';
import type { FileMeta } from './handleStore';

function fakeFile(o: Partial<Omit<FileLike, 'text'>> & { text?: string }): FileLike {
  return {
    name: o.name ?? 'jobs-forge-snapshot.json',
    lastModified: o.lastModified ?? 1000,
    size: o.size ?? 500,
    text: async () => o.text ?? '{}',
  };
}

function fakeHandle(file: FileLike | (() => Promise<FileLike>)): FileHandleLike & { calls: number } {
  const h = {
    calls: 0,
    async getFile() {
      h.calls++;
      return typeof file === 'function' ? file() : file;
    },
  };
  return h;
}

const prev: FileMeta = { name: 'jobs-forge-snapshot.json', lastModified: 1000, size: 500, readAt: 0 };

describe('readIfChanged', () => {
  it('reports no change when mtime and size both match', () => {
    const h = fakeHandle(fakeFile({}));
    return expect(readIfChanged(h, prev)).resolves.toEqual({ changed: false });
  });

  it('reads the file when the agent has rewritten it', async () => {
    const h = fakeHandle(fakeFile({ lastModified: 2000, text: '{"kind":"jobs-forge-snapshot"}' }));
    const r = await readIfChanged(h, prev);
    expect(r).toMatchObject({ changed: true });
    if ('text' in r) expect(r.text).toContain('jobs-forge-snapshot');
  });

  it('detects a rewrite that left mtime unchanged', async () => {
    // Some filesystems store mtime at second granularity, so a fast rewrite can
    // look identical. Size is the tiebreaker.
    const r = await readIfChanged(fakeHandle(fakeFile({ size: 900 })), prev);
    expect(r).toMatchObject({ changed: true });
  });

  it('always reads when there is no previous read', async () => {
    const r = await readIfChanged(fakeHandle(fakeFile({})), null);
    expect(r).toMatchObject({ changed: true });
  });

  it('surfaces not-found when the agent replaced the file instead of overwriting it', async () => {
    // A write-then-rename swaps the filesystem entry and invalidates the stored
    // handle. JOBS-FORGE.md forbids it; this is the recovery path.
    const err = new Error('gone');
    err.name = 'NotFoundError';
    const h = fakeHandle(async () => {
      throw err;
    });
    await expect(readIfChanged(h, prev)).resolves.toEqual({ error: 'not-found' });
  });

  it('reports a generic error without throwing', async () => {
    const h = fakeHandle(async () => {
      throw new Error('disk asleep');
    });
    await expect(readIfChanged(h, prev)).resolves.toEqual({ error: 'error' });
  });

  it('does not read file contents when nothing changed', async () => {
    const text = vi.fn(async () => '{}');
    const h = fakeHandle({ name: 'a.json', lastModified: 1000, size: 500, text });
    await readIfChanged(h, prev);
    expect(text).not.toHaveBeenCalled();
  });
});

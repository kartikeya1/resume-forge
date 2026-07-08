'use client';

import { useState } from 'react';
import { useResumeStore } from '@/lib/store';
import { diffResumes } from '@/lib/diff';
import { Menu } from './ui';

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function VersionsMenu() {
  const resume = useResumeStore((s) => s.resume);
  const library = useResumeStore((s) => s.library);
  const activeId = useResumeStore((s) => s.activeId);
  const saveVersion = useResumeStore((s) => s.saveVersion);
  const restoreVersion = useResumeStore((s) => s.restoreVersion);
  const deleteVersion = useResumeStore((s) => s.deleteVersion);
  const [diffFor, setDiffFor] = useState<string | null>(null);

  const active = library.find((e) => e.id === activeId);
  const versions = active?.versions ?? [];

  return (
    <Menu label={`🕘 Versions${versions.length ? ` (${versions.length})` : ''}`} width="w-80" align="right">
      {() => (
        <div>
          <button
            type="button"
            onClick={() => saveVersion(window.prompt('Name this version (optional)') ?? undefined)}
            className="mb-1 w-full rounded-md bg-neutral-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            💾 Save current as version
          </button>

          {versions.length === 0 ? (
            <p className="px-2 py-2 text-xs text-neutral-400">
              No versions yet. Snapshots let you restore or compare earlier drafts of this resume.
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {versions.map((v) => {
                const d = diffFor === v.id ? diffResumes(v.resume, resume) : null;
                return (
                  <li key={v.id} className="rounded-md border border-neutral-200 p-2 dark:border-neutral-700">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-200">{v.label}</div>
                        <div className="text-[10px] text-neutral-400">{timeAgo(v.at)}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => setDiffFor((id) => (id === v.id ? null : v.id))}
                          className="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-600 dark:text-neutral-400"
                        >
                          Diff
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Restore this version? Your current edits stay saved if you saved a version first.')) restoreVersion(v.id);
                          }}
                          className="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          title="Delete version"
                          onClick={() => deleteVersion(v.id)}
                          className="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-500 hover:border-red-300 hover:text-red-600 dark:border-neutral-600 dark:text-neutral-400"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {d && (
                      <div className="mt-2 space-y-0.5 border-t border-neutral-100 pt-2 dark:border-neutral-700">
                        <div className="text-[10px] uppercase tracking-wide text-neutral-400">Changes since this version → now</div>
                        {d.changedCount === 0 && <div className="text-[11px] text-neutral-400">No content changes.</div>}
                        {d.added.map((l, i) => (
                          <div key={`a${i}`} className="text-[11px] text-emerald-600 dark:text-emerald-400">+ {l}</div>
                        ))}
                        {d.removed.map((l, i) => (
                          <div key={`r${i}`} className="text-[11px] text-red-600 dark:text-red-400">− {l}</div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Menu>
  );
}

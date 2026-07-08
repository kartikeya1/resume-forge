'use client';

import { useResumeStore, STATUS_LABELS, type AppStatus } from '@/lib/store';
import { Menu } from './ui';

const STATUS_ORDER: AppStatus[] = ['draft', 'applied', 'interview', 'offer', 'rejected'];

const STATUS_BADGE: Record<AppStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300',
  applied: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  interview: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  offer: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export function DocsMenu() {
  const library = useResumeStore((s) => s.library);
  const activeId = useResumeStore((s) => s.activeId);
  const switchDoc = useResumeStore((s) => s.switchDoc);
  const newDoc = useResumeStore((s) => s.newDoc);
  const duplicateActive = useResumeStore((s) => s.duplicateActive);
  const newFromMaster = useResumeStore((s) => s.newFromMaster);
  const renameDoc = useResumeStore((s) => s.renameDoc);
  const deleteDoc = useResumeStore((s) => s.deleteDoc);
  const setStatus = useResumeStore((s) => s.setStatus);
  const setMaster = useResumeStore((s) => s.setMaster);

  const active = library.find((e) => e.id === activeId);
  const hasMaster = library.some((e) => e.isMaster);

  return (
    <Menu label={`📁 ${active?.name ?? 'Resume'}`} width="w-80">
      {(close) => (
        <div>
          <div className="max-h-72 overflow-y-auto">
            {library.map((e) => (
              <div
                key={e.id}
                className={`rounded-md px-2 py-1.5 ${e.id === activeId ? 'bg-neutral-100 dark:bg-neutral-700' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      switchDoc(e.id);
                      close();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm text-neutral-800 dark:text-neutral-100"
                  >
                    {e.isMaster && <span title="Master resume" className="text-amber-500">★</span>}
                    <span className="truncate">{e.name}</span>
                  </button>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[e.status]}`}>
                    {STATUS_LABELS[e.status]}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <select
                    value={e.status}
                    onChange={(ev) => setStatus(e.id, ev.target.value as AppStatus)}
                    className="rounded border border-neutral-300 bg-white px-1 py-0.5 text-[11px] text-neutral-600 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    {STATUS_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    title={e.isMaster ? 'Unset master' : 'Set as master'}
                    onClick={() => setMaster(e.id)}
                    className={`rounded border px-1.5 py-0.5 text-[11px] ${e.isMaster ? 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400' : 'border-neutral-300 text-neutral-500 dark:border-neutral-600 dark:text-neutral-400'}`}
                  >
                    ★ Master
                  </button>
                  <button
                    type="button"
                    title="Rename"
                    onClick={() => {
                      const name = window.prompt('Rename resume', e.name);
                      if (name && name.trim()) renameDoc(e.id, name.trim());
                    }}
                    className="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-600 dark:text-neutral-400"
                  >
                    ✎
                  </button>
                  {library.length > 1 && (
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => {
                        if (window.confirm(`Delete "${e.name}"? This cannot be undone.`)) deleteDoc(e.id);
                      }}
                      className="rounded border border-neutral-300 px-1.5 py-0.5 text-[11px] text-neutral-500 hover:border-red-300 hover:text-red-600 dark:border-neutral-600 dark:text-neutral-400"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-1 flex flex-wrap gap-1 border-t border-neutral-100 pt-2 dark:border-neutral-700">
            <MenuAction onClick={() => { newDoc(); close(); }}>＋ New</MenuAction>
            <MenuAction onClick={() => { duplicateActive(); close(); }}>⧉ Duplicate</MenuAction>
            <MenuAction onClick={() => { newFromMaster(); close(); }}>
              ★ New from Master{!hasMaster ? ' (active)' : ''}
            </MenuAction>
          </div>
        </div>
      )}
    </Menu>
  );
}

function MenuAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
    >
      {children}
    </button>
  );
}

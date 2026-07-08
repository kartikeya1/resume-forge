'use client';

import { useEffect, useState } from 'react';
import { useResumeStore } from '@/lib/store';
import { Toolbar } from '@/components/Toolbar';
import { Editor } from '@/components/Editor';
import { ResumePreview } from '@/components/ResumePreview';
import { InsightsPanel } from '@/components/InsightsPanel';

type MobileTab = 'edit' | 'preview' | 'insights';

export default function Home() {
  const resume = useResumeStore((s) => s.resume);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<MobileTab>('preview');
  const [analysisOn, setAnalysisOn] = useState(false);

  // Guard against SSR/persist hydration mismatch: the store rehydrates from
  // localStorage on the client, so we render only after mount.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="flex h-screen items-center justify-center text-sm text-neutral-400">Loading ResumeForge…</div>;
  }

  return (
    <div className="flex h-screen flex-col">
      <Toolbar analysisOn={analysisOn} onToggleAnalysis={() => setAnalysisOn((v) => !v)} />

      {/* Mobile tab switcher */}
      <div className="flex border-b border-neutral-200 bg-white lg:hidden">
        {(['edit', 'preview', 'insights'] as MobileTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize ${
              tab === t ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Editor */}
        <aside
          className={`min-h-0 w-full overflow-y-auto border-r border-neutral-200 bg-neutral-50 p-4 lg:block lg:w-[32%] lg:max-w-[440px] ${
            tab === 'edit' ? 'block' : 'hidden'
          }`}
        >
          <Editor />
        </aside>

        {/* Preview */}
        <main className={`min-h-0 flex-1 overflow-y-auto bg-neutral-100 p-6 lg:block ${tab === 'preview' ? 'block' : 'hidden'}`}>
          <ResumePreview resume={resume} analysisOn={analysisOn} />
        </main>

        {/* Insights */}
        <aside
          className={`min-h-0 w-full overflow-y-auto border-l border-neutral-200 bg-neutral-50 p-4 lg:block lg:w-[30%] lg:max-w-[400px] ${
            tab === 'insights' ? 'block' : 'hidden'
          }`}
        >
          <InsightsPanel />
        </aside>
      </div>
    </div>
  );
}

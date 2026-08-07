'use client';

import { useState } from 'react';
import { useResumeStore } from '@/lib/store';
import { useMounted } from '@/lib/useMounted';
import { useTheme } from '@/lib/useTheme';
import { Toolbar } from '@/components/Toolbar';
import { Editor } from '@/components/Editor';
import { ResumePreview } from '@/components/ResumePreview';
import { InsightsPanel } from '@/components/InsightsPanel';

type MobileTab = 'edit' | 'preview' | 'insights';

const MOBILE_TABS: MobileTab[] = ['edit', 'preview', 'insights'];

export default function Home() {
  const resume = useResumeStore((s) => s.resume);
  const { theme, toggle } = useTheme();
  const [tab, setTab] = useState<MobileTab>('preview');
  const [analysisOn, setAnalysisOn] = useState(false);

  // Guard against SSR/persist hydration mismatch: the store rehydrates from
  // localStorage on the client, so we render only after mount.
  const mounted = useMounted();

  // Arrow-key navigation across the mobile tabs, moving focus with selection.
  function onTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, current: MobileTab) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const i = MOBILE_TABS.indexOf(current);
    const next = MOBILE_TABS[(i + delta + MOBILE_TABS.length) % MOBILE_TABS.length];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  if (!mounted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-screen items-center justify-center text-sm text-neutral-600 dark:text-neutral-400"
      >
        Loading ResumeForge...
      </div>
    );
  }

  return (
    <div className={`flex h-screen flex-col bg-neutral-100 dark:bg-neutral-950 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Visible only once focused - lets keyboard users jump the whole top bar. */}
      <a
        href="#panel-preview"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-neutral-900 focus:px-3 focus:py-2 focus:text-sm focus:text-white dark:focus:bg-white dark:focus:text-neutral-900"
      >
        Skip to resume preview
      </a>

      <Toolbar
        analysisOn={analysisOn}
        onToggleAnalysis={() => setAnalysisOn((v) => !v)}
        theme={theme}
        onToggleTheme={toggle}
      />

      {/* Mobile tab switcher */}
      <div
        role="tablist"
        aria-label="Choose panel"
        className="flex border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:hidden"
      >
        {MOBILE_TABS.map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            // Only the active tab is in the tab order; arrow keys move between
            // them. This is the standard tablist keyboard pattern.
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => onTabKeyDown(e, t)}
            className={`flex-1 py-2 text-xs font-medium capitalize ${
              tab === t
                ? 'border-b-2 border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Editor */}
        <aside
          id="panel-edit"
          role="tabpanel"
          aria-labelledby="tab-edit"
          aria-label="Resume editor"
          className={`min-h-0 w-full overflow-y-auto border-r border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900 lg:block lg:w-[32%] lg:max-w-[440px] ${
            tab === 'edit' ? 'block' : 'hidden'
          }`}
        >
          <Editor />
        </aside>

        {/* Preview - surround goes dark, the paper itself stays light */}
        <main
          id="panel-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          aria-label="Resume preview"
          className={`min-h-0 flex-1 overflow-y-auto bg-neutral-100 p-6 dark:bg-neutral-950 lg:block ${
            tab === 'preview' ? 'block' : 'hidden'
          }`}
        >
          <ResumePreview resume={resume} analysisOn={analysisOn} />
        </main>

        {/* Insights */}
        <aside
          id="panel-insights"
          role="tabpanel"
          aria-labelledby="tab-insights"
          aria-label="Insights and scoring"
          className={`min-h-0 w-full overflow-y-auto border-l border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900 lg:block lg:w-[30%] lg:max-w-[400px] ${
            tab === 'insights' ? 'block' : 'hidden'
          }`}
        >
          <InsightsPanel />
        </aside>
      </div>
    </div>
  );
}

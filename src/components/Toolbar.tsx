'use client';

import { useRef, useState } from 'react';
import { useResumeStore } from '@/lib/store';
import { importPdf, ScannedPdfError } from '@/lib/pdfImport';
import { exportDocx } from '@/lib/docxExport';
import { exportPdf } from '@/lib/pdfExport';
import { saveSnapshot, openSnapshot, InvalidSnapshotError } from '@/lib/persistIO';
import { SAMPLES } from '@/lib/samples';
import type { Theme } from '@/lib/useTheme';
import { DocsMenu } from './DocsMenu';
import { VersionsMenu } from './VersionsMenu';
import { Menu } from './ui';

const IMAGE_PDF_MSG =
  'The words in this PDF could not be parsed. This appears to be an image-based (scanned) PDF rather than a text PDF, and is unusable. Please upload an original PDF exported from Word, Google Docs, LaTeX, or another document editor.';

function BrandLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="14" className="fill-neutral-900 dark:fill-white" />
      <path d="M18 17a4 4 0 0 1 4-4h15l10 10v24a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" className="fill-white dark:fill-neutral-900" />
      <path d="M37 13l10 10h-6a4 4 0 0 1-4-4z" className="fill-neutral-400 dark:fill-neutral-600" />
      <g strokeWidth="2.6" strokeLinecap="round" className="stroke-neutral-900 dark:stroke-white">
        <line x1="24" y1="30" x2="40" y2="30" />
        <line x1="24" y1="37" x2="40" y2="37" />
        <line x1="24" y1="44" x2="33" y2="44" />
      </g>
    </svg>
  );
}

// Compact icon/toggle button used for view controls on the right.
function IconToggle({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
          : 'border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800'
      }`}
    >
      {children}
    </button>
  );
}

function Row({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
    >
      {children}
    </button>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{children}</div>;
}

function Divider() {
  return <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-700" />;
}

export function Toolbar({
  analysisOn,
  onToggleAnalysis,
  theme,
  onToggleTheme,
}: {
  analysisOn: boolean;
  onToggleAnalysis: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const resume = useResumeStore((s) => s.resume);
  const jobDescription = useResumeStore((s) => s.jobDescription);
  const startFresh = useResumeStore((s) => s.startFresh);
  const importResume = useResumeStore((s) => s.importResume);
  const loadSnapshot = useResumeStore((s) => s.loadSnapshot);
  const isEmpty = useResumeStore((s) => s.isEmpty);

  const pdfRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);

  // Confirm before any action that replaces the current resume.
  function guard(fn: () => void) {
    if (isEmpty() || window.confirm('Replace your current resume? Save a copy first if you want to keep it.')) fn();
  }

  async function onPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    guard(async () => {
      setError(null);
      setBusy('Parsing PDF…');
      try {
        importResume(await importPdf(file));
      } catch (err) {
        setError(err instanceof ScannedPdfError ? IMAGE_PDF_MSG : 'Could not read this PDF. Please try a different file.');
        if (!(err instanceof ScannedPdfError)) console.error(err);
      } finally {
        setBusy(null);
      }
    });
  }

  async function onOpen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    guard(async () => {
      setError(null);
      try {
        const { resume: r, jobDescription: jd } = await openSnapshot(file);
        loadSnapshot(r, jd);
      } catch (err) {
        setError(err instanceof InvalidSnapshotError ? err.message : 'Could not open this file.');
      }
    });
  }

  function pickSample(key: string) {
    const def = SAMPLES.find((s) => s.key === key);
    if (def) guard(() => importResume(def.build()));
  }

  async function onExportDocx() {
    setBusy('Building .docx…');
    try {
      await exportDocx(resume);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-neutral-200 bg-white px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        {/* Brand */}
        <div className="mr-1 flex items-center gap-2">
          <BrandLogo />
          <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Resume<span className="text-neutral-400">Forge</span>
          </span>
        </div>

        <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

        {/* Workflow: which resume + its history */}
        <DocsMenu />
        <VersionsMenu />

        <div className="flex-1" />

        {busy && <span className="text-xs text-neutral-500">{busy}</span>}

        {/* File: content in/out */}
        <Menu label="📄 File" width="w-64">
          {(close) => (
            <div>
              <GroupLabel>Add content</GroupLabel>
              <Row onClick={() => { pdfRef.current?.click(); close(); }}>⤒ Import from PDF…</Row>
              <Row onClick={() => { jsonRef.current?.click(); close(); }}>📂 Open saved file…</Row>
              <Row onClick={() => { saveSnapshot(resume, jobDescription); close(); }}>💾 Save to file</Row>
              <Divider />
              <GroupLabel>Start from a sample</GroupLabel>
              <div className="max-h-56 overflow-y-auto">
                {SAMPLES.map((s) => (
                  <Row key={s.key} onClick={() => { pickSample(s.key); close(); }}>
                    <span>{s.label}</span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300">{s.role}</span>
                  </Row>
                ))}
              </div>
              <Divider />
              <Row onClick={() => { guard(() => startFresh()); close(); }}>🧹 Start fresh (clear this resume)</Row>
            </div>
          )}
        </Menu>

        {/* Export */}
        <Menu label="⬇ Export" width="w-52" align="right">
          {(close) => (
            <div>
              <Row onClick={() => { exportPdf(); close(); }}>Download PDF</Row>
              <Row onClick={() => { onExportDocx(); close(); }}>Download Word (.docx)</Row>
            </div>
          )}
        </Menu>

        <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

        {/* View toggles */}
        <IconToggle onClick={onToggleAnalysis} active={analysisOn} title="Toggle the analysis heatmap on the preview">
          ◱ Analysis
        </IconToggle>
        <IconToggle onClick={onToggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </IconToggle>

        <input ref={pdfRef} type="file" accept="application/pdf,.pdf" onChange={onPdf} className="hidden" />
        <input ref={jsonRef} type="file" accept="application/json,.json" onChange={onOpen} className="hidden" />
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

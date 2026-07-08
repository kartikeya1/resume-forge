'use client';

import { useEffect, useRef, useState } from 'react';
import { useResumeStore } from '@/lib/store';
import { importPdf, ScannedPdfError } from '@/lib/pdfImport';
import { exportDocx } from '@/lib/docxExport';
import { exportPdf } from '@/lib/pdfExport';
import { saveSnapshot, openSnapshot, InvalidSnapshotError } from '@/lib/persistIO';
import { SAMPLES } from '@/lib/samples';

const IMAGE_PDF_MSG =
  'The words in this PDF could not be parsed. This appears to be an image-based (scanned) PDF rather than a text PDF, and is unusable. Please upload an original PDF exported from Word, Google Docs, LaTeX, or another document editor.';

function Btn({
  onClick,
  children,
  variant = 'ghost',
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'ghost' | 'solid';
  disabled?: boolean;
}) {
  const base = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition disabled:opacity-50';
  const styles =
    variant === 'solid' ? 'bg-neutral-900 text-white hover:bg-neutral-700' : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function SamplesDropdown({ onPick }: { onPick: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Btn onClick={() => setOpen((o) => !o)}>
        ✨ Samples <span className="text-xs text-neutral-400">▾</span>
      </Btn>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {SAMPLES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(s.key);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
            >
              <span>{s.label}</span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">{s.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toolbar({ analysisOn, onToggleAnalysis }: { analysisOn: boolean; onToggleAnalysis: () => void }) {
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
    if (isEmpty() || window.confirm('Replace your current resume? Click Save first if you want to keep a copy.')) {
      fn();
    }
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
    if (!def) return;
    guard(() => importResume(def.build()));
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
    <div className="flex flex-col gap-2 border-b border-neutral-200 bg-white px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-1 flex items-center gap-2">
          <span className="text-lg">📄</span>
          <span className="text-sm font-semibold tracking-tight text-neutral-900">
            Resume<span className="text-neutral-400">Forge</span>
          </span>
        </div>

        <div className="h-5 w-px bg-neutral-200" />

        <SamplesDropdown onPick={pickSample} />
        <Btn onClick={() => guard(() => startFresh())}>＋ Start fresh</Btn>
        <Btn onClick={() => pdfRef.current?.click()}>⤒ Import PDF</Btn>

        <div className="h-5 w-px bg-neutral-200" />

        <Btn onClick={() => jsonRef.current?.click()}>📂 Open</Btn>
        <Btn onClick={() => saveSnapshot(resume, jobDescription)}>💾 Save</Btn>

        <div className="flex-1" />

        <Btn onClick={onToggleAnalysis}>
          <span className={analysisOn ? 'text-emerald-600' : 'text-neutral-400'}>●</span> Analysis {analysisOn ? 'on' : 'off'}
        </Btn>

        <div className="h-5 w-px bg-neutral-200" />

        {busy && <span className="text-xs text-neutral-500">{busy}</span>}
        <Btn onClick={() => exportPdf()}>⬇ PDF</Btn>
        <Btn variant="solid" onClick={onExportDocx}>⬇ DOCX</Btn>

        <input ref={pdfRef} type="file" accept="application/pdf,.pdf" onChange={onPdf} className="hidden" />
        <input ref={jsonRef} type="file" accept="application/json,.json" onChange={onOpen} className="hidden" />
      </div>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 font-medium text-red-500 hover:text-red-700">
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useResumeStore } from '@/lib/store';
import { importPdf, ScannedPdfError } from '@/lib/pdfImport';
import { exportDocx } from '@/lib/docxExport';
import { exportPdf } from '@/lib/pdfExport';

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
  const base = 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50';
  const styles =
    variant === 'solid'
      ? 'bg-neutral-900 text-white hover:bg-neutral-700'
      : 'border border-neutral-300 text-neutral-700 hover:bg-neutral-100';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

export function Toolbar() {
  const resume = useResumeStore((s) => s.resume);
  const startFresh = useResumeStore((s) => s.startFresh);
  const importResume = useResumeStore((s) => s.importResume);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | string>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting same file
    if (!file) return;
    setError(null);
    setBusy('Parsing PDF…');
    try {
      const parsed = await importPdf(file);
      importResume(parsed);
    } catch (err) {
      if (err instanceof ScannedPdfError) {
        setError(IMAGE_PDF_MSG);
      } else {
        console.error(err);
        setError('Could not read this PDF. Please try a different file.');
      }
    } finally {
      setBusy(null);
    }
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
        <div className="mr-2 flex items-center gap-2">
          <span className="text-lg">📄</span>
          <span className="text-sm font-semibold tracking-tight text-neutral-900">
            Resume<span className="text-neutral-400">Forge</span>
          </span>
        </div>

        <div className="h-5 w-px bg-neutral-200" />

        <Btn onClick={() => startFresh()}>＋ Start fresh</Btn>
        <Btn onClick={() => fileRef.current?.click()}>⤒ Import PDF</Btn>

        <div className="flex-1" />

        {busy && <span className="text-xs text-neutral-500">{busy}</span>}
        <Btn onClick={() => exportPdf()}>⬇ PDF</Btn>
        <Btn variant="solid" onClick={onExportDocx}>⬇ DOCX</Btn>

        <input ref={fileRef} type="file" accept="application/pdf,.pdf" onChange={onFile} className="hidden" />
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

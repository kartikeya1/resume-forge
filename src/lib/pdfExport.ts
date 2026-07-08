// PDF export via the browser's print engine. Because we print the exact same
// DOM node as the on-screen preview, the design is preserved and the text
// stays selectable/parseable (good for ATS). We size the print page to the
// content height so the result is a single seamless "pageless" PDF.
'use client';

// Matches the fixed 720px paper width used on screen and forced in print CSS
// (720 / 96 = 7.5in), so the measured height maps cleanly to the page size.
const PAGE_WIDTH_IN = 7.5;
const PX_PER_IN = 96;

// The preview paper is rendered at a fixed CSS width; we read its real height
// and emit an @page rule sized to one continuous page.
export function exportPdf(previewSelector = '#resume-paper'): void {
  const el = document.querySelector<HTMLElement>(previewSelector);
  if (!el) {
    window.print();
    return;
  }

  const heightPx = el.scrollHeight;
  const heightIn = Math.max(4, heightPx / PX_PER_IN + 0.1);

  const style = document.createElement('style');
  style.id = 'rf-print-page-size';
  style.textContent = `@media print { @page { size: ${PAGE_WIDTH_IN}in ${heightIn.toFixed(2)}in; margin: 0; } }`;
  document.head.appendChild(style);

  const cleanup = () => {
    document.getElementById('rf-print-page-size')?.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Give the style a tick to apply, then print.
  setTimeout(() => window.print(), 50);
}

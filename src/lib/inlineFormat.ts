// WhatsApp-style inline formatting: text wrapped in *asterisks* becomes bold.
// Dependency-free so both the React preview and the DOCX exporter can share it.

export interface Segment {
  text: string;
  bold: boolean;
}

// Splits a string into bold / non-bold segments. Only paired single asterisks
// on the same line form bold; stray asterisks are left as literal text.
export function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), bold: false });
    segments.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false });
  if (segments.length === 0) segments.push({ text: '', bold: false });
  return segments;
}

// Strips the bold markers, returning plain text (used for analysis/keyword
// matching so the asterisks never count as content).
export function stripInline(text: string): string {
  return text.replace(/\*([^*\n]+)\*/g, '$1');
}

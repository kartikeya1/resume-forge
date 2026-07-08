import { parseInline } from '@/lib/inlineFormat';

// Renders text with *bold* segments as <strong>. Used everywhere the resume
// shows free text so users can bold inline with asterisks.
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((seg, i) =>
        seg.bold ? <strong key={i}>{seg.text}</strong> : <span key={i}>{seg.text}</span>
      )}
    </>
  );
}

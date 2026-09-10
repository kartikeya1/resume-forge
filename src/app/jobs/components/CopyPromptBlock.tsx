'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { BTN, BTN_PRIMARY, MUTED } from './ui';

/**
 * A prompt, a button that copies it, and a way to get at the text when the
 * button cannot.
 *
 * The clipboard is genuinely unreliable: it needs a focused document and a
 * secure context, and it is blocked outright in several embedded and sandboxed
 * browsers. PrepButton swallowed that failure in an empty `catch {}`, which
 * means on those browsers its "Prep" button did nothing at all, silently. Here
 * a failure reveals the textarea instead, so there is always a path to the
 * text - and a character count, so a truncated paste is visible rather than
 * something you discover from a half-built snapshot.
 */
export function CopyPromptBlock({
  prompt,
  label = 'Copy prompt',
  hint,
}: {
  prompt: string;
  label?: string;
  /** One line above the button explaining what to do with it. */
  hint?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const areaId = useId();

  const wantSelect = useRef(false);

  // Select the whole thing on reveal, so the manual path is one Cmd-C rather
  // than a drag through two hundred lines.
  //
  // In an effect rather than a requestAnimationFrame inside the click
  // handler: rAF is not guaranteed to run after React has committed, so the
  // ref was still null and nothing got selected - while the alert below
  // claimed the text was selected, which was worse than not trying.
  useEffect(() => {
    if (!shown || !wantSelect.current) return;
    wantSelect.current = false;
    const el = areaRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [shown]);

  const reveal = () => {
    wantSelect.current = true;
    setShown(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
      reveal();
    }
  };

  return (
    <div>
      {hint && <p className={`mb-2 max-w-prose text-sm ${MUTED}`}>{hint}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={() => void copy()}>
          {copied ? 'Copied' : label}
        </button>
        <button
          type="button"
          className={BTN}
          onClick={() => (shown ? setShown(false) : reveal())}
          aria-expanded={shown}
          aria-controls={areaId}
        >
          {shown ? 'Hide prompt' : 'Show prompt'}
        </button>
        <span className={`text-xs tabular-nums ${MUTED}`}>
          {prompt.length.toLocaleString()} characters
        </span>
      </div>

      {failed && (
        <p role="alert" className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          This browser would not let the page write to your clipboard. The prompt is
          selected below - copy it by hand.
        </p>
      )}

      {shown && (
        <textarea
          ref={areaRef}
          id={areaId}
          readOnly
          value={prompt}
          rows={14}
          spellCheck={false}
          aria-label="Prompt text"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full rounded-md border border-neutral-300 bg-neutral-50 p-2 font-mono text-[11px] leading-snug text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
        />
      )}
    </div>
  );
}

'use client';

import { MUTED } from './ui';

/**
 * The provenance line, pinned to the bottom of the shell.
 *
 * It answers "is what I am looking at actually complete" - which file, what
 * window the agent scanned, how many threads it saw. That was the last line
 * of a long scrolling page before, i.e. the one place you would never look
 * while deciding whether to trust the board.
 */
export function StatusBar({
  fileName,
  since,
  until,
  threadCount,
}: {
  fileName: string;
  since: string;
  until: string;
  threadCount: number;
}) {
  return (
    <footer
      className={`border-t border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900 ${MUTED}`}
    >
      Source: {fileName} &middot; {since} to {until} &middot; {threadCount} threads scanned
    </footer>
  );
}

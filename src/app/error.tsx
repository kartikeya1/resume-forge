'use client'; // Error boundaries must be Client Components.

import { useEffect } from 'react';

// Next 16 passes `unstable_retry` (not `reset`) to re-render the segment.
// Without this file an unhandled render error blanks the page, which is
// especially bad here: the user's resume is in localStorage and looks lost.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-100 p-6 dark:bg-neutral-950">
      <div className="max-w-md rounded-lg border border-neutral-200 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Your resume is saved in this browser and has not been lost. Try again, and if the problem
          repeats, use <span className="font-medium">File → Save to file</span> once the app recovers
          so you have a backup.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            Reload the page
          </button>
        </div>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-neutral-400">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}

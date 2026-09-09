// CSV export. Pure string-building - no `document`, no file I/O - so it is
// fully unit-testable; the actual download trigger lives in the component.

import { STATUS_LABELS } from './labels';
import type { Application } from './types';

const COLUMNS = [
  'Company', 'Role', 'Status', 'Applied', 'Last activity', 'Recruiter replied',
  'Needs review', 'Req IDs', 'Notes', 'Gmail threads',
] as const;

function csvCell(v: string): string {
  // RFC 4180: quote whenever the value contains a comma, quote, or newline,
  // and double any embedded quotes.
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function isoDate(ms: number | null): string {
  return ms === null ? '' : new Date(ms).toISOString().slice(0, 10);
}

export function applicationsToCsv(apps: Application[]): string {
  const rows = apps.map((a) => [
    a.company ?? '',
    a.role ?? '',
    STATUS_LABELS[a.status],
    isoDate(a.appliedAt),
    isoDate(a.lastAt),
    a.flags.recruiterReplied ? 'yes' : 'no',
    a.flags.needsReview ? 'yes' : 'no',
    a.reqIds.join('; '),
    a.notes ?? '',
    a.threadIds.map((id) => `https://mail.google.com/mail/u/0/#all/${id}`).join('; '),
  ]);
  // \r\n per RFC 4180; Excel and Sheets both expect it on import.
  return [COLUMNS, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function downloadCsv(apps: Application[], filename = 'jobs-forge-export.csv'): void {
  const csv = applicationsToCsv(apps);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

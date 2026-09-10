'use client';

import { Menu } from '@/components/ui';
import { STATUS_LABELS } from '@/lib/jobs/labels';
import type { Application } from '@/lib/jobs/types';
import { MUTED, TEXT } from './ui';

// Reuses the repo's existing Menu primitive (src/components/ui.tsx) rather
// than building a second popover implementation - it already has outside-click
// dismissal, Escape-to-close, and focus return.
export function WhyPopover({ app }: { app: Application }) {
  const threadEntries = Object.entries(app.classificationByThread);
  return (
    <Menu label="Why?" width="w-80" align="right">
      {() => (
        <div className="max-h-80 space-y-3 overflow-auto px-2 py-1.5 text-xs">
          <div>
            <div className="font-semibold text-neutral-800 dark:text-neutral-100">
              Status: {STATUS_LABELS[app.status]}
            </div>
            <p className={`mt-0.5 ${TEXT}`}>{app.statusReason}</p>
            <p className={`mt-0.5 font-mono text-[10px] ${MUTED}`}>{app.statusRuleId}</p>
          </div>

          {app.agentReason && (
            <div>
              <div className="font-semibold text-neutral-800 dark:text-neutral-100">Agent&apos;s note</div>
              <p className={`mt-0.5 italic ${TEXT}`}>{app.agentReason}</p>
            </div>
          )}

          <div>
            <div className="font-semibold text-neutral-800 dark:text-neutral-100">Where the fields came from</div>
            <p className={`mt-0.5 ${TEXT}`}>Company: {readable(app.provenance.company)}</p>
            <p className={`mt-0.5 ${TEXT}`}>Role: {readable(app.provenance.role)}</p>
          </div>

          {app.mergeRuleIds.length > 0 && (
            <div>
              <div className="font-semibold text-neutral-800 dark:text-neutral-100">
                Why {threadEntries.length} threads were merged
              </div>
              <p className={`mt-0.5 font-mono text-[10px] ${MUTED}`}>{app.mergeRuleIds.join(', ')}</p>
            </div>
          )}

          {threadEntries.length > 0 && (
            <div>
              <div className="font-semibold text-neutral-800 dark:text-neutral-100">Per-thread classification</div>
              <ul className="mt-1 space-y-1.5">
                {threadEntries.map(([threadId, reasons]) => (
                  <li key={threadId}>
                    <p className={`font-mono text-[10px] ${MUTED}`}>{threadId}</p>
                    <p className={`font-mono text-[10px] ${MUTED}`}>{reasons.join(' → ')}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Menu>
  );
}

function readable(source: string): string {
  switch (source) {
    case 'agent': return 'the agent read the email body';
    case 'user': return 'you set this by hand';
    case 'sender-localpart': return "the sender's address (e.g. mastercard@myworkday.com)";
    case 'sender-subdomain': return "the sender's subdomain";
    case 'sender-domain': return "the sender's domain";
    case 'subject-template': return 'a pattern matched in the subject line';
    case 'body': return 'the email body';
    default: return 'unknown - nothing set this field';
  }
}

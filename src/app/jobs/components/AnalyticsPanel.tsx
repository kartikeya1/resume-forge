'use client';

import { useId, useState } from 'react';
import {
  breakdownByRole, breakdownByVendor, buildFunnel, MIN_SAMPLE, replyRate,
  timeToFirstHumanReply, timeToRejection, type BreakdownRow, type DurationStats,
} from '@/lib/jobs/funnel';
import type { Application } from '@/lib/jobs/types';
import { BTN, CARD, MUTED, TEXT } from './ui';

function pct(n: number | null): string {
  return n === null ? '—' : `${Math.round(n * 100)}%`;
}

/**
 * "Which kinds of application are worth your hours" - built only from what
 * real mail reliably states. Company size, geography and application channel
 * were in the original scope and are not here: nothing in a Gmail thread
 * states them, and guessing would break the one rule this dashboard has held
 * to since Phase 0. Say so on screen rather than silently omitting it.
 */
export function AnalyticsPanel({ applications }: { applications: Application[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!open) {
    return (
      <button type="button" className={BTN} onClick={() => setOpen(true)} aria-expanded={false} aria-controls={panelId}>
        Analytics
      </button>
    );
  }

  const funnel = buildFunnel(applications);
  const replies = replyRate(applications);
  const firstReply = timeToFirstHumanReply(applications);
  const toRejection = timeToRejection(applications);
  const byVendor = breakdownByVendor(applications);
  const byRole = breakdownByRole(applications);

  return (
    <div id={panelId} className={`${CARD} w-full px-3 py-3`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Analytics</h3>
        <button type="button" className={BTN} onClick={() => setOpen(false)} aria-expanded aria-controls={panelId}>
          Close
        </button>
      </div>

      {funnel.applied === 0 ? (
        <p className={`text-sm ${MUTED}`}>Nothing submitted yet - there is nothing to analyse.</p>
      ) : (
        <>
          {/* ---- Funnel ---- */}
          <section aria-labelledby="funnel-h">
            <h4 id="funnel-h" className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Funnel
            </h4>
            <FunnelBar label="Applied" value={funnel.applied} of={funnel.applied} />
            <FunnelBar
              label="Interviewing"
              value={funnel.interviewing}
              of={funnel.applied}
              note={funnel.conversion.appliedToInterviewing !== null ? `${pct(funnel.conversion.appliedToInterviewing)} of applied` : undefined}
            />
            <FunnelBar
              label="Offer"
              value={funnel.offer}
              of={funnel.applied}
              note={funnel.conversion.interviewingToOffer !== null ? `${pct(funnel.conversion.interviewingToOffer)} of interviewing` : undefined}
            />
            <p className={`mt-1.5 text-xs ${MUTED}`}>
              <strong>{funnel.reviewed}</strong> got an explicit &quot;under review&quot; signal - shown
              for reference only. Most ATS platforms never send one, so this is a floor, not a true
              count, and there is deliberately no conversion rate built on it.
            </p>
          </section>

          {/* ---- Ghost rate ---- */}
          <section className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-700" aria-labelledby="ghost-h">
            <h4 id="ghost-h" className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Human contact
            </h4>
            <p className={`mt-1 text-sm ${TEXT}`}>
              <strong className="tabular-nums">{pct(replies.ghostRate)}</strong> of {replies.applied} applications
              never had a real person reply, at all - not a status, the whole history.{' '}
              {replies.everGotHumanReply} did.
            </p>
          </section>

          {/* ---- Timing ---- */}
          <section className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-700" aria-labelledby="timing-h">
            <h4 id="timing-h" className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Timing
            </h4>
            <DurationRow label="To first human reply (not the auto-ack)" stats={firstReply} />
            <DurationRow label="To rejection" stats={toRejection} />
          </section>

          {/* ---- Breakdowns ---- */}
          <BreakdownTable
            title="By how you applied"
            caption="ATS vendor is the closest reliable proxy this data has to “channel”."
            rows={byVendor}
          />
          <BreakdownTable title="By role" rows={byRole} />

          <div className="mt-4 rounded-md bg-neutral-100 px-3 py-2 text-xs dark:bg-neutral-900/50">
            <strong className={TEXT}>Not tracked:</strong>{' '}
            <span className={MUTED}>
              company size, geography, and application channel beyond ATS vendor. Nothing in your
              mail reliably states these, and this dashboard does not guess.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function FunnelBar({ label, value, of, note }: { label: string; value: number; of: number; note?: string }) {
  const width = of > 0 ? Math.max(2, Math.round((value / of) * 100)) : 0;
  return (
    <div className="mt-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className={TEXT}>{label}</span>
        <span className={`tabular-nums ${MUTED}`}>
          {value}
          {note ? ` · ${note}` : ''}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700">
        <div className="h-full rounded-full bg-neutral-900 dark:bg-neutral-100" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function DurationRow({ label, stats }: { label: string; stats: DurationStats }) {
  return (
    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
      <span className={TEXT}>{label}</span>
      <span className={`tabular-nums ${MUTED}`}>
        {stats.n === 0 ? 'no data yet' : `${stats.medianDays}d median (n=${stats.n}, ${stats.minDays}–${stats.maxDays}d)`}
      </span>
    </div>
  );
}

function BreakdownTable({ title, caption, rows }: { title: string; caption?: string; rows: BreakdownRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-700">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{title}</h4>
      {caption && <p className={`mt-0.5 text-[11px] ${MUTED}`}>{caption}</p>}
      <div className="mt-1.5 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className={MUTED}>
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">Group</th>
              <th scope="col" className="py-1 pr-2 font-medium">n</th>
              <th scope="col" className="py-1 pr-2 font-medium">Human reply</th>
              <th scope="col" className="py-1 pr-2 font-medium">Interviewing</th>
              <th scope="col" className="py-1 font-medium">Offer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-neutral-100 dark:border-neutral-800">
                <td className={`py-1 pr-2 ${TEXT}`}>
                  {r.label}
                  {r.applied < MIN_SAMPLE && (
                    <span className={`ml-1 text-[10px] ${MUTED}`} title="Fewer than 3 applications - one data point away from a big swing.">
                      (small sample)
                    </span>
                  )}
                </td>
                <td className={`py-1 pr-2 tabular-nums ${MUTED}`}>{r.applied}</td>
                <td className={`py-1 pr-2 tabular-nums ${MUTED}`}>{pct(r.humanReplyRate)}</td>
                <td className={`py-1 pr-2 tabular-nums ${MUTED}`}>{pct(r.interviewingRate)}</td>
                <td className={`py-1 tabular-nums ${MUTED}`}>{pct(r.offerRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

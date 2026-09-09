'use client';

import { useId, useState } from 'react';
import {
  buildFollowUpPlan, downloadFollowUpPlan, type FollowUpPlan,
} from '@/lib/jobs/followUp';
import {
  downloadLabelPlan, JOBS_LABELS, LABEL_BLURBS, summariseLabelPlan, type LabelPlan,
} from '@/lib/jobs/labelPlan';
import type { Application } from '@/lib/jobs/types';
import { BTN, BTN_PRIMARY, CARD, MUTED, TEXT } from './ui';

/**
 * The review surface for anything that will touch Gmail.
 *
 * Nothing on this page can write to Gmail - the app has no backend. What this
 * does is export a plan file that an agent then applies, which means there is
 * always a reviewable artifact between a derived status and a mailbox with
 * 181,000 messages in it. The dry-run below is that review.
 */
export function GmailSyncPanel({
  labelPlan,
  applications,
  followUpStaleDays,
  now,
}: {
  labelPlan: LabelPlan;
  applications: Application[];
  followUpStaleDays: number;
  now: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const panelId = useId();
  const followUps: FollowUpPlan = buildFollowUpPlan(applications, followUpStaleDays, now);


  const preview = showAll ? labelPlan.changes : labelPlan.changes.slice(0, 8);

  return (
    <div id={panelId} className={`${CARD} w-full px-3 py-3`}>

      <p className={`max-w-prose text-sm ${TEXT}`}>
        This page cannot write to Gmail. It exports a plan; an agent applies it. Read the plan
        first - that is the point of it.
      </p>
      <p className={`mt-1.5 max-w-prose text-xs ${MUTED}`}>
        Every label sits under <code>JobsForge/</code>, so this can never touch your own labels, and
        deleting those five labels undoes the whole thing.
      </p>

      {/* ---- Labels ---- */}
      <section className="mt-4" aria-labelledby="labels-h">
        <h4 id="labels-h" className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Labels
        </h4>
        <p role="status" className={`mt-1 text-sm ${TEXT}`}>
          {summariseLabelPlan(labelPlan)}
        </p>

        <ul className={`mt-2 space-y-0.5 text-xs ${MUTED}`}>
          {JOBS_LABELS.map((l) => (
            <li key={l} className="flex flex-wrap items-baseline gap-x-2">
              <code className="text-[11px] text-neutral-700 dark:text-neutral-200">{l}</code>
              <span className="tabular-nums">{labelPlan.counts[l]}</span>
              <span>{LABEL_BLURBS[l]}</span>
            </li>
          ))}
        </ul>

        {labelPlan.changes.length > 0 && (
          <>
            <div className="mt-3 max-h-64 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-700">
              <table className="w-full text-left text-[11px]">
                <thead className={`sticky top-0 bg-neutral-50 dark:bg-neutral-900 ${MUTED}`}>
                  <tr>
                    <th scope="col" className="px-2 py-1 font-medium">Application</th>
                    <th scope="col" className="px-2 py-1 font-medium">Thread</th>
                    <th scope="col" className="px-2 py-1 font-medium">Add</th>
                    <th scope="col" className="px-2 py-1 font-medium">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((c) => (
                    <tr key={c.threadId} className="border-t border-neutral-100 dark:border-neutral-800">
                      <td className={`px-2 py-1 ${TEXT}`}>
                        {c.company ?? 'Unknown'}
                        {c.role ? ` — ${c.role}` : ''}
                      </td>
                      <td className={`px-2 py-1 font-mono text-[10px] ${MUTED}`}>{c.threadId}</td>
                      <td className="px-2 py-1 text-emerald-700 dark:text-emerald-400">
                        {c.add.map((l) => l.replace('JobsForge/', '')).join(', ') || '—'}
                      </td>
                      <td className="px-2 py-1 text-red-700 dark:text-red-400">
                        {c.remove.map((l) => l.replace('JobsForge/', '')).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {labelPlan.changes.length > 8 && (
              <button type="button" className={`${BTN} mt-2`} onClick={() => setShowAll((v) => !v)} aria-pressed={showAll}>
                {showAll ? 'Show first 8' : `Show all ${labelPlan.changes.length}`}
              </button>
            )}
          </>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={labelPlan.changes.length === 0}
            onClick={() => downloadLabelPlan(labelPlan)}
          >
            Export label plan
          </button>
        </div>
        <p className={`mt-2 text-xs ${MUTED}`}>
          Then tell an agent: <em>apply the label plan in my Downloads folder</em>. It follows the
          Gmail write-back section of <code>JOBS-FORGE.md</code>.
        </p>
      </section>

      {/* ---- Follow-ups ---- */}
      <section className="mt-5 border-t border-neutral-200 pt-4 dark:border-neutral-700" aria-labelledby="followups-h">
        <h4 id="followups-h" className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Follow-up drafts
        </h4>
        <p className={`mt-1 text-sm ${TEXT}`}>
          {followUps.drafts.length === 0
            ? 'Nothing is worth chasing right now.'
            : `${followUps.drafts.length} application${followUps.drafts.length === 1 ? '' : 's'} worth a nudge.`}
        </p>
        <p className={`mt-1 text-xs ${MUTED}`}>
          Only where a real person is on the other end - chasing a no-reply address achieves
          nothing. Created as <strong>drafts</strong>; you press send.
        </p>

        {followUps.drafts.length > 0 && (
          <ul className="mt-2 space-y-2">
            {followUps.drafts.map((d) => (
              <li key={d.applicationId} className="rounded-md border border-neutral-200 px-2 py-1.5 dark:border-neutral-700">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">{d.company}</span>
                  <span className={TEXT}>{d.role ?? 'role not stated'}</span>
                  <span className={`ml-auto ${MUTED}`}>{d.to ?? 'no human contact'}</span>
                </div>
                <p className={`mt-0.5 text-[11px] ${MUTED}`}>{d.reason}</p>
                <details className="mt-1">
                  <summary className={`cursor-pointer text-[11px] ${MUTED}`}>Preview</summary>
                  <pre className={`mt-1 whitespace-pre-wrap text-[11px] ${TEXT}`}>{d.body}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className={`${BTN} mt-3`}
          disabled={followUps.drafts.length === 0}
          onClick={() => downloadFollowUpPlan(followUps)}
        >
          Export follow-up drafts
        </button>
      </section>
    </div>
  );
}

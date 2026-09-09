'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMounted } from '@/lib/useMounted';
import { useTheme } from '@/lib/useTheme';
import { buildApplications } from '@/lib/jobs';
import { summariseActivity } from '@/lib/jobs/activity';
import { downloadCsv } from '@/lib/jobs/csv';
import { buildLabelPlan, threadLabelsFromSnapshot } from '@/lib/jobs/labelPlan';
import { CLOSED_STATUSES, STATUS_BLURBS, STATUS_LABELS, STATUS_ORDER, relativeTime } from '@/lib/jobs/labels';
import { useNow } from '@/lib/jobs/useNow';
import { useOverridesStore } from '@/lib/jobs/overridesStore';
import { useSettingsStore } from '@/lib/jobs/settingsStore';
import { useSnapshot } from '@/lib/jobs/useSnapshot';
import type { Application, JobStatus } from '@/lib/jobs/types';
import { reconcileOverrides } from '@/lib/jobs';
import { needsYouReason } from '@/lib/jobs/needsYou';
import { ApplicationRow, CARD, KpiTile, MUTED, TEXT, ThreadRow } from './components/parts';
import { BTN, ConnectPanel } from './components/ConnectPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { GmailSyncPanel } from './components/GmailSyncPanel';
import { ManualAddForm } from './components/ManualAddForm';
import { PublishPanel } from './components/PublishPanel';
import { ReviewDrawer } from './components/ReviewDrawer';
import { SettingsPanel } from './components/SettingsPanel';
import { UnlockPanel } from './components/UnlockPanel';

/** Beyond this the dashboard is probably lying, so say so loudly. */
const STALE_HOURS = 36;

export function JobsDashboard() {
  const mounted = useMounted();
  const { theme, toggle } = useTheme();
  const s = useSnapshot();
  const [showClosed, setShowClosed] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  // Remounting ManualAddForm with a fresh key + prefill is simpler and safer
  // than lifting its internal open/company/role state up here.
  const [reviewPrefill, setReviewPrefill] = useState<{ company: string; role?: string } | null>(null);
  const [manualAddKey, setManualAddKey] = useState(0);

  const now = useNow();

  const overrides = useOverridesStore((st) => st.overrides);
  const replaceOverrides = useOverridesStore((st) => st.replaceOverrides);
  const settings = useSettingsStore((st) => st.settings);

  // Deliberately derived on every load rather than cached, so a classifier fix
  // applies to an existing snapshot the moment it deploys. It also genuinely
  // depends on `now` - "ghosted" and "lapsed" are elapsed-time verdicts - so
  // re-running on the minute tick is correct, not waste. The pipeline is pure
  // and sub-millisecond at this size.
  const result = useMemo(
    () => (s.snapshot ? buildApplications(s.snapshot, { now, overrides, settings }) : null),
    [s.snapshot, now, overrides, settings]
  );

  // Re-key any override whose application id changed because a fresh snapshot
  // resolved something the rules could not before (a company that was
  // "unknown:t123::spm" becomes "blitz::spm" once the agent supplies it).
  // Without this a hand-written note or status silently detaches. Keyed on the
  // snapshot's own generatedAt, not on `result`, so this fires once per actual
  // refresh rather than once a minute on the `now` tick.
  const prevAppsRef = useRef<{ id: string; threadIds: string[] }[] | null>(null);
  const lastGeneratedAtRef = useRef<string | null>(null);
  useEffect(() => {
    if (!result) return;
    const generatedAt = s.snapshot?.generatedAt ?? null;
    const isNewSnapshot = generatedAt !== lastGeneratedAtRef.current;
    if (isNewSnapshot && prevAppsRef.current) {
      const reconciled = reconcileOverrides(
        prevAppsRef.current,
        result.applications.map((a) => ({ id: a.id, threadIds: a.threadIds })),
        overrides
      );
      if (JSON.stringify(reconciled) !== JSON.stringify(overrides)) replaceOverrides(reconciled);
    }
    lastGeneratedAtRef.current = generatedAt;
    prevAppsRef.current = result.applications.map((a) => ({ id: a.id, threadIds: a.threadIds }));
    // overrides/replaceOverrides deliberately excluded: reconciliation reads
    // and writes overrides itself, and depending on it would create a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, s.snapshot?.generatedAt]);

  if (!mounted) {
    return (
      <div role="status" aria-live="polite" className="flex h-screen items-center justify-center text-sm text-neutral-600 dark:text-neutral-400">
        Loading Jobs Forge...
      </div>
    );
  }

  const generatedAt = s.snapshot ? Date.parse(s.snapshot.generatedAt) : null;
  const stale = generatedAt !== null && now - generatedAt > STALE_HOURS * 3600_000;
  const apps = (result?.applications ?? []).filter((a) => !a.archived);
  const needsYou = apps
    .map((a) => ({ app: a, reason: needsYouReason(a, now, settings) }))
    .filter((x): x is { app: Application; reason: string } => !!x.reason);
  const live = apps.filter((a) => !CLOSED_STATUSES.has(a.status));
  const activity = summariseActivity(apps, settings.applyNudgeDays, now);

  // Built from exactly the applications and "Needs you" set rendered above,
  // so the exported plan can never disagree with what is on screen.
  const labelPlan =
    result && s.snapshot
      ? buildLabelPlan({
          applications: apps,
          threadLabels: threadLabelsFromSnapshot(s.snapshot.threads),
          needsYouIds: new Set(needsYou.map((n) => n.app.id)),
          snapshotGeneratedAt: s.snapshot.generatedAt,
          now,
        })
      : null;

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: apps.filter((a) => a.status === status).sort((a, b) => b.lastAt - a.lastAt),
  })).filter((g) => g.items.length > 0);

  return (
    <div className={`min-h-screen bg-neutral-100 dark:bg-neutral-950 ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Jobs Forge</h1>
          {generatedAt !== null && (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                stale
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                  : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              updated {relativeTime(generatedAt, now)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {s.connection === 'live' && (
              <button type="button" className={BTN} onClick={() => void s.refresh()} disabled={s.busy}>
                Refresh
              </button>
            )}
            {s.connection === 'needs-permission' && (
              <button type="button" className={BTN} onClick={() => void s.grant()} disabled={s.busy}>
                Reconnect file
              </button>
            )}
            <button type="button" className={BTN} onClick={toggle} aria-pressed={theme === 'dark'}>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        {stale && (
          <p role="status" className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            This snapshot is more than {STALE_HOURS} hours old. Ask an agent to re-run{' '}
            <code className="text-xs">JOBS-FORGE.md</code> before trusting it.
          </p>
        )}

        {s.connection === 'needs-permission' && (
          <p className={`mb-4 text-sm ${TEXT}`}>
            Your browser needs one click to re-read the file. Install this page as an app to skip this
            every time.
          </p>
        )}

        {!s.snapshot && s.connection === 'locked' && s.envelope ? (
          <UnlockPanel
            envelope={s.envelope}
            onUnlock={(pass) => void s.unlock(pass)}
            busy={s.busy}
            error={s.error}
            now={now}
          />
        ) : !s.snapshot ? (
          <ConnectPanel
            connection={s.connection}
            pickerSupported={s.pickerSupported}
            busy={s.busy}
            error={s.error}
            onConnect={() => void s.connect()}
            onImport={(f) => void s.importFile(f)}
            onDrop={(dt) => void s.importDrop(dt)}
          />
        ) : (
          <>
            <section aria-label="Summary" className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <KpiTile label="Needs you" value={needsYou.length} tone="urgent" />
              <KpiTile label="Live" value={live.length} />
              <KpiTile label="Interviewing" value={apps.filter((a) => a.status === 'interviewing').length} />
              <KpiTile label="Tracked" value={apps.length} />
            </section>

            {activity.nudge && (
              <p role="status" className="mb-5 rounded-md bg-neutral-200 px-3 py-2 text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                No new application in{' '}
                <strong className="tabular-nums">{activity.daysSinceLastApplication} days</strong>
                {activity.lastApplicationCompany ? ` - the last one was ${activity.lastApplicationCompany}.` : '.'}{' '}
                <span className={MUTED}>
                  {activity.appliedLast30} in the last 30 days.
                </span>
              </p>
            )}

            {/* The whole reason this page exists. */}
            <section aria-labelledby="needs-you" className="mb-6">
              <h2 id="needs-you" className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Needs you
              </h2>
              {needsYou.length === 0 ? (
                <div className={`${CARD} px-3 py-4 text-sm ${MUTED}`}>
                  Nothing is waiting on you right now.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border-2 border-amber-300 bg-white dark:border-amber-800 dark:bg-neutral-800">
                  <ul>
                    {needsYou.map(({ app, reason }) => (
                      <ApplicationRow key={app.id} app={app} now={now} reason={reason} allApps={apps} />
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {grouped
              .filter((g) => showClosed || !CLOSED_STATUSES.has(g.status))
              .map((g) => (
                <StatusSection key={g.status} status={g.status} items={g.items} now={now} allApps={apps} />
              ))}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ManualAddForm
                key={manualAddKey}
                initial={reviewPrefill ?? undefined}
                onDone={() => setReviewPrefill(null)}
              />
              <button type="button" className={BTN} onClick={() => setShowClosed((v) => !v)} aria-pressed={showClosed}>
                {showClosed ? 'Hide' : 'Show'} closed ({apps.filter((a) => CLOSED_STATUSES.has(a.status)).length})
              </button>
              <button type="button" className={BTN} onClick={() => setShowExcluded((v) => !v)} aria-pressed={showExcluded}>
                {showExcluded ? 'Hide' : 'Show'} filtered mail ({result?.excluded.length ?? 0})
              </button>
              <button
                type="button"
                className={BTN}
                onClick={() => downloadCsv(apps)}
                disabled={apps.length === 0}
              >
                Export CSV
              </button>
              <button type="button" className={BTN} onClick={() => void s.disconnect()}>
                Disconnect file
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {labelPlan && (
                <GmailSyncPanel
                  labelPlan={labelPlan}
                  applications={apps}
                  followUpStaleDays={settings.interviewSilenceDays}
                  now={now}
                />
              )}
              {s.snapshot && <PublishPanel snapshot={s.snapshot} />}
              <AnalyticsPanel applications={apps} />
              <SettingsPanel />
            </div>

            {result && (
              <ReviewDrawer
                threads={result.review}
                onAdd={(prefill) => {
                  setReviewPrefill(prefill);
                  setManualAddKey((k) => k + 1);
                }}
              />
            )}

            {showExcluded && result && (
              <section aria-labelledby="excluded" className="mt-6">
                <h2 id="excluded" className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Filtered as noise ({result.excluded.length})
                </h2>
                <p className={`mb-2 text-xs ${MUTED}`}>
                  Shown so a wrong exclusion is discoverable rather than invisible.
                </p>
                <div className={`${CARD} max-h-96 overflow-auto`}>
                  <ul>
                    {result.excluded.map((t) => (
                      <ThreadRow key={t.threadId} t={t} />
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {s.warnings.length > 0 && (
              <details className="mt-6">
                <summary className={`cursor-pointer text-xs ${MUTED}`}>
                  {s.warnings.length} note{s.warnings.length === 1 ? '' : 's'} about this snapshot
                </summary>
                <ul className={`mt-2 list-disc space-y-1 pl-5 text-xs ${MUTED}`}>
                  {s.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}

            <p className={`mt-8 text-xs ${MUTED}`}>
              Source: {s.meta?.name ?? 'imported file'} &middot;{' '}
              {s.snapshot.window.since.slice(0, 10)} to {s.snapshot.window.until.slice(0, 10)} &middot;{' '}
              {result?.counts.threads ?? 0} threads scanned
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusSection({ status, items, now, allApps }: { status: JobStatus; items: Application[]; now: number; allApps: Application[] }) {
  return (
    <section aria-labelledby={`g-${status}`} className="mb-5">
      <h2 id={`g-${status}`} className="mb-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {STATUS_LABELS[status]}{' '}
        <span className="font-normal tabular-nums text-neutral-400">{items.length}</span>
      </h2>
      <p className={`mb-2 text-xs ${MUTED}`}>{STATUS_BLURBS[status]}</p>
      <div className={`${CARD} overflow-hidden`}>
        <ul>
          {items.map((a) => (
            <ApplicationRow key={a.id} app={a} now={now} allApps={allApps} />
          ))}
        </ul>
      </div>
    </section>
  );
}

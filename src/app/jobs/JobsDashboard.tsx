'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { useMounted } from '@/lib/useMounted';
import { useTheme } from '@/lib/useTheme';
import { buildApplications } from '@/lib/jobs';
import { summariseActivity } from '@/lib/jobs/activity';
import { composeBoard, type ChipFilter } from '@/lib/jobs/board';
import { useBoardStore, type RailPanel as RailPanelId } from '@/lib/jobs/boardStore';
import { downloadCsv } from '@/lib/jobs/csv';
import { buildLabelPlan, threadLabelsFromSnapshot } from '@/lib/jobs/labelPlan';
import { CLOSED_STATUSES, STATUS_LABELS } from '@/lib/jobs/labels';
import { useNow } from '@/lib/jobs/useNow';
import { useOverridesStore } from '@/lib/jobs/overridesStore';
import { isCustomised } from '@/lib/jobs/settings';
import { useSettingsStore } from '@/lib/jobs/settingsStore';
import { useSnapshot } from '@/lib/jobs/useSnapshot';
import { reconcileOverrides } from '@/lib/jobs';
import type { Application, JobStatus } from '@/lib/jobs/types';
import { CARD, MUTED } from './components/ui';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { Board } from './components/Board';
import { StackBoard } from './components/StackBoard';
import { Banners } from './components/Banners';
import { ConnectPanel } from './components/ConnectPanel';
import { GmailSyncPanel } from './components/GmailSyncPanel';
import { ManualAddForm } from './components/ManualAddForm';
import { PublishPanel } from './components/PublishPanel';
import { Rail, type RailSection } from './components/Rail';
import { RailPanel } from './components/RailPanel';
import { Ribbon } from './components/Ribbon';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';
import { UnlockPanel } from './components/UnlockPanel';

/** Beyond this the dashboard is probably lying, so say so loudly. */
const STALE_HOURS = 36;

export function JobsDashboard() {
  const mounted = useMounted();
  // Safe to read below the `!mounted` guard: the server and the first client
  // render both paint the loading state, so matchMedia is never consulted
  // during hydration. See src/lib/useMediaQuery.ts.
  const desktop = useIsDesktop();
  const { theme, toggle } = useTheme();
  const s = useSnapshot();

  const railOpen = useBoardStore((st) => st.railOpen);
  const railPanel = useBoardStore((st) => st.railPanel);
  const showClosed = useBoardStore((st) => st.showClosed);
  const showFiltered = useBoardStore((st) => st.showFiltered);
  const toggleRail = useBoardStore((st) => st.toggleRail);
  const setRailPanel = useBoardStore((st) => st.setRailPanel);
  const setShowClosed = useBoardStore((st) => st.setShowClosed);
  const setShowFiltered = useBoardStore((st) => st.setShowFiltered);
  const collapsedLanes = useBoardStore((st) => st.collapsedLanes);
  const toggleLane = useBoardStore((st) => st.toggleLane);

  // Ephemeral by intent: a filter is a momentary act of looking. Persisting it
  // means opening the app to 3 of 40 applications with no memory of why.
  const [filter, setFilter] = useState<ChipFilter>('tracked');
  const [addOpen, setAddOpen] = useState(false);
  // Remounting ManualAddForm with a fresh key + prefill is simpler and safer
  // than lifting its internal company/role state up here.
  const [reviewPrefill, setReviewPrefill] = useState<{ company: string; role?: string } | null>(null);
  const [manualAddKey, setManualAddKey] = useState(0);
  // Announced on a status change. A card re-parents into a different lane the
  // instant you pick a status, and Menu.close() deliberately does not move
  // focus, so without this the only feedback is a card vanishing from under
  // the pointer.
  const [announcement, setAnnouncement] = useState('');

  const now = useNow();

  const overrides = useOverridesStore((st) => st.overrides);
  const replaceOverrides = useOverridesStore((st) => st.replaceOverrides);
  const setStatusOverride = useOverridesStore((st) => st.setStatus);
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
  const activity = summariseActivity(apps, settings.applyNudgeDays, now);

  const board = composeBoard({
    applications: apps,
    excluded: result?.excluded ?? [],
    review: result?.review ?? [],
    now,
    settings,
    filter,
    showClosed,
    showFiltered,
  });

  // Built from exactly the applications and "Needs you" set rendered on the
  // board, so the exported plan can never disagree with what is on screen.
  const labelPlan =
    result && s.snapshot
      ? buildLabelPlan({
          applications: apps,
          threadLabels: threadLabelsFromSnapshot(s.snapshot.threads),
          needsYouIds: new Set(
            board.items.filter((i) => i.needsYouReason !== null).map((i) => i.app.id)
          ),
          snapshotGeneratedAt: s.snapshot.generatedAt,
          now,
        })
      : null;

  const sections: RailSection[] = [
    { id: 'board', label: 'Board', mono: 'Bd' },
    { id: 'analytics', label: 'Analytics', mono: 'An' },
    {
      id: 'thresholds',
      label: 'Thresholds',
      mono: 'Th',
      badge: isCustomised(settings) ? '(custom)' : undefined,
    },
    { id: 'publish', label: 'Publish for phone', mono: 'Pu' },
    {
      id: 'gmail',
      label: 'Gmail sync',
      mono: 'Gm',
      badge: labelPlan && labelPlan.changes.length > 0 ? labelPlan.changes.length : undefined,
    },
  ];

  const closedCount = apps.filter((a) => CLOSED_STATUSES.has(a.status)).length;

  const addFromReview = (prefill: { company: string; role?: string }) => {
    setReviewPrefill(prefill);
    setManualAddKey((k) => k + 1);
    setAddOpen(true);
  };

  const changeStatus = (app: Application, next: JobStatus) => {
    setStatusOverride(app.id, next);
    // Moving a card to a closed status sends it to a lane that only exists
    // while "Show closed" is on, so the card would visibly disappear the
    // moment you acted on it - which reads as data loss rather than as a
    // successful move. Reveal the destination instead.
    if (CLOSED_STATUSES.has(next) && !showClosed) setShowClosed(true);
    setAnnouncement(`Moved ${app.company ?? 'Unknown company'} to ${STATUS_LABELS[next]}.`);
  };

  return (
    // The .dark class lives here rather than on <html> - this route owns its
    // own theme - which is exactly why nothing in this tree may be portalled
    // to document.body: it would render outside this class and come out
    // light. Menu is absolute-positioned for that reason.
    <div
      className={`flex h-dvh flex-col overflow-hidden bg-neutral-100 dark:bg-neutral-950 ${
        theme === 'dark' ? 'dark' : ''
      }`}
    >
      {!s.snapshot ? (
        <GatedShell theme={theme} onToggleTheme={toggle}>
          {s.connection === 'locked' && s.envelope ? (
            <UnlockPanel
              envelope={s.envelope}
              onUnlock={(pass) => void s.unlock(pass)}
              busy={s.busy}
              error={s.error}
              now={now}
            />
          ) : (
            <ConnectPanel
              connection={s.connection}
              pickerSupported={s.pickerSupported}
              busy={s.busy}
              error={s.error}
              onConnect={() => void s.connect()}
              onImport={(f) => void s.importFile(f)}
              onDrop={(dt) => void s.importDrop(dt)}
              now={now}
            />
          )}
        </GatedShell>
      ) : (
        <>
          <Ribbon
            generatedAt={generatedAt}
            now={now}
            stale={stale}
            staleHours={STALE_HOURS}
            counts={board.counts}
            filter={filter}
            onFilter={setFilter}
            closedCount={closedCount}
            filteredCount={result?.excluded.length ?? 0}
            showClosed={showClosed}
            showFiltered={showFiltered}
            onToggleClosed={() => setShowClosed(!showClosed)}
            onToggleFiltered={() => setShowFiltered(!showFiltered)}
            addOpen={addOpen}
            onToggleAdd={() => setAddOpen((v) => !v)}
            canRefresh={s.connection === 'live'}
            canGrant={s.connection === 'needs-permission'}
            busy={s.busy}
            onRefresh={() => void s.refresh()}
            onGrant={() => void s.grant()}
            onExportCsv={() => downloadCsv(apps)}
            canExportCsv={apps.length > 0}
            onDisconnect={() => void s.disconnect()}
            warnings={s.warnings}
            theme={theme}
            onToggleTheme={toggle}
            desktop={desktop}
            sections={sections}
            activeSection={railPanel}
            onSelectSection={(id) => setRailPanel(id as RailPanelId)}
          />

          {addOpen && (
            <div
              id="add-application-strip"
              className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-700"
            >
              <ManualAddForm
                key={manualAddKey}
                initial={reviewPrefill ?? undefined}
                onDone={() => {
                  setReviewPrefill(null);
                  setAddOpen(false);
                }}
              />
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            {desktop && (
              <Rail
                sections={sections}
                active={railPanel}
                onSelect={setRailPanel}
                open={railOpen}
                onToggleOpen={toggleRail}
              />
            )}

            {/* min-w-0/min-h-0 are load-bearing: without them a scrolling
                child grows this cell instead of scrolling inside it. */}
            <main className="flex min-h-0 min-w-0 flex-1 flex-col">
              <Banners
                stale={stale}
                staleHours={STALE_HOURS}
                needsPermission={s.connection === 'needs-permission'}
                activity={activity}
                until={s.snapshot.window.until}
                since={s.snapshot.window.since}
                mailbox={s.snapshot.mailbox}
                now={now}
              />

              {railPanel === 'board' ? (
                board.counts.tracked === 0 ? (
                  <div className="px-3 py-3">
                    <div className={`${CARD} px-3 py-4 text-sm ${MUTED}`}>Nothing tracked yet.</div>
                  </div>
                ) : (
                  desktop ? (
                    <Board
                      lanes={board.lanes}
                      now={now}
                      allApps={apps}
                      isCollapsed={(id) => collapsedLanes.includes(id)}
                      onToggleLane={toggleLane}
                      onChangeStatus={changeStatus}
                      onAddFromReview={addFromReview}
                    />
                  ) : (
                    <StackBoard
                      lanes={board.lanes}
                      now={now}
                      allApps={apps}
                      onChangeStatus={changeStatus}
                      onAddFromReview={addFromReview}
                    />
                  )
                )
              ) : (
                <RailPanel
                  id={railPanel}
                  title={sections.find((x) => x.id === railPanel)?.label ?? ''}
                  onBack={() => setRailPanel('board')}
                >
                  {railPanel === 'analytics' && <AnalyticsPanel applications={apps} />}
                  {railPanel === 'thresholds' && <SettingsPanel />}
                  {railPanel === 'publish' && s.snapshot && <PublishPanel snapshot={s.snapshot} />}
                  {railPanel === 'gmail' && labelPlan && (
                    <GmailSyncPanel
                      labelPlan={labelPlan}
                      applications={apps}
                      followUpStaleDays={settings.interviewSilenceDays}
                      now={now}
                      until={s.snapshot.window.until}
                      since={s.snapshot.window.since}
                      mailbox={s.snapshot.mailbox}
                    />
                  )}
                </RailPanel>
              )}
            </main>
          </div>

          {/* The one live region on the page. Announces a card moving lanes,
              which is otherwise a silent re-parent. */}
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>

          <StatusBar
            fileName={s.meta?.name ?? 'imported file'}
            since={s.snapshot.window.since.slice(0, 10)}
            until={s.snapshot.window.until.slice(0, 10)}
            threadCount={result?.counts.threads ?? 0}
          />
        </>
      )}
    </div>
  );
}

/**
 * The connect and unlock states get a stripped ribbon and no rail: a
 * thirteen-lane shell wrapped around a single passphrase field would be
 * absurd, and none of the file actions mean anything before there is a file.
 */
function GatedShell({
  theme,
  onToggleTheme,
  children,
}: {
  theme: string;
  onToggleTheme: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
        <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Jobs Forge</h1>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          onClick={onToggleTheme}
          aria-pressed={theme === 'dark'}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
      <main className="min-h-0 flex-1 overflow-auto px-4 py-6">
        <div className="mx-auto max-w-2xl">{children}</div>
      </main>
    </>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lane as LaneModel } from '@/lib/jobs/board';
import type { Application, JobStatus } from '@/lib/jobs/types';
import { AppCard } from './AppCard';
import { ReviewHelp, ReviewList } from './ReviewList';
import { ThreadRow } from './parts';
import { CARD, MUTED } from './ui';

/**
 * The board below the `md` breakpoint: one lane at a time, chosen from a
 * scrolling row of chips.
 *
 * Thirteen 300px lanes at 375px wide is about 3900px of sideways swiping to
 * see everything, which is not a board so much as a corridor. Thirteen chips
 * at ~90px fit in one thumb-flick, and the lane you pick gets the whole
 * width - which the cards want anyway, since they were designed narrow to
 * survive a 300px column.
 *
 * Usefully, the phone case is also the simplest one: a phone only ever opens a
 * published, read-only snapshot, so there is no Refresh, no file handle and no
 * File System Access to account for here.
 */
export function StackBoard({
  lanes,
  now,
  allApps,
  onAddFromReview,
  onChangeStatus,
}: {
  lanes: LaneModel[];
  now: number;
  allApps: Application[];
  onAddFromReview: (prefill: { company: string; role?: string }) => void;
  onChangeStatus: (app: Application, next: JobStatus) => void;
}) {
  // Defaults to Needs you - the lane the whole page exists for.
  const [selected, setSelected] = useState<string>(lanes[0]?.id ?? '');
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const wantFocus = useRef(false);

  // A lane can disappear underneath the selection: hiding the closed lanes, or
  // dismissing the last review thread. Resolved at render time rather than
  // synced back through an effect, matching ReviewList's clamping.
  const active = lanes.find((l) => l.id === selected) ?? lanes[0];

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    chipRefs.current[selected]?.focus();
  }, [selected]);

  const move = (delta: number) => {
    const i = lanes.findIndex((l) => l.id === active?.id);
    const next = lanes[(i + delta + lanes.length) % lanes.length];
    if (!next) return;
    wantFocus.current = true;
    setSelected(next.id);
  };

  if (!active) return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label="Lanes"
        aria-orientation="horizontal"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            move(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            move(-1);
          }
        }}
        className="flex shrink-0 gap-1.5 overflow-x-auto overscroll-x-contain border-b border-neutral-200 px-3 py-2 dark:border-neutral-700"
      >
        {lanes.map((l) => {
          const on = l.id === active.id;
          return (
            <button
              key={l.id}
              ref={(el) => {
                chipRefs.current[l.id] = el;
              }}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls="stack-lane"
              tabIndex={on ? 0 : -1}
              onClick={() => setSelected(l.id)}
              aria-label={`${l.title}, ${l.count}`}
              title={l.blurb}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                on
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
              }`}
            >
              <span aria-hidden="true">{l.title}</span>
              <span aria-hidden="true" className="tabular-nums opacity-70">
                {l.count}
              </span>
            </button>
          );
        })}
      </div>

      <section
        id="stack-lane"
        role="tabpanel"
        aria-label={`${active.title}, ${active.count}`}
        tabIndex={0}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-3"
      >
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {active.title}{' '}
          <span className="font-normal tabular-nums text-neutral-400">{active.count}</span>
        </h2>
        <p className={`mt-0.5 text-xs leading-snug ${MUTED}`}>{active.blurb}</p>
        {active.kind === 'review' && (
          <p className={`mt-1 text-xs leading-snug ${MUTED}`}>
            <ReviewHelp />
          </p>
        )}

        {active.count === 0 ? (
          <p className={`mt-3 rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-sm dark:border-neutral-700 ${MUTED}`}>
            Nothing in this lane.
          </p>
        ) : (
          <div className={`mt-2 ${CARD} overflow-hidden`}>
            <StackBody
              lane={active}
              now={now}
              allApps={allApps}
              onAddFromReview={onAddFromReview}
              onChangeStatus={onChangeStatus}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function StackBody({
  lane,
  now,
  allApps,
  onAddFromReview,
  onChangeStatus,
}: {
  lane: LaneModel;
  now: number;
  allApps: Application[];
  onAddFromReview: (prefill: { company: string; role?: string }) => void;
  onChangeStatus: (app: Application, next: JobStatus) => void;
}) {
  if (lane.kind === 'review') {
    return <ReviewList threads={lane.threads} onAdd={onAddFromReview} />;
  }
  if (lane.kind === 'filtered') {
    return (
      <ul>
        {lane.threads.map((t) => (
          <ThreadRow key={t.threadId} t={t} />
        ))}
      </ul>
    );
  }
  return (
    <ul>
      {lane.items.map((item) => (
        <AppCard
          key={item.app.id}
          item={item}
          now={now}
          allApps={allApps}
          inNeedsYouLane={lane.kind === 'needs_you'}
          onChangeStatus={onChangeStatus}
        />
      ))}
    </ul>
  );
}

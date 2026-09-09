import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LabelPlan } from './labelPlan';
import {
  ATS_DOMAINS,
  INLINE_PLAN_LIMIT,
  buildLabelApplyPrompt,
  buildRefreshPrompt,
  deltaDays,
} from './syncPrompt';

const NOW = Date.parse('2026-09-08T12:00:00Z');
const DAY = 86400_000;

const refresh = (o: Partial<Parameters<typeof buildRefreshPrompt>[0]> = {}) =>
  buildRefreshPrompt({ until: '2026-09-07T12:00:00Z', since: '2026-06-10T00:00:00Z', now: NOW, ...o });

/**
 * Whitespace-collapsed, for asserting on prose.
 *
 * The prompts are hard-wrapped for readability, so a sentence can break across
 * lines anywhere. Pinning a test to the current wrap points would make every
 * reword a test failure for no reason; pinning it to the words does not.
 */
const flat = (s: string) => s.replace(/\s+/g, ' ');

function plan(changeCount: number): LabelPlan {
  return {
    kind: 'jobs-forge-label-plan',
    version: 1,
    generatedAt: '2026-09-08T12:00:00Z',
    snapshotGeneratedAt: '2026-09-08T11:00:00Z',
    labels: ['JobsForge/Active'],
    changes: Array.from({ length: changeCount }, (_, i) => ({
      threadId: `t${i}`,
      company: `Company ${i}`,
      role: 'Product Manager',
      current: [],
      desired: 'JobsForge/Active' as const,
      add: ['JobsForge/Active' as const],
      remove: [],
      reason: 'Live, submitted, nothing needed right now.',
    })),
    unchanged: 3,
    counts: {
      'JobsForge/Needs-You': 1,
      'JobsForge/Interviewing': 0,
      'JobsForge/Active': changeCount,
      'JobsForge/Lapsed': 0,
      'JobsForge/Closed': 0,
    },
    skippedManual: 0,
  };
}

describe('deltaDays', () => {
  it('asks for a delta, not a full backfill, when a snapshot exists', () => {
    expect(deltaDays('2026-09-07T12:00:00Z', NOW)).toBe(1);
    expect(deltaDays(new Date(NOW - 5.2 * DAY).toISOString(), NOW)).toBe(6); // rounds up
  });

  it('falls back to 90 days with no snapshot, an unparseable date, or an ancient one', () => {
    expect(deltaDays(null, NOW)).toBe(90);
    expect(deltaDays('not a date', NOW)).toBe(90);
    expect(deltaDays(new Date(NOW - 500 * DAY).toISOString(), NOW)).toBe(90);
  });

  it('never asks for less than a day, even for a snapshot written in the future', () => {
    // Clock skew between the writing agent and the browser is real; a 0d or
    // negative window would return nothing and read as "no new mail".
    expect(deltaDays(new Date(NOW + 3 * DAY).toISOString(), NOW)).toBe(1);
    expect(deltaDays(new Date(NOW).toISOString(), NOW)).toBe(1);
  });
});

describe('buildRefreshPrompt: self-containment', () => {
  it('never tells the reader to go and read JOBS-FORGE.md', () => {
    // The entire reason this module exists: the old panel text was useless on
    // a machine without the repo checked out.
    expect(refresh()).not.toMatch(/JOBS-FORGE/);
    expect(refresh({ until: null })).not.toMatch(/JOBS-FORGE/);
  });

  it('names the output path and demands an in-place overwrite', () => {
    const p = refresh();
    expect(p).toContain('~/Downloads/jobs-forge-snapshot.json');
    expect(p).toMatch(/Never write-then-rename/);
    expect(flat(p)).toMatch(/invalidates the file handle/);
  });

  it('carries every ATS domain from query A', () => {
    const p = refresh();
    for (const d of ATS_DOMAINS) expect(p).toContain(`from:${d}`);
    expect(ATS_DOMAINS).toHaveLength(20);
  });

  it('includes all three queries, C included', () => {
    const p = refresh();
    expect(p).toContain('Query A');
    expect(p).toContain('Query B');
    expect(p).toContain('Query C');
    expect(p).toMatch(/in:sent/);
    expect(p).toMatch(/Do not skip/);
  });

  it('scopes the queries to the computed delta', () => {
    expect(refresh()).toContain('newer_than:1d');
    expect(refresh({ until: null })).toContain('newer_than:90d');
  });

  it('carries the snapshot schema with the fields the pipeline depends on', () => {
    const p = refresh();
    for (const key of [
      '"kind": "jobs-forge-snapshot"',
      '"window"',
      '"since"',
      '"until"',
      '"snippet"',
      '"bodyText"',
      '"fromMe"',
      '"hasUnsubscribe"',
      '"hints"',
      '"threads"',
    ]) {
      expect(p).toContain(key);
    }
  });

  it('explains why snippet is mandatory, with the real example', () => {
    // A prompt that just lists the field gets a prompt-shaped answer; the
    // Workable case is what makes an agent actually include it.
    expect(refresh()).toMatch(/always include it/i);
    expect(refresh()).toMatch(/Workable/);
  });

  it('carries the hint format and the cases that require one', () => {
    const p = refresh();
    expect(p).toContain('applicationKey');
    expect(p).toContain('distinctFrom');
    expect(p).toContain('confidence');
    expect(p).toContain('eventOverrides');
    expect(p).toContain('deadlineAt');
    expect(p).toContain('interviewAt');
    expect(p).toMatch(/Ashby/);
    expect(p).toMatch(/Keka/);
    expect(p).toMatch(/interview_missed/);
  });

  it('keeps the two distinctions the classifier cannot recover from', () => {
    const p = refresh();
    expect(flat(p)).toMatch(/`rejection` vs `role_withdrawn`/);
    expect(flat(p)).toMatch(/`nudge` vs `action_required`/);
  });

  it('states every hard rule, each with its reason', () => {
    const p = refresh();
    expect(p).toMatch(/Never invent a company or a role/);
    expect(p).toMatch(/Always set `window.since` and `window.until`/);
    expect(p).toMatch(/Read-only against Gmail/);
    expect(p).toMatch(/Never guess a rejection/);
    expect(p).toMatch(/Merge, do not replace/);
    // The reasons, not just the rules.
    expect(flat(p)).toMatch(/a guessed one is a lie/);
    expect(flat(p)).toMatch(/report silence as being ghosted/);
    expect(flat(p)).toMatch(/I stop chasing it/);
  });

  it('embeds the existing since as a floor to preserve', () => {
    expect(refresh()).toContain('2026-06-10T00:00:00Z');
    expect(flat(refresh())).toMatch(/discard history/);
  });

  it('omits the floor sentence when there is no snapshot to preserve', () => {
    expect(refresh({ until: null, since: null })).not.toMatch(/floor already established/);
  });

  it('asks for re-fetch of still-open threads only when merging into a file', () => {
    // A rejection usually arrives on a brand-new thread, so a delta refresh
    // that only looks at new mail would never notice a status change.
    expect(flat(refresh())).toMatch(/still open/);
    expect(refresh({ until: null })).not.toMatch(/still open/);
  });

  it('closes with a refusal path rather than inviting a fabricated snapshot', () => {
    const p = refresh();
    expect(flat(p)).toMatch(/If you cannot read this Gmail account, say so plainly and stop/);
    expect(flat(p)).toMatch(/an invented file is worse than a stale one/);
  });

  it('mentions the mailbox when known, and stays valid without it', () => {
    expect(refresh({ mailbox: 'me@example.com' })).toContain('me@example.com');
    expect(flat(refresh({ mailbox: undefined }))).toMatch(/You have access to my Gmail\./);
  });

  it('reads as a first backfill when there is no snapshot', () => {
    expect(refresh({ until: null })).toMatch(/90-day backfill/);
  });

  it('pluralises the day count', () => {
    expect(flat(refresh())).toMatch(/last 1 day\b/);
    expect(flat(refresh({ until: '2026-09-05T12:00:00Z' }))).toMatch(/last 3 days\b/);
  });
});

describe('buildLabelApplyPrompt', () => {
  it('embeds a small plan inline so nothing has to be transferred', () => {
    const p = buildLabelApplyPrompt({ plan: plan(3) });
    expect(p).toContain('"kind": "jobs-forge-label-plan"');
    expect(p).toContain('"threadId": "t0"');
    expect(p).not.toMatch(/Export label plan/);
  });

  it('points at the exported file once the plan is too large to paste', () => {
    const p = buildLabelApplyPrompt({ plan: plan(INLINE_PLAN_LIMIT + 1) });
    expect(p).toMatch(/Export label plan/);
    expect(p).toContain('~/Downloads/jobs-forge-label-plan.json');
    expect(p).not.toContain('"threadId": "t0"');
  });

  it('inlines exactly at the limit', () => {
    expect(buildLabelApplyPrompt({ plan: plan(INLINE_PLAN_LIMIT) })).toContain('"threadId": "t0"');
  });

  it('tells the agent not to recompute the plan', () => {
    for (const n of [3, 100]) {
      expect(flat(buildLabelApplyPrompt({ plan: plan(n) }))).toMatch(/do not recompute it/);
    }
  });

  it('carries the staleness check with the real timestamp', () => {
    const p = buildLabelApplyPrompt({ plan: plan(2) });
    expect(p).toContain('2026-09-08T11:00:00Z');
    expect(flat(p)).toMatch(/If the snapshot is newer than the plan, stop and say so/);
  });

  it('states that the API takes ids, not names', () => {
    expect(flat(buildLabelApplyPrompt({ plan: plan(2) }))).toMatch(/takes label IDs, not names/);
  });

  it('requires adds before removes, so a thread is never unlabelled', () => {
    const p = buildLabelApplyPrompt({ plan: plan(2) });
    expect(p).toMatch(/Adds before removes/);
    expect(flat(p)).toMatch(/never briefly left unlabelled/);
  });

  it('lists all five labels and says they are mutually exclusive', () => {
    const p = buildLabelApplyPrompt({ plan: plan(2) });
    for (const l of ['Needs-You', 'Interviewing', 'Active', 'Lapsed', 'Closed']) {
      expect(p).toContain(`JobsForge/${l}`);
    }
    expect(p).toMatch(/mutually exclusive/);
  });

  it('carries every prohibition', () => {
    const p = buildLabelApplyPrompt({ plan: plan(2) });
    expect(flat(p)).toMatch(/Never remove a label that is not in that thread's `remove` list/);
    expect(p).toMatch(/Never delete any label except a `JobsForge\/\*` one/);
    expect(flat(p)).toMatch(/Never label a thread that does not appear in `changes`/);
    expect(p).toMatch(/Never trash, spam, or archive anything/);
  });

  it('reports the real change and unchanged counts, pluralised', () => {
    expect(buildLabelApplyPrompt({ plan: plan(1) })).toMatch(/1 thread changing/);
    expect(buildLabelApplyPrompt({ plan: plan(7) })).toMatch(/7 threads changing/);
    expect(buildLabelApplyPrompt({ plan: plan(7) })).toMatch(/3 already correct/);
  });

  it('demands an explicit yes rather than proceeding on silence', () => {
    expect(flat(buildLabelApplyPrompt({ plan: plan(2) }))).toMatch(/Do not proceed on silence/);
  });
});

describe('the prompts stay in step with JOBS-FORGE.md', () => {
  // This module deliberately duplicates the runbook, because a pasted prompt
  // cannot reference a file the reader does not have. These assertions are the
  // cost of that decision: if a query or a domain changes in the runbook and
  // not here, the copy has rotted into a subset and this fails.
  const runbook = readFileSync(new URL('../../../JOBS-FORGE.md', import.meta.url), 'utf8');

  it('covers every ATS domain the runbook lists in query A', () => {
    const inRunbook = [...runbook.matchAll(/from:([a-z0-9.-]+\.[a-z]{2,})/g)].map((m) => m[1]);
    expect(new Set(inRunbook).size).toBeGreaterThan(0);
    for (const d of new Set(inRunbook)) expect(ATS_DOMAINS).toContain(d);
  });

  it('covers every eventOverrides type the runbook declares valid', () => {
    const section = runbook.slice(runbook.indexOf('### Valid `eventOverrides[].type`'));
    const types = [...section.slice(0, 600).matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
    const p = refresh();
    for (const t of new Set(types)) expect(p).toContain(t);
  });

  it('covers every kind the runbook declares valid', () => {
    const section = runbook.slice(runbook.indexOf('### Valid `kind` values'));
    const kinds = [...section.slice(0, 400).matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
    const p = refresh();
    for (const k of new Set(kinds)) expect(p).toContain(k);
  });

  it('covers all five JobsForge labels the runbook defines', () => {
    const labels = [...runbook.matchAll(/`JobsForge\/([A-Za-z-]+)`/g)].map((m) => m[1]);
    const p = buildLabelApplyPrompt({ plan: plan(2) });
    for (const l of new Set(labels)) expect(p).toContain(`JobsForge/${l}`);
  });
});

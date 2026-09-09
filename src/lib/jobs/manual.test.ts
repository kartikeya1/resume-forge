import { describe, expect, it } from 'vitest';
import { buildApplications } from './index';
import { addManual, setStatus } from './overrides';
import { NOW } from './__fixtures__/mailbox';
import { emptyOverrides } from './types';
import type { JobsSnapshot } from './snapshot';

function snap(): JobsSnapshot {
  return {
    kind: 'jobs-forge-snapshot',
    version: 1,
    generatedAt: new Date(NOW).toISOString(),
    window: { since: '2026-06-01T00:00:00Z', until: new Date(NOW).toISOString() },
    threads: [],
    hints: [],
  };
}

describe('manual applications', () => {
  it('appears in the build output with no threads', () => {
    const { overrides } = addManual(emptyOverrides(), { company: 'Acme', role: 'PM', status: 'applied' }, NOW);
    const r = buildApplications(snap(), { now: NOW, overrides });
    expect(r.applications).toHaveLength(1);
    expect(r.applications[0]).toMatchObject({ company: 'Acme', role: 'PM', status: 'applied', threadIds: [] });
    expect(r.counts.applications).toBe(1);
  });

  it('a status field-override wins over the manual entry’s own status', () => {
    const { overrides, id } = addManual(emptyOverrides(), { company: 'Acme', status: 'applied' }, NOW);
    const edited = setStatus(overrides, id, 'offer');
    const r = buildApplications(snap(), { now: NOW, overrides: edited });
    expect(r.applications[0].status).toBe('offer');
  });

  it('does not run the derived status ladder over it', () => {
    const { overrides } = addManual(emptyOverrides(), { company: 'Acme', status: 'ghosted' }, NOW - 100 * 86_400_000);
    const r = buildApplications(snap(), { now: NOW, overrides });
    // 100 days old would normally push a THREAD-based application to ghosted
    // by rule R11, but a manual entry has no events for R11 to fire on - the
    // status stays exactly what the user chose.
    expect(r.applications[0].status).toBe('ghosted');
    expect(r.applications[0].statusRuleId).toBe('user-manual');
  });

  it('coexists with thread-derived applications', () => {
    const { overrides } = addManual(emptyOverrides(), { company: 'WhatsApp Co', status: 'lead' }, NOW);
    const r = buildApplications({ ...snap(), threads: [] }, { now: NOW, overrides });
    expect(r.applications.map((a) => a.company)).toContain('WhatsApp Co');
  });
});

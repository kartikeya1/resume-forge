import { describe, expect, it } from 'vitest';
import { coerceSettings, DEFAULT_SETTINGS, isCustomised, SETTING_KEYS, SETTING_LABELS, SETTING_UNITS, settingLimits } from './settings';
import { buildApplications } from './index';
import { NOW, T } from './__fixtures__/mailbox';
import type { JobsSnapshot } from './snapshot';

function snap(threads = [T.kora]): JobsSnapshot {
  return {
    kind: 'jobs-forge-snapshot', version: 1,
    generatedAt: new Date(NOW).toISOString(),
    window: { since: '2025-01-01T00:00:00Z', until: new Date(NOW).toISOString() },
    threads, hints: [],
  };
}

describe('coerceSettings', () => {
  it('returns the defaults for junk input', () => {
    expect(coerceSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(coerceSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('never lets NaN through into a date comparison', () => {
    // A NaN threshold would make every comparison false and silently mark live
    // applications ghosted - the exact failure this guards.
    const out = coerceSettings({ ghostDays: NaN, staleWarnDays: Infinity });
    expect(out.ghostDays).toBe(DEFAULT_SETTINGS.ghostDays);
    expect(out.staleWarnDays).toBe(DEFAULT_SETTINGS.staleWarnDays);
  });

  it('clamps to the documented bounds rather than rejecting', () => {
    expect(coerceSettings({ ghostDays: 0 }).ghostDays).toBe(settingLimits('ghostDays').min);
    expect(coerceSettings({ ghostDays: 99999 }).ghostDays).toBe(settingLimits('ghostDays').max);
  });

  it('rounds a fractional value', () => {
    expect(coerceSettings({ ghostDays: 30.7 }).ghostDays).toBe(31);
  });

  it('keeps a valid value untouched', () => {
    expect(coerceSettings({ ghostDays: 30 }).ghostDays).toBe(30);
  });

  it('ignores unknown keys instead of carrying them through', () => {
    const out = coerceSettings({ ghostDays: 30, somethingElse: 5 });
    expect(out).not.toHaveProperty('somethingElse');
  });
});

describe('metadata completeness', () => {
  // These Records are what the settings UI renders from, so a new setting
  // without a label or unit would ship as a blank row.
  it('every setting has a label and a unit', () => {
    for (const k of SETTING_KEYS) {
      expect(SETTING_LABELS[k]).toBeTruthy();
      expect(SETTING_UNITS[k]).toBeTruthy();
    }
  });

  it('isCustomised only fires once something actually moved', () => {
    expect(isCustomised(DEFAULT_SETTINGS)).toBe(false);
    expect(isCustomised({ ...DEFAULT_SETTINGS, ghostDays: 30 })).toBe(true);
  });
});

describe('settings actually change the verdict', () => {
  it('a lower ghostDays flips a quiet application to ghosted', () => {
    // Kora acked on 2026-07-03; NOW is 2026-09-08, so ~67 days quiet.
    const strict = buildApplications(snap(), { now: NOW, settings: { ...DEFAULT_SETTINGS, ghostDays: 30 } });
    const lenient = buildApplications(snap(), { now: NOW, settings: { ...DEFAULT_SETTINGS, ghostDays: 200 } });
    expect(strict.applications[0].status).toBe('ghosted');
    expect(lenient.applications[0].status).toBe('applied');
  });

  it('defaults to DEFAULT_SETTINGS when none are passed', () => {
    const implicit = buildApplications(snap(), { now: NOW });
    const explicit = buildApplications(snap(), { now: NOW, settings: DEFAULT_SETTINGS });
    expect(implicit.applications[0].status).toBe(explicit.applications[0].status);
  });
});

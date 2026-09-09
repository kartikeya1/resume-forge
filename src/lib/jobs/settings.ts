// User-tunable thresholds.
//
// Every number here was a hardcoded constant in Phase 0/1. They are the
// numbers that decide whether something is "ghosted" or merely quiet, and
// whether a stalled interview is worth chasing - which is a judgment about how
// aggressive a job search is, not a fact about email. So they belong to the
// user, not to the code.
//
// Kept pure and separate from the store so `deriveStatus` and `needsYouReason`
// stay node-testable with an explicit config argument.

export interface JobsSettings {
  /** Silence beyond this and they have dropped it -> `ghosted`. */
  ghostDays: number;
  /** Past this, an `applied` row starts saying how long it has been quiet. */
  staleWarnDays: number;
  /** Ignored nudges older than this and he has dropped it -> `lapsed`. */
  nudgeLapseDays: number;
  /** How long after a slot passes before a no-show is inferred. */
  interviewMissedGraceHours: number;
  /** An interview with no outcome for this long lands in "Needs you". */
  interviewSilenceDays: number;
  /** Past this, a lapsed application is history rather than a to-do. */
  lapsedActionableDays: number;
  /** No new application in this long and the dashboard says so. */
  applyNudgeDays: number;
}

export const DEFAULT_SETTINGS: JobsSettings = {
  ghostDays: 45,
  staleWarnDays: 14,
  nudgeLapseDays: 14,
  interviewMissedGraceHours: 12,
  interviewSilenceDays: 14,
  lapsedActionableDays: 60,
  applyNudgeDays: 7,
};

/** Bounds that keep a hand-typed value from producing nonsense downstream. */
const LIMITS: Record<keyof JobsSettings, { min: number; max: number }> = {
  ghostDays: { min: 7, max: 365 },
  staleWarnDays: { min: 1, max: 180 },
  nudgeLapseDays: { min: 1, max: 180 },
  interviewMissedGraceHours: { min: 1, max: 168 },
  interviewSilenceDays: { min: 1, max: 180 },
  lapsedActionableDays: { min: 7, max: 365 },
  applyNudgeDays: { min: 1, max: 90 },
};

export const SETTING_LABELS: Record<keyof JobsSettings, string> = {
  ghostDays: 'Treat silence as ghosted after',
  staleWarnDays: 'Warn that an application is quiet after',
  nudgeLapseDays: 'Treat ignored reminders as lapsed after',
  interviewMissedGraceHours: 'Assume a missed interview after',
  interviewSilenceDays: 'Chase an interview with no outcome after',
  lapsedActionableDays: 'Stop surfacing a lapsed application after',
  applyNudgeDays: 'Nudge me if I have not applied to anything in',
};

export const SETTING_UNITS: Record<keyof JobsSettings, 'days' | 'hours'> = {
  ghostDays: 'days',
  staleWarnDays: 'days',
  nudgeLapseDays: 'days',
  interviewMissedGraceHours: 'hours',
  interviewSilenceDays: 'days',
  lapsedActionableDays: 'days',
  applyNudgeDays: 'days',
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof JobsSettings)[];

/**
 * Clamps and repairs a settings object. Never throws and never returns a
 * partial: a bad persisted value falls back to its default rather than
 * propagating NaN into a date comparison, which would silently mark live
 * applications ghosted.
 */
export function coerceSettings(input: unknown): JobsSettings {
  const out = { ...DEFAULT_SETTINGS };
  if (typeof input !== 'object' || input === null) return out;
  const obj = input as Record<string, unknown>;
  for (const key of SETTING_KEYS) {
    const raw = obj[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const { min, max } = LIMITS[key];
    out[key] = Math.round(Math.min(max, Math.max(min, raw)));
  }
  return out;
}

export function settingLimits(key: keyof JobsSettings): { min: number; max: number } {
  return LIMITS[key];
}

/** True when the user has moved anything off the shipped defaults. */
export function isCustomised(s: JobsSettings): boolean {
  return SETTING_KEYS.some((k) => s[k] !== DEFAULT_SETTINGS[k]);
}

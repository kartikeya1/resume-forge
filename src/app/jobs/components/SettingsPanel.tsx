'use client';

import { useId } from 'react';
import {
  DEFAULT_SETTINGS, isCustomised, SETTING_KEYS, SETTING_LABELS, SETTING_UNITS, settingLimits,
  type JobsSettings,
} from '@/lib/jobs/settings';
import { useSettingsStore } from '@/lib/jobs/settingsStore';
import { BTN, CARD, MUTED } from './ui';

/**
 * The thresholds that decide "ghosted" vs "merely quiet". These are judgments
 * about how aggressive a search is, not facts about email, so they belong to
 * the user - and changing one re-derives every status immediately, because
 * buildApplications is pure and re-runs on every render.
 */
export function SettingsPanel() {
  const settings = useSettingsStore((s) => s.settings);
  const setSetting = useSettingsStore((s) => s.setSetting);
  const resetSettings = useSettingsStore((s) => s.resetSettings);
  const panelId = useId();


  return (
    <div id={panelId} className={`${CARD} w-full px-3 py-3`}>
      <p className={`mb-3 text-xs ${MUTED}`}>
        Every status on this page is re-derived the moment you change one of these.
      </p>
      <div className="space-y-2">
        {SETTING_KEYS.map((key) => (
          <SettingRow key={key} settingKey={key} settings={settings} onChange={setSetting} />
        ))}
      </div>
      {isCustomised(settings) && (
        <button type="button" className={`${BTN} mt-3`} onClick={resetSettings}>
          Reset to defaults
        </button>
      )}
    </div>
  );
}

function SettingRow({
  settingKey,
  settings,
  onChange,
}: {
  settingKey: keyof JobsSettings;
  settings: JobsSettings;
  onChange: (k: keyof JobsSettings, v: number) => void;
}) {
  const id = useId();
  const { min, max } = settingLimits(settingKey);
  const value = settings[settingKey];
  const isDefault = value === DEFAULT_SETTINGS[settingKey];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="min-w-0 flex-1 text-xs text-neutral-700 dark:text-neutral-200">
        {SETTING_LABELS[settingKey]}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(settingKey, n);
        }}
        className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:border-neutral-400 dark:focus:ring-neutral-400"
      />
      <span className={`w-10 text-xs ${MUTED}`}>{SETTING_UNITS[settingKey]}</span>
      <span className={`w-16 text-[10px] ${MUTED}`}>{isDefault ? 'default' : `was ${DEFAULT_SETTINGS[settingKey]}`}</span>
    </div>
  );
}

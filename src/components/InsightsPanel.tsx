'use client';

import { useMemo, useState } from 'react';
import { useResumeStore } from '@/lib/store';
import { analyze, type Analysis } from '@/lib/scoring';
import { deepAnalyze, type DeepAnalysis } from '@/lib/analysis';

function scoreColor(n: number): string {
  if (n >= 80) return 'text-emerald-600';
  if (n >= 60) return 'text-amber-600';
  return 'text-red-600';
}
function barColor(n: number): string {
  if (n >= 80) return 'bg-emerald-500';
  if (n >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function ScoreDial({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-center">
      <div className={`text-3xl font-bold tabular-nums ${value === null ? 'text-neutral-300' : scoreColor(value)}`}>
        {value === null ? '—' : value}
      </div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}

function Collapsible({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          <span className={`text-[10px] text-neutral-400 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
          {title}
        </span>
        {badge !== undefined && badge !== 0 && badge !== '' && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">{badge}</span>
        )}
      </button>
      {open && <div className="border-t border-neutral-100 px-3 py-3">{children}</div>}
    </div>
  );
}

function Breakdown({ analysis }: { analysis: Analysis }) {
  return (
    <div className="space-y-2">
      {analysis.breakdown.map((b) => (
        <div key={b.label}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-neutral-700">{b.label}</span>
            <span className={`font-semibold tabular-nums ${scoreColor(b.score)}`}>{b.score}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className={`h-full rounded-full ${barColor(b.score)}`} style={{ width: `${b.score}%` }} />
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-400">{b.detail}</div>
        </div>
      ))}
    </div>
  );
}

function Keywords({ analysis }: { analysis: Analysis }) {
  if (!analysis.keywords.length) {
    return <p className="text-xs text-neutral-400">Paste a job description below to extract keywords and check coverage.</p>;
  }
  const { critical, important, optional } = analysis.coverage;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2 text-[11px] font-medium">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">Critical {critical[0]}/{critical[1]}</span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">Important {important[0]}/{important[1]}</span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">Optional {optional[0]}/{optional[1]}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {analysis.keywords.map((k) => (
          <span
            key={k.canonical}
            title={`${k.tier} · ${k.present ? 'found in resume' : 'missing'}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
              k.present ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-neutral-200 bg-white text-neutral-400'
            }`}
          >
            <span>{k.present ? '✓' : '○'}</span>
            {k.term}
          </span>
        ))}
      </div>
    </div>
  );
}

function Actionables({ analysis }: { analysis: Analysis }) {
  const items = [...analysis.actionables].sort((a, b) => Number(a.done) - Number(b.done));
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div>
      <div className="mb-2 text-[11px] text-neutral-500">{doneCount}/{items.length} done</div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-2 text-xs">
            <span className={it.done ? 'text-emerald-500' : 'text-neutral-300'}>{it.done ? '☑' : '☐'}</span>
            <span className={it.done ? 'text-neutral-400 line-through' : 'text-neutral-700'}>
              {it.label}
              {it.source === 'jd' && !it.done ? <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500">JD</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const RATING_STYLE = {
  weak: 'border-red-200 bg-red-50 text-red-700',
  ok: 'border-amber-200 bg-amber-50 text-amber-700',
  strong: 'border-emerald-200 bg-emerald-50 text-emerald-700',
} as const;

function WritingIssues({ deep }: { deep: DeepAnalysis }) {
  const { flagged, repetitions } = deep;
  if (!flagged.length && !repetitions.length) {
    return <p className="text-xs text-emerald-600">No writing issues detected — every bullet reads strong. ✓</p>;
  }
  return (
    <div className="space-y-3">
      {repetitions.length > 0 && (
        <div className="rounded-md bg-neutral-50 p-2 text-xs text-neutral-600">
          <span className="font-medium">Repeated openers:</span>{' '}
          {repetitions.map((r) => `"${r.verb}" ×${r.count}`).join(', ')} — vary your action verbs.
        </div>
      )}
      <ul className="space-y-2">
        {flagged.map((f, i) => (
          <li key={i} className="rounded-md border border-neutral-200 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{f.section}</span>
              <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${RATING_STYLE[f.check.rating]}`}>{f.check.rating}</span>
            </div>
            <p className="mb-1 text-xs text-neutral-700">{f.text}</p>
            <ul className="space-y-0.5">
              {f.check.reasons.map((r, j) => (
                <li key={j} className="text-[11px] text-neutral-500">• {r}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-2.5 py-2">
      <div className="text-lg font-semibold tabular-nums text-neutral-800">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-400">{label}</div>
      {hint && <div className="mt-0.5 text-[10px] text-neutral-400">{hint}</div>}
    </div>
  );
}

function AnalyticsView({ deep }: { deep: DeepAnalysis }) {
  const a = deep.analytics;
  const timeIdeal = a.readingTimeSec >= 20 && a.readingTimeSec <= 35;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Words" value={a.words} />
      <Stat label="Bullets" value={a.bullets} />
      <Stat label="Avg bullet" value={`${a.avgBulletWords}w`} hint={`longest ${a.longestBulletWords}w`} />
      <Stat label="Quantified" value={`${a.bulletsWithNumbers}/${a.bullets}`} hint="bullets with numbers" />
      <Stat label="Action verbs" value={a.actionVerbs} />
      <Stat label="Passive" value={a.passiveSentences} hint="sentences" />
      <Stat label="Readability" value={`Grade ${a.readabilityGrade}`} />
      <div className={`rounded-md border px-2.5 py-2 ${timeIdeal ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className={`text-lg font-semibold tabular-nums ${timeIdeal ? 'text-emerald-700' : 'text-amber-700'}`}>{a.readingTimeSec}s</div>
        <div className="text-[10px] uppercase tracking-wide text-neutral-400">Recruiter skim</div>
        <div className="mt-0.5 text-[10px] text-neutral-400">ideal 20–35s</div>
      </div>
    </div>
  );
}

function BalanceBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-neutral-600">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-neutral-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StructureView({ deep }: { deep: DeepAnalysis }) {
  const s = deep.structure;
  const list = (items: string[], color = 'text-neutral-600') =>
    items.map((t, i) => (
      <li key={i} className={`text-xs ${color}`}>• {t}</li>
    ));
  const clean = !s.missingSections.length && !s.timelineGaps.length && !s.lengthWarnings.length && !s.orderingSuggestions.length;
  return (
    <div className="space-y-3">
      {s.missingSections.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-neutral-500">Missing / thin sections</div>
          <ul className="space-y-0.5">{list(s.missingSections, 'text-red-600')}</ul>
        </div>
      )}
      {s.lengthWarnings.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-neutral-500">Length balance</div>
          <ul className="space-y-0.5">{list(s.lengthWarnings, 'text-amber-700')}</ul>
        </div>
      )}
      {s.timelineGaps.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-neutral-500">Timeline gaps</div>
          <ul className="space-y-0.5">{list(s.timelineGaps, 'text-amber-700')}</ul>
        </div>
      )}
      {s.orderingSuggestions.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-neutral-500">Section order</div>
          <ul className="space-y-0.5">{list(s.orderingSuggestions)}</ul>
        </div>
      )}
      <div>
        <div className="mb-1 text-[11px] font-medium text-neutral-500">Content balance</div>
        <div className="space-y-1.5">
          <BalanceBar label="Experience" pct={s.balance.experience} />
          <BalanceBar label="Projects" pct={s.balance.projects} />
          <BalanceBar label="Skills" pct={s.balance.skills} />
        </div>
      </div>
      {clean && <p className="text-xs text-emerald-600">Structure looks solid. ✓</p>}
    </div>
  );
}

function SkillGap({ deep }: { deep: DeepAnalysis }) {
  if (!deep.jd) return <p className="text-xs text-neutral-400">Paste a job description to see the skill gap.</p>;
  const { skillGap, technical, soft } = deep.jd;
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-[11px] font-medium text-neutral-500">Skill gap ({skillGap.length} missing)</div>
        {skillGap.length ? (
          <div className="flex flex-wrap gap-1.5">
            {skillGap.map((t) => (
              <span key={t} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-700">{t}</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-600">You cover every required/preferred keyword. ✓</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-500">
        <div>Technical keywords: {technical.filter((k) => k.present).length}/{technical.length}</div>
        <div>Soft skills: {soft.filter((k) => k.present).length}/{soft.length}</div>
      </div>
    </div>
  );
}

export function InsightsPanel() {
  const resume = useResumeStore((s) => s.resume);
  const jd = useResumeStore((s) => s.jobDescription);
  const setJd = useResumeStore((s) => s.setJobDescription);

  const analysis = useMemo(() => analyze(resume, jd), [resume, jd]);
  const deep = useMemo(() => deepAnalyze(resume, jd), [resume, jd]);

  const doneCount = analysis.actionables.filter((a) => a.done).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <ScoreDial label="ATS Score" value={analysis.atsScore} />
        <ScoreDial label="JD Match" value={analysis.jdMatchScore} />
      </div>

      <Collapsible title="Health dashboard" defaultOpen>
        <Breakdown analysis={analysis} />
      </Collapsible>

      <Collapsible title="Writing issues" badge={deep.flagged.length} defaultOpen>
        <WritingIssues deep={deep} />
      </Collapsible>

      <Collapsible title="Job description" defaultOpen>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the job description here to see keyword coverage and a match score."
          className="h-28 w-full resize-y rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs leading-snug text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <div className="mt-3">
          <Keywords analysis={analysis} />
        </div>
      </Collapsible>

      <Collapsible title="Skill gap" badge={deep.jd ? deep.jd.skillGap.length : ''}>
        <SkillGap deep={deep} />
      </Collapsible>

      <Collapsible title="Analytics">
        <AnalyticsView deep={deep} />
      </Collapsible>

      <Collapsible title="Structure">
        <StructureView deep={deep} />
      </Collapsible>

      <Collapsible title="Actionables" badge={`${doneCount}/${analysis.actionables.length}`} defaultOpen>
        <Actionables analysis={analysis} />
      </Collapsible>
    </div>
  );
}

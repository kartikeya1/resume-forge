'use client';

import { useMemo } from 'react';
import { useResumeStore } from '@/lib/store';
import { analyze, type Analysis } from '@/lib/scoring';

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
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
          Critical {critical[0]}/{critical[1]}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
          Important {important[0]}/{important[1]}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600">
          Optional {optional[0]}/{optional[1]}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {analysis.keywords.map((k) => (
          <span
            key={k.canonical}
            title={`${k.tier} · ${k.present ? 'found in resume' : 'missing'}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
              k.present
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-neutral-200 bg-white text-neutral-400'
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
      <div className="mb-2 text-[11px] text-neutral-500">
        {doneCount}/{items.length} done
      </div>
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      {children}
    </div>
  );
}

export function InsightsPanel() {
  const resume = useResumeStore((s) => s.resume);
  const jd = useResumeStore((s) => s.jobDescription);
  const setJd = useResumeStore((s) => s.setJobDescription);

  const analysis = useMemo(() => analyze(resume, jd), [resume, jd]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <ScoreDial label="ATS Score" value={analysis.atsScore} />
        <ScoreDial label="JD Match" value={analysis.jdMatchScore} />
      </div>

      <Panel title="Score breakdown">
        <Breakdown analysis={analysis} />
      </Panel>

      <Panel title="Job description">
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the job description here to see keyword coverage and a match score."
          className="h-28 w-full resize-y rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs leading-snug text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <div className="mt-3">
          <Keywords analysis={analysis} />
        </div>
      </Panel>

      <Panel title="Actionables">
        <Actionables analysis={analysis} />
      </Panel>
    </div>
  );
}

'use client';

import type { Resume, SectionKey } from '@/lib/types';
import { SECTION_LABELS } from '@/lib/types';

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="mt-4 mb-1.5 border-b border-black pb-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-black first:mt-0">
      {children}
    </h2>
  );
}

function Bullets({ items }: { items: string[] }) {
  const clean = items.filter((b) => b.trim());
  if (!clean.length) return null;
  return (
    <ul className="ml-4 list-disc space-y-0.5 text-[12.5px] leading-snug marker:text-black">
      {clean.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

function DateRange({ start, end }: { start: string; end: string }) {
  const t = [start, end].filter(Boolean).join(' – ');
  if (!t) return null;
  return <span className="shrink-0 text-[11.5px] text-neutral-600">{t}</span>;
}

function renderSection(resume: Resume, key: SectionKey) {
  switch (key) {
    case 'summary':
      if (!resume.summary.trim()) return null;
      return (
        <section key={key}>
          <SectionHeading>{SECTION_LABELS.summary}</SectionHeading>
          <p className="text-[12.5px] leading-snug text-black">{resume.summary}</p>
        </section>
      );
    case 'experience':
      if (!resume.experience.length) return null;
      return (
        <section key={key}>
          <SectionHeading>{SECTION_LABELS.experience}</SectionHeading>
          <div className="space-y-2">
            {resume.experience.map((e) => (
              <div key={e.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[13px] font-semibold text-black">
                    {e.role}
                    {e.company ? <span className="font-normal">, {e.company}</span> : null}
                  </div>
                  <DateRange start={e.start} end={e.end} />
                </div>
                {e.location ? <div className="text-[11.5px] italic text-neutral-600">{e.location}</div> : null}
                <Bullets items={e.bullets} />
              </div>
            ))}
          </div>
        </section>
      );
    case 'projects':
      if (!resume.projects.length) return null;
      return (
        <section key={key}>
          <SectionHeading>{SECTION_LABELS.projects}</SectionHeading>
          <div className="space-y-2">
            {resume.projects.map((p) => (
              <div key={p.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[13px] font-semibold text-black">{p.name}</div>
                  <DateRange start={p.start} end={p.end} />
                </div>
                {p.link ? <div className="text-[11.5px] italic text-neutral-600">{p.link}</div> : null}
                <Bullets items={p.bullets} />
              </div>
            ))}
          </div>
        </section>
      );
    case 'skills':
      if (!resume.skills.some((s) => s.items.length)) return null;
      return (
        <section key={key}>
          <SectionHeading>{SECTION_LABELS.skills}</SectionHeading>
          <div className="space-y-0.5">
            {resume.skills
              .filter((g) => g.items.length)
              .map((g) => (
                <p key={g.id} className="text-[12.5px] leading-snug text-black">
                  {g.name ? <span className="font-semibold">{g.name}: </span> : null}
                  {g.items.join(', ')}
                </p>
              ))}
          </div>
        </section>
      );
    case 'education':
      if (!resume.education.length) return null;
      return (
        <section key={key}>
          <SectionHeading>{SECTION_LABELS.education}</SectionHeading>
          <div className="space-y-1.5">
            {resume.education.map((e) => (
              <div key={e.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[13px] font-semibold text-black">{e.school}</div>
                  <DateRange start={e.start} end={e.end} />
                </div>
                {(e.degree || e.details) && (
                  <div className="text-[11.5px] italic text-neutral-600">{[e.degree, e.details].filter(Boolean).join(' · ')}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    case 'certifications':
      if (!resume.certifications.length) return null;
      return (
        <section key={key}>
          <SectionHeading>{SECTION_LABELS.certifications}</SectionHeading>
          <div className="space-y-0.5">
            {resume.certifications.map((c) => (
              <p key={c.id} className="text-[12.5px] leading-snug text-black">
                {[c.name, c.issuer, c.date].filter(Boolean).join(' · ')}
              </p>
            ))}
          </div>
        </section>
      );
    default:
      return null;
  }
}

export function ResumePreview({ resume }: { resume: Resume }) {
  const c = resume.contact;
  const contactBits = [c.location, c.phone, c.email].filter(Boolean);
  const sections = resume.sectionOrder.map((k) => renderSection(resume, k)).filter(Boolean);

  return (
    <div
      id="resume-paper"
      className="mx-auto w-full max-w-[720px] bg-white px-12 py-10 text-black shadow-sm ring-1 ring-black/5"
      style={{ fontFamily: 'Arial, Helvetica, system-ui, sans-serif' }}
    >
      {/* Header */}
      <header className="mb-2 text-center">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-black">{c.name || 'Your Name'}</h1>
        {c.title ? <div className="mt-0.5 text-[13px] text-neutral-700">{c.title}</div> : null}
        {(contactBits.length > 0 || c.links.length > 0) && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11.5px] text-neutral-700">
            {contactBits.map((b, i) => (
              <span key={i}>{b}</span>
            ))}
            {c.links.map((l) => (
              <span key={l.id} className="text-neutral-700">
                {l.url}
              </span>
            ))}
          </div>
        )}
      </header>

      {sections.length ? (
        <div className="space-y-1">{sections}</div>
      ) : (
        <p className="mt-10 text-center text-sm text-neutral-400">
          Your resume preview will appear here as you type.
        </p>
      )}
    </div>
  );
}

'use client';

import { useResumeStore } from '@/lib/store';
import { newId } from '@/lib/ids';
import { Label, TextInput, AutoTextarea, IconBtn, AddButton, SectionCard } from './ui';

export function Editor() {
  return (
    <div className="space-y-3">
      <ContactEditor />
      <SummaryEditor />
      <ExperienceEditor />
      <ProjectsEditor />
      <SkillsEditor />
      <EducationEditor />
      <CertificationsEditor />
    </div>
  );
}

function ContactEditor() {
  const contact = useResumeStore((s) => s.resume.contact);
  const update = useResumeStore((s) => s.update);
  return (
    <SectionCard title="Contact">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label>Full name</Label>
          <TextInput value={contact.name} placeholder="Jane Doe" onChange={(v) => update((d) => void (d.contact.name = v))} />
        </div>
        <div className="col-span-2">
          <Label>Headline / target title</Label>
          <TextInput value={contact.title} placeholder="Product Manager" onChange={(v) => update((d) => void (d.contact.title = v))} />
        </div>
        <div>
          <Label>Email</Label>
          <TextInput value={contact.email} placeholder="jane@email.com" onChange={(v) => update((d) => void (d.contact.email = v))} />
        </div>
        <div>
          <Label>Phone</Label>
          <TextInput value={contact.phone} placeholder="+1 555 000 0000" onChange={(v) => update((d) => void (d.contact.phone = v))} />
        </div>
        <div className="col-span-2">
          <Label>Location</Label>
          <TextInput value={contact.location} placeholder="City, Country" onChange={(v) => update((d) => void (d.contact.location = v))} />
        </div>
      </div>

      <div className="mt-3">
        <Label>Links</Label>
        <div className="space-y-2">
          {contact.links.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2">
              <div className="w-28 shrink-0">
                <TextInput value={l.label} placeholder="LinkedIn" onChange={(v) => update((d) => void (d.contact.links[i].label = v))} />
              </div>
              <TextInput value={l.url} placeholder="linkedin.com/in/…" onChange={(v) => update((d) => void (d.contact.links[i].url = v))} />
              <IconBtn title="Remove link" danger onClick={() => update((d) => void d.contact.links.splice(i, 1))}>
                ✕
              </IconBtn>
            </div>
          ))}
        </div>
        <AddButton onClick={() => update((d) => void d.contact.links.push({ id: newId(), label: '', url: '' }))}>Add link</AddButton>
      </div>
    </SectionCard>
  );
}

function SummaryEditor() {
  const summary = useResumeStore((s) => s.resume.summary);
  const update = useResumeStore((s) => s.update);
  return (
    <SectionCard title="Summary">
      <AutoTextarea
        value={summary}
        placeholder="2–3 lines on who you are, your strengths, and the impact you've had."
        minRows={3}
        onChange={(v) => update((d) => void (d.summary = v))}
      />
    </SectionCard>
  );
}

function BulletsEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (recipe: (b: string[]) => void) => void;
}) {
  return (
    <div className="mt-2">
      <Label>Bullets</Label>
      <div className="space-y-1.5">
        {bullets.map((b, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="mt-2 text-neutral-400">•</span>
            <AutoTextarea value={b} placeholder="Led / Built / Reduced … with a measurable result." onChange={(v) => onChange((arr) => void (arr[i] = v))} />
            <div className="mt-0.5">
              <IconBtn title="Remove bullet" danger onClick={() => onChange((arr) => void arr.splice(i, 1))}>
                ✕
              </IconBtn>
            </div>
          </div>
        ))}
      </div>
      <AddButton onClick={() => onChange((arr) => void arr.push(''))}>Add bullet</AddButton>
    </div>
  );
}

function MoveRemove({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <IconBtn title="Move up" onClick={onUp}>↑</IconBtn>
      <IconBtn title="Move down" onClick={onDown}>↓</IconBtn>
      <IconBtn title="Remove" danger onClick={onRemove}>🗑</IconBtn>
    </div>
  );
}

function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

function ExperienceEditor() {
  const experience = useResumeStore((s) => s.resume.experience);
  const update = useResumeStore((s) => s.update);
  return (
    <SectionCard title="Experience">
      <div className="space-y-3">
        {experience.map((e, i) => (
          <div key={e.id} className="rounded-md border border-neutral-200 p-2.5 dark:border-neutral-700">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Role {i + 1}</span>
              <MoveRemove
                onUp={() => update((d) => move(d.experience, i, -1))}
                onDown={() => update((d) => move(d.experience, i, 1))}
                onRemove={() => update((d) => void d.experience.splice(i, 1))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextInput value={e.role} placeholder="Role / title" onChange={(v) => update((d) => void (d.experience[i].role = v))} />
              <TextInput value={e.company} placeholder="Company" onChange={(v) => update((d) => void (d.experience[i].company = v))} />
              <TextInput value={e.start} placeholder="Start (Jan 2022)" onChange={(v) => update((d) => void (d.experience[i].start = v))} />
              <TextInput value={e.end} placeholder="End (Present)" onChange={(v) => update((d) => void (d.experience[i].end = v))} />
              <div className="col-span-2">
                <TextInput value={e.location} placeholder="Location (optional)" onChange={(v) => update((d) => void (d.experience[i].location = v))} />
              </div>
            </div>
            <BulletsEditor bullets={e.bullets} onChange={(recipe) => update((d) => recipe(d.experience[i].bullets))} />
          </div>
        ))}
      </div>
      <AddButton
        onClick={() =>
          update((d) => void d.experience.push({ id: newId(), company: '', role: '', location: '', start: '', end: '', bullets: [''] }))
        }
      >
        Add experience
      </AddButton>
    </SectionCard>
  );
}

function ProjectsEditor() {
  const projects = useResumeStore((s) => s.resume.projects);
  const update = useResumeStore((s) => s.update);
  return (
    <SectionCard title="Projects" defaultOpen={false}>
      <div className="space-y-3">
        {projects.map((p, i) => (
          <div key={p.id} className="rounded-md border border-neutral-200 p-2.5 dark:border-neutral-700">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Project {i + 1}</span>
              <MoveRemove
                onUp={() => update((d) => move(d.projects, i, -1))}
                onDown={() => update((d) => move(d.projects, i, 1))}
                onRemove={() => update((d) => void d.projects.splice(i, 1))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextInput value={p.name} placeholder="Project name" onChange={(v) => update((d) => void (d.projects[i].name = v))} />
              <TextInput value={p.link} placeholder="Link (optional)" onChange={(v) => update((d) => void (d.projects[i].link = v))} />
            </div>
            <BulletsEditor bullets={p.bullets} onChange={(recipe) => update((d) => recipe(d.projects[i].bullets))} />
          </div>
        ))}
      </div>
      <AddButton onClick={() => update((d) => void d.projects.push({ id: newId(), name: '', link: '', start: '', end: '', bullets: [''] }))}>
        Add project
      </AddButton>
    </SectionCard>
  );
}

function SkillsEditor() {
  const skills = useResumeStore((s) => s.resume.skills);
  const update = useResumeStore((s) => s.update);
  return (
    <SectionCard title="Skills">
      <div className="space-y-2.5">
        {skills.map((g, i) => (
          <div key={g.id} className="rounded-md border border-neutral-200 p-2.5 dark:border-neutral-700">
            <div className="mb-2 flex items-center gap-2">
              <div className="w-40 shrink-0">
                <TextInput value={g.name} placeholder="Group (e.g. Tools)" onChange={(v) => update((d) => void (d.skills[i].name = v))} />
              </div>
              <div className="flex-1" />
              <IconBtn title="Remove group" danger onClick={() => update((d) => void d.skills.splice(i, 1))}>
                🗑
              </IconBtn>
            </div>
            <Label>Comma-separated skills</Label>
            <AutoTextarea
              value={g.items.join(', ')}
              placeholder="SQL, Python, Figma, Jira"
              onChange={(v) =>
                update((d) => void (d.skills[i].items = v.split(',').map((s) => s.trim()).filter(Boolean)))
              }
            />
          </div>
        ))}
      </div>
      <AddButton onClick={() => update((d) => void d.skills.push({ id: newId(), name: '', items: [] }))}>Add skill group</AddButton>
    </SectionCard>
  );
}

function EducationEditor() {
  const education = useResumeStore((s) => s.resume.education);
  const update = useResumeStore((s) => s.update);
  return (
    <SectionCard title="Education">
      <div className="space-y-3">
        {education.map((e, i) => (
          <div key={e.id} className="rounded-md border border-neutral-200 p-2.5 dark:border-neutral-700">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Entry {i + 1}</span>
              <MoveRemove
                onUp={() => update((d) => move(d.education, i, -1))}
                onDown={() => update((d) => move(d.education, i, 1))}
                onRemove={() => update((d) => void d.education.splice(i, 1))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <TextInput value={e.school} placeholder="School / university" onChange={(v) => update((d) => void (d.education[i].school = v))} />
              </div>
              <div className="col-span-2">
                <TextInput value={e.degree} placeholder="Degree" onChange={(v) => update((d) => void (d.education[i].degree = v))} />
              </div>
              <TextInput value={e.start} placeholder="Start" onChange={(v) => update((d) => void (d.education[i].start = v))} />
              <TextInput value={e.end} placeholder="End" onChange={(v) => update((d) => void (d.education[i].end = v))} />
              <div className="col-span-2">
                <TextInput value={e.details} placeholder="GPA / honors (optional)" onChange={(v) => update((d) => void (d.education[i].details = v))} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <AddButton onClick={() => update((d) => void d.education.push({ id: newId(), school: '', degree: '', location: '', start: '', end: '', details: '' }))}>
        Add education
      </AddButton>
    </SectionCard>
  );
}

function CertificationsEditor() {
  const certs = useResumeStore((s) => s.resume.certifications);
  const update = useResumeStore((s) => s.update);
  return (
    <SectionCard title="Certifications" defaultOpen={false}>
      <div className="space-y-2">
        {certs.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <TextInput value={c.name} placeholder="Certification" onChange={(v) => update((d) => void (d.certifications[i].name = v))} />
            <TextInput value={c.issuer} placeholder="Issuer" onChange={(v) => update((d) => void (d.certifications[i].issuer = v))} />
            <div className="w-24 shrink-0">
              <TextInput value={c.date} placeholder="Year" onChange={(v) => update((d) => void (d.certifications[i].date = v))} />
            </div>
            <IconBtn title="Remove" danger onClick={() => update((d) => void d.certifications.splice(i, 1))}>
              ✕
            </IconBtn>
          </div>
        ))}
      </div>
      <AddButton onClick={() => update((d) => void d.certifications.push({ id: newId(), name: '', issuer: '', date: '' }))}>Add certification</AddButton>
    </SectionCard>
  );
}

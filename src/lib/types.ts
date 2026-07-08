// Structured resume schema. The whole app reads/writes this shape; scoring,
// keyword matching, preview rendering, and export all derive from it.

export interface Link {
  id: string;
  label: string; // e.g. "LinkedIn", "GitHub", "Portfolio"
  url: string;
}

export interface Contact {
  name: string;
  title: string; // headline, e.g. "Senior Product Manager"
  email: string;
  phone: string;
  location: string;
  links: Link[];
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  location: string;
  start: string; // free text, e.g. "Jan 2022"
  end: string; // free text, e.g. "Present"
  bullets: string[];
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  location: string;
  start: string;
  end: string;
  details: string; // GPA, honors, coursework
}

export interface SkillGroup {
  id: string;
  name: string; // e.g. "Languages", "Tools", "Core PM"
  items: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  link: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface CertItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

// Sections that can be reordered in the preview. `contact` is always first
// and is not part of this list.
export type SectionKey =
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications';

export const ALL_SECTIONS: SectionKey[] = [
  'summary',
  'experience',
  'skills',
  'projects',
  'education',
  'certifications',
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
};

export interface Resume {
  contact: Contact;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
  projects: ProjectItem[];
  certifications: CertItem[];
  sectionOrder: SectionKey[];
  meta: {
    targetRole: string;
    targetCompany: string;
  };
}

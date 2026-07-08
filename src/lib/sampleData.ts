import type { Resume } from './types';
import { newId } from './ids';

// A completely empty resume for "Start fresh".
export function emptyResume(): Resume {
  return {
    contact: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      links: [],
    },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    sectionOrder: ['summary', 'experience', 'skills', 'projects', 'education', 'certifications'],
    meta: { targetRole: '', targetCompany: '' },
  };
}

// A realistic starter resume used to seed first-time users so the preview and
// scoring feel alive immediately. Intentionally a mix of strong and weak
// bullets so the (later) analyzers have something to flag.
export function sampleResume(): Resume {
  return {
    contact: {
      name: 'Alex Morgan',
      title: 'Product Manager',
      email: 'alex.morgan@email.com',
      phone: '+1 (555) 010-2345',
      location: 'San Francisco, CA',
      links: [
        { id: newId(), label: 'LinkedIn', url: 'linkedin.com/in/alexmorgan' },
        { id: newId(), label: 'GitHub', url: 'github.com/alexmorgan' },
      ],
    },
    summary:
      'Product Manager with 5+ years shipping data-driven B2B and consumer products. Led cross-functional teams to deliver roadmap features that grew activation and retention.',
    experience: [
      {
        id: newId(),
        company: 'Northstar Labs',
        role: 'Senior Product Manager',
        location: 'San Francisco, CA',
        start: 'Jan 2022',
        end: 'Present',
        bullets: [
          'Led a cross-functional team of 9 to launch a self-serve onboarding flow, increasing activation by 34% in two quarters.',
          'Defined the payments roadmap and prioritized a retry mechanism that reduced failed transactions by 18%.',
          'Responsible for stakeholder communication and sprint planning.',
        ],
      },
      {
        id: newId(),
        company: 'Brightwave',
        role: 'Product Manager',
        location: 'Remote',
        start: 'Jun 2019',
        end: 'Dec 2021',
        bullets: [
          'Worked on the mobile app and helped improve the checkout experience.',
          'Shipped an A/B testing framework adopted by 4 product teams.',
        ],
      },
    ],
    education: [
      {
        id: newId(),
        school: 'University of California, Berkeley',
        degree: 'B.S. Electrical Engineering & Computer Science',
        location: 'Berkeley, CA',
        start: '2015',
        end: '2019',
        details: 'GPA 3.8/4.0',
      },
    ],
    skills: [
      { id: newId(), name: 'Product', items: ['Roadmapping', 'A/B Testing', 'User Research', 'OKRs'] },
      { id: newId(), name: 'Technical', items: ['SQL', 'Python', 'Figma', 'Amplitude', 'Jira'] },
    ],
    projects: [
      {
        id: newId(),
        name: 'Insights Dashboard',
        link: 'github.com/alexmorgan/insights',
        start: '2021',
        end: '2021',
        bullets: ['Built a self-serve analytics dashboard used by 200+ internal users.'],
      },
    ],
    certifications: [],
    sectionOrder: ['summary', 'experience', 'skills', 'projects', 'education', 'certifications'],
    meta: { targetRole: '', targetCompany: '' },
  };
}

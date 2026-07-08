import type { Resume } from './types';
import { newId } from './ids';

// Role-specific starter resumes used by the top-bar "Samples" dropdown.
// Each mixes strong quantified bullets with a couple of deliberately weak ones
// so the Pass 2 analyzers have something to flag out of the box.

export interface SampleDef {
  key: string;
  label: string; // dropdown label
  role: string; // short role tag
  build: () => Resume;
}

const order: Resume['sectionOrder'] = ['summary', 'experience', 'skills', 'projects', 'education', 'certifications'];

function base(partial: Partial<Resume>): Resume {
  return {
    contact: { name: '', title: '', email: '', phone: '', location: '', links: [] },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    sectionOrder: order,
    meta: { targetRole: '', targetCompany: '' },
    ...partial,
  };
}

const link = (label: string, url: string) => ({ id: newId(), label, url });
const skills = (name: string, items: string[]) => ({ id: newId(), name, items });

function apm(): Resume {
  return base({
    contact: {
      name: 'Priya Sharma',
      title: 'Associate Product Manager',
      email: 'priya.sharma@email.com',
      phone: '+1 (555) 240-1188',
      location: 'Bengaluru, India',
      links: [link('LinkedIn', 'linkedin.com/in/priyasharma'), link('GitHub', 'github.com/priyasharma')],
    },
    summary:
      'Associate Product Manager and recent CS graduate who ships user-facing features end to end. Comfortable with data, wireframes, and working closely with engineering.',
    experience: [
      {
        id: newId(),
        role: 'Associate Product Manager',
        company: 'Fintech Startup',
        location: 'Bengaluru',
        start: 'Jul 2023',
        end: 'Present',
        bullets: [
          'Launched an in-app referral flow that grew weekly signups by 22% within 3 months.',
          'Ran 12 user interviews and translated findings into a prioritized backlog of 8 features.',
          'Worked on the notifications system with the engineering team.',
        ],
      },
      {
        id: newId(),
        role: 'Product Intern',
        company: 'E-commerce Co.',
        location: 'Remote',
        start: 'Jan 2023',
        end: 'Jun 2023',
        bullets: [
          'Analyzed funnel drop-off in SQL and proposed a checkout change that lifted conversion by 6%.',
          'Responsible for competitive research and weekly product reports.',
        ],
      },
    ],
    projects: [
      {
        id: newId(),
        name: 'CampusEats (side project)',
        link: 'github.com/priyasharma/campuseats',
        start: '2022',
        end: '2022',
        bullets: ['Built a food-ordering app used by 500+ students across two campuses.'],
      },
    ],
    skills: [
      skills('Product', ['User Research', 'Wireframing', 'A/B Testing', 'Roadmapping']),
      skills('Technical', ['SQL', 'Python', 'Figma', 'Amplitude', 'Jira']),
    ],
    education: [
      { id: newId(), school: 'BITS Pilani', degree: 'B.E. Computer Science', location: 'Pilani', start: '2019', end: '2023', details: 'GPA 8.7/10' },
    ],
  });
}

function pm(): Resume {
  return base({
    contact: {
      name: 'Alex Morgan',
      title: 'Product Manager',
      email: 'alex.morgan@email.com',
      phone: '+1 (555) 010-2345',
      location: 'San Francisco, CA',
      links: [link('LinkedIn', 'linkedin.com/in/alexmorgan'), link('Portfolio', 'alexmorgan.pm')],
    },
    summary:
      'Product Manager with 5 years shipping B2B and consumer products. Owns discovery through launch, and partners with design, engineering, and go-to-market to drive activation and retention.',
    experience: [
      {
        id: newId(),
        role: 'Product Manager',
        company: 'Northstar Labs',
        location: 'San Francisco, CA',
        start: 'Jan 2022',
        end: 'Present',
        bullets: [
          'Led a cross-functional team of 9 to launch a self-serve onboarding flow, increasing activation by 34% in two quarters.',
          'Defined the payments roadmap and prioritized a retry mechanism that reduced failed transactions by 18%.',
          'Shipped an experimentation framework adopted by 4 product teams, cutting test setup time by half.',
          'Responsible for stakeholder communication and sprint planning.',
        ],
      },
      {
        id: newId(),
        role: 'Associate Product Manager',
        company: 'Brightwave',
        location: 'Remote',
        start: 'Jun 2019',
        end: 'Dec 2021',
        bullets: [
          'Grew mobile checkout conversion by 11% through a redesigned payment sheet.',
          'Worked on the analytics dashboard used by internal teams.',
        ],
      },
    ],
    skills: [
      skills('Product', ['Roadmapping', 'A/B Testing', 'User Research', 'OKRs', 'Go-to-market']),
      skills('Technical', ['SQL', 'Python', 'Figma', 'Amplitude', 'Mixpanel', 'Jira']),
    ],
    education: [
      { id: newId(), school: 'UC Berkeley', degree: 'B.S. EECS', location: 'Berkeley, CA', start: '2015', end: '2019', details: 'GPA 3.8/4.0' },
    ],
  });
}

function spm(): Resume {
  return base({
    contact: {
      name: 'Daniel Okafor',
      title: 'Senior Product Manager',
      email: 'daniel.okafor@email.com',
      phone: '+1 (555) 771-9042',
      location: 'Seattle, WA',
      links: [link('LinkedIn', 'linkedin.com/in/danielokafor')],
    },
    summary:
      'Senior Product Manager with 9 years leading platform and growth products. Sets strategy, builds high-performing teams, and drives measurable business outcomes across cross-functional orgs.',
    experience: [
      {
        id: newId(),
        role: 'Senior Product Manager',
        company: 'CloudScale',
        location: 'Seattle, WA',
        start: 'Mar 2020',
        end: 'Present',
        bullets: [
          'Owned a $40M platform line and grew net revenue retention from 108% to 124% over two years.',
          'Built and mentored a team of 5 PMs, establishing a quarterly OKR and discovery cadence.',
          'Drove a pricing and packaging overhaul that increased average contract value by 28%.',
          'Partnered with sales and marketing on go-to-market for three major launches.',
        ],
      },
      {
        id: newId(),
        role: 'Product Manager',
        company: 'DataForge',
        location: 'Austin, TX',
        start: 'Aug 2015',
        end: 'Feb 2020',
        bullets: [
          'Launched an API platform adopted by 300+ enterprise customers in year one.',
          'Reduced churn by 15% by shipping a proactive health-score alerting system.',
        ],
      },
    ],
    skills: [
      skills('Leadership', ['Product Strategy', 'Team Building', 'Stakeholder Management', 'Roadmap Planning']),
      skills('Craft', ['Pricing', 'Experimentation', 'SQL', 'Data-driven decision making', 'Platform / APIs']),
    ],
    education: [
      { id: newId(), school: 'Georgia Tech', degree: 'B.S. Computer Science', location: 'Atlanta, GA', start: '2011', end: '2015', details: '' },
    ],
  });
}

function marketingMba(): Resume {
  return base({
    contact: {
      name: 'Sara Klein',
      title: 'Marketing Manager (MBA)',
      email: 'sara.klein@email.com',
      phone: '+1 (555) 388-2210',
      location: 'New York, NY',
      links: [link('LinkedIn', 'linkedin.com/in/saraklein')],
    },
    summary:
      'MBA marketing leader with 6 years across brand, growth, and product marketing. Builds data-driven campaigns and go-to-market strategies that grow pipeline and brand awareness.',
    experience: [
      {
        id: newId(),
        role: 'Senior Marketing Manager',
        company: 'Consumer Brands Inc.',
        location: 'New York, NY',
        start: 'Jul 2021',
        end: 'Present',
        bullets: [
          'Led a rebrand and integrated campaign that increased aided brand awareness by 19 points.',
          'Managed a $3M annual budget and improved marketing-sourced pipeline by 42%.',
          'Launched a lifecycle email program that lifted repeat purchase rate by 14%.',
          'Responsible for agency management and content calendar.',
        ],
      },
      {
        id: newId(),
        role: 'Product Marketing Manager',
        company: 'SaaS Co.',
        location: 'Chicago, IL',
        start: 'Aug 2017',
        end: 'Jun 2021',
        bullets: [
          'Drove go-to-market for 5 product launches generating $8M in new ARR.',
          'Built positioning and messaging that improved landing-page conversion by 23%.',
        ],
      },
    ],
    skills: [
      skills('Marketing', ['Brand Strategy', 'Go-to-market', 'Product Marketing', 'Demand Generation', 'Positioning']),
      skills('Tools', ['HubSpot', 'Google Analytics', 'SQL', 'Salesforce', 'Figma']),
    ],
    education: [
      { id: newId(), school: 'NYU Stern School of Business', degree: 'MBA, Marketing', location: 'New York, NY', start: '2015', end: '2017', details: '' },
      { id: newId(), school: 'University of Michigan', degree: 'B.A. Communications', location: 'Ann Arbor, MI', start: '2009', end: '2013', details: '' },
    ],
  });
}

function salesMba(): Resume {
  return base({
    contact: {
      name: 'Marcus Reed',
      title: 'Account Executive (MBA)',
      email: 'marcus.reed@email.com',
      phone: '+1 (555) 662-7745',
      location: 'Boston, MA',
      links: [link('LinkedIn', 'linkedin.com/in/marcusreed')],
    },
    summary:
      'MBA sales professional with 5 years closing enterprise SaaS deals. Consistently exceeds quota by building trusted relationships and running a disciplined pipeline.',
    experience: [
      {
        id: newId(),
        role: 'Enterprise Account Executive',
        company: 'Enterprise Software Co.',
        location: 'Boston, MA',
        start: 'Aug 2021',
        end: 'Present',
        bullets: [
          'Closed $4.2M in new ARR in FY24, achieving 138% of quota and ranking #2 of 30 reps.',
          'Built a territory pipeline of 60+ accounts and shortened average sales cycle by 21%.',
          'Negotiated multi-year contracts with 6 Fortune 500 logos.',
          'Responsible for CRM hygiene and weekly forecasting.',
        ],
      },
      {
        id: newId(),
        role: 'Sales Development Representative',
        company: 'Growth SaaS',
        location: 'Boston, MA',
        start: 'Jun 2019',
        end: 'Jul 2021',
        bullets: [
          'Generated 220 qualified opportunities producing $6M in influenced pipeline.',
          'Worked on outbound sequences and prospecting.',
        ],
      },
    ],
    skills: [
      skills('Sales', ['Enterprise Sales', 'Pipeline Management', 'Negotiation', 'Forecasting', 'Account Planning']),
      skills('Tools', ['Salesforce', 'Outreach', 'Gong', 'LinkedIn Sales Navigator']),
    ],
    education: [
      { id: newId(), school: 'MIT Sloan School of Management', degree: 'MBA', location: 'Cambridge, MA', start: '2017', end: '2019', details: '' },
      { id: newId(), school: 'Boston University', degree: 'B.S. Business Administration', location: 'Boston, MA', start: '2011', end: '2015', details: '' },
    ],
  });
}

function srSalesManager(): Resume {
  return base({
    contact: {
      name: 'Elena Vasquez',
      title: 'Senior Sales Manager (MBA)',
      email: 'elena.vasquez@email.com',
      phone: '+1 (555) 903-4471',
      location: 'Denver, CO',
      links: [link('LinkedIn', 'linkedin.com/in/elenavasquez')],
    },
    summary:
      'MBA sales leader with 11 years and 5 years managing quota-carrying teams. Builds, coaches, and scales high-performing sales orgs that consistently beat revenue targets.',
    experience: [
      {
        id: newId(),
        role: 'Senior Sales Manager',
        company: 'GlobalTech',
        location: 'Denver, CO',
        start: 'Feb 2020',
        end: 'Present',
        bullets: [
          'Led a team of 12 AEs to $52M in annual bookings, exceeding target by 117% for three consecutive years.',
          'Recruited and ramped 8 reps, cutting average time-to-productivity from 6 months to 4.',
          'Implemented a new sales methodology and forecasting model improving forecast accuracy to 95%.',
          'Partnered with marketing on go-to-market and account-based strategy for the enterprise segment.',
        ],
      },
      {
        id: newId(),
        role: 'Regional Sales Manager',
        company: 'Industrial Solutions',
        location: 'Phoenix, AZ',
        start: 'Jul 2013',
        end: 'Jan 2020',
        bullets: [
          'Grew regional revenue from $9M to $21M over four years.',
          'Responsible for managing distributor relationships across five states.',
        ],
      },
    ],
    skills: [
      skills('Leadership', ['Sales Management', 'Team Coaching', 'Forecasting', 'Territory Planning', 'Go-to-market']),
      skills('Tools', ['Salesforce', 'Clari', 'Tableau', 'Outreach']),
    ],
    education: [
      { id: newId(), school: 'Kellogg School of Management', degree: 'MBA', location: 'Evanston, IL', start: '2011', end: '2013', details: '' },
      { id: newId(), school: 'Arizona State University', degree: 'B.S. Marketing', location: 'Tempe, AZ', start: '2005', end: '2009', details: '' },
    ],
  });
}

export const SAMPLES: SampleDef[] = [
  { key: 'apm', label: 'Associate Product Manager', role: 'APM', build: apm },
  { key: 'pm', label: 'Product Manager', role: 'PM', build: pm },
  { key: 'spm', label: 'Senior Product Manager', role: 'SPM', build: spm },
  { key: 'marketing-mba', label: 'Marketing Manager (MBA)', role: 'Marketing', build: marketingMba },
  { key: 'sales-mba', label: 'Account Executive (MBA)', role: 'Sales', build: salesMba },
  { key: 'sr-sales-mba', label: 'Senior Sales Manager (MBA)', role: 'Sales Lead', build: srSalesManager },
];

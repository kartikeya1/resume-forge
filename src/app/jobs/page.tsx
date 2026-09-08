import type { Metadata } from 'next';
import { JobsDashboard } from './JobsDashboard';

// The root layout sets `alternates: { canonical: '/' }` globally, which would
// otherwise point this route at the home page. It is also deliberately kept out
// of sitemap.ts and disallowed in robots.ts - this is a private page.
export const metadata: Metadata = {
  title: 'Jobs Forge - job application tracker',
  description: 'Where every job application stands, read from your own Gmail snapshot.',
  alternates: { canonical: '/jobs' },
  manifest: '/jobs.webmanifest',
  robots: { index: false, follow: false },
};

export default function JobsPage() {
  return <JobsDashboard />;
}

// Single source of truth for the deployed URL and shared copy, so metadata,
// robots and sitemap cannot drift apart.
//
// NEXT_PUBLIC_SITE_URL lets a preview deployment advertise its own host instead
// of pointing canonical URLs at production. Falls back to the known prod URL.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://resume-forge-two-pi.vercel.app'
).replace(/\/$/, '');

export const SITE_NAME = 'ResumeForge';

export const SITE_TITLE = 'ResumeForge - resume builder with live ATS & JD matching';

export const SITE_DESCRIPTION =
  'Build or import a resume, get a live ATS score and job-description keyword match, and export a clean, ATS-friendly PDF or DOCX. Free, private, and runs entirely in your browser.';

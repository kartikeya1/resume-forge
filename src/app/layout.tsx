import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ResumeForge — resume builder with live ATS & JD matching',
  description:
    'Build or import a resume, get a live ATS score and job-description keyword match, and export a clean, ATS-friendly PDF or DOCX.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

// Build a .docx from the structured resume using the `docx` library, then
// trigger a client-side download. Mirrors the preview's black & white layout.
'use client';

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  TabStopType,
  TabStopPosition,
} from 'docx';
import type { Resume, SectionKey } from './types';
import { SECTION_LABELS } from './types';
import { parseInline } from './inlineFormat';

// Convert *bold* markup into docx TextRuns preserving bold segments.
function inlineRuns(text: string, opts: { size?: number; italics?: boolean; color?: string } = {}): TextRun[] {
  return parseInline(text).map(
    (seg) => new TextRun({ text: seg.text, bold: seg.bold, size: opts.size, italics: opts.italics, color: opts.color })
  );
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: '000000' })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: inlineRuns(text, { size: 20 }),
  });
}

// A row with left text bold and right-aligned dates via a tab stop.
function titleWithDates(left: string, right: string): Paragraph {
  return new Paragraph({
    spacing: { before: 100, after: 20 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: left, bold: true, size: 21 }),
      ...(right ? [new TextRun({ text: `\t${right}`, size: 20, color: '444444' })] : []),
    ],
  });
}

function subtle(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, italics: true, size: 20, color: '333333' })],
  });
}

function sectionParagraphs(resume: Resume, key: SectionKey): Paragraph[] {
  const out: Paragraph[] = [];
  switch (key) {
    case 'summary':
      if (resume.summary.trim()) {
        out.push(heading(SECTION_LABELS.summary));
        out.push(new Paragraph({ spacing: { after: 40 }, children: inlineRuns(resume.summary, { size: 20 }) }));
      }
      break;
    case 'experience':
      if (resume.experience.length) {
        out.push(heading(SECTION_LABELS.experience));
        for (const e of resume.experience) {
          out.push(titleWithDates(`${e.role}${e.company ? ', ' + e.company : ''}`, [e.start, e.end].filter(Boolean).join(' – ')));
          if (e.location) out.push(subtle(e.location));
          e.bullets.filter((b) => b.trim()).forEach((b) => out.push(bullet(b)));
        }
      }
      break;
    case 'projects':
      if (resume.projects.length) {
        out.push(heading(SECTION_LABELS.projects));
        for (const p of resume.projects) {
          out.push(titleWithDates(p.name, [p.start, p.end].filter(Boolean).join(' – ')));
          if (p.link) out.push(subtle(p.link));
          p.bullets.filter((b) => b.trim()).forEach((b) => out.push(bullet(b)));
        }
      }
      break;
    case 'skills':
      if (resume.skills.some((s) => s.items.length)) {
        out.push(heading(SECTION_LABELS.skills));
        for (const g of resume.skills) {
          if (!g.items.length) continue;
          out.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [
                new TextRun({ text: g.name ? `${g.name}: ` : '', bold: true, size: 20 }),
                ...inlineRuns(g.items.join(', '), { size: 20 }),
              ],
            })
          );
        }
      }
      break;
    case 'education':
      if (resume.education.length) {
        out.push(heading(SECTION_LABELS.education));
        for (const e of resume.education) {
          out.push(titleWithDates(e.school, [e.start, e.end].filter(Boolean).join(' – ')));
          if (e.degree || e.details) out.push(subtle([e.degree, e.details].filter(Boolean).join(' · ')));
        }
      }
      break;
    case 'certifications':
      if (resume.certifications.length) {
        out.push(heading(SECTION_LABELS.certifications));
        for (const c of resume.certifications) {
          out.push(new Paragraph({ spacing: { after: 30 }, children: inlineRuns([c.name, c.issuer, c.date].filter(Boolean).join(' · '), { size: 20 }) }));
        }
      }
      break;
  }
  return out;
}

export async function exportDocx(resume: Resume): Promise<void> {
  const c = resume.contact;
  const children: Paragraph[] = [];

  // Header
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: c.name || 'Your Name', bold: true, size: 40 })],
    })
  );
  if (c.title) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: c.title, size: 22, color: '333333' })] }));
  }
  const contactBits = [c.location, c.phone, c.email, ...c.links.map((l) => l.url)].filter(Boolean);
  if (contactBits.length) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: contactBits.join('  |  '), size: 18, color: '333333' })] }));
  }

  for (const key of resume.sectionOrder) {
    children.push(...sectionParagraphs(resume, key));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri' } } } },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, buildFilename(resume, 'docx'));
}

export function buildFilename(resume: Resume, ext: string): string {
  const name = resume.contact.name.trim().replace(/\s+/g, '_') || 'Resume';
  const role = (resume.meta.targetRole || resume.contact.title).trim().replace(/\s+/g, '_');
  const company = resume.meta.targetCompany.trim().replace(/\s+/g, '_');
  return [name, role, company].filter(Boolean).join('_') + '.' + ext;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

import { describe, expect, it } from 'vitest';
import { applicationsToCsv } from './csv';
import type { Application } from './types';

function app(overrides: Partial<Application> = {}): Application {
  return {
    id: 'a', company: 'Acme, Inc.', companyKey: 'acme', role: 'PM "Growth"', roleKey: 'pm#',
    reqIds: ['JR1'], status: 'applied', statusRuleId: 'r', statusReason: 'x', decidedBy: 'rules',
    appliedAt: Date.parse('2026-07-01T00:00:00Z'), firstAt: 0, lastAt: Date.parse('2026-08-01T00:00:00Z'),
    events: [], threadIds: ['t1', 't2'], provenance: { company: 'agent', role: 'agent' }, mergeRuleIds: [], classificationByThread: {},
    flags: {
      recruiterReplied: true, awaitingMyReply: false, iReplied: false,
      deadlineAt: null, deadlineSource: null, deadlineMissed: false,
      interviewAt: null, interviewMissed: false, staleDays: 10,
      duplicateMessages: 0, talentPooled: false, needsReview: false, conflicting: false,
    },
    notes: 'called back,\nfollow up',
    ...overrides,
  };
}

describe('applicationsToCsv', () => {
  it('has a header row with the expected columns', () => {
    const [header] = applicationsToCsv([]).trim().split('\r\n');
    expect(header).toBe(
      'Company,Role,Status,Applied,Last activity,Recruiter replied,Needs review,Req IDs,Notes,Gmail threads'
    );
  });

  it('quotes a field containing a comma', () => {
    const csv = applicationsToCsv([app()]);
    expect(csv).toContain('"Acme, Inc."');
  });

  it('escapes an embedded quote by doubling it', () => {
    const csv = applicationsToCsv([app()]);
    expect(csv).toContain('"PM ""Growth"""');
  });

  it('quotes a field containing a newline and preserves it verbatim inside the quotes', () => {
    const csv = applicationsToCsv([app()]);
    expect(csv).toContain('"called back,\nfollow up"');
  });

  it('joins multiple gmail thread links with a semicolon', () => {
    const csv = applicationsToCsv([app()]);
    expect(csv).toContain('https://mail.google.com/mail/u/0/#all/t1; https://mail.google.com/mail/u/0/#all/t2');
  });

  it('renders a null company and null appliedAt as empty cells, not the string "null"', () => {
    const csv = applicationsToCsv([app({ company: null, appliedAt: null })]);
    const dataLine = csv.trim().split('\r\n')[1];
    expect(dataLine).not.toMatch(/null/i);
    expect(dataLine.startsWith(',')).toBe(true); // company cell is empty
  });

  it('uses the human status label, not the raw status id', () => {
    const csv = applicationsToCsv([app({ status: 'action_needed' })]);
    expect(csv).toContain('Needs action');
    expect(csv).not.toContain('action_needed');
  });

  it('ends every row, including the last, with CRLF', () => {
    const csv = applicationsToCsv([app()]);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

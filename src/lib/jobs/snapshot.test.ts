import { describe, expect, it } from 'vitest';
import { InvalidSnapshotError, parseSnapshot, parseSnapshotText, SNAPSHOT_KIND } from './snapshot';

const base = {
  kind: SNAPSHOT_KIND,
  version: 1,
  generatedAt: '2026-09-08T12:00:00Z',
  window: { since: '2026-06-10T00:00:00Z', until: '2026-09-08T12:00:00Z' },
  threads: [
    {
      id: 't1',
      subject: 'Thank you for applying',
      messages: [
        { id: 'm1', at: '2026-09-01T10:00:00Z', from: { email: 'x@myworkday.com' }, subject: 'Thank you for applying', snippet: '', fromMe: false },
      ],
    },
  ],
};

describe('rejection', () => {
  it('refuses a file that is not a Jobs Forge snapshot', () => {
    expect(() => parseSnapshot({ app: 'resumeforge', version: 1 })).toThrow(InvalidSnapshotError);
  });

  it('refuses invalid JSON with a readable message', () => {
    expect(() => parseSnapshotText('{ not json')).toThrow(InvalidSnapshotError);
  });
});

describe('tolerance', () => {
  // The failure mode to avoid is a blank dashboard because one thread in ninety
  // had a malformed date.
  it('keeps good threads when a sibling is malformed', () => {
    const { snapshot, warnings } = parseSnapshot({
      ...base,
      threads: [...base.threads, { id: 't2' }, { subject: 'no id' }],
    });
    expect(snapshot.threads).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('drops a message with an unparseable date rather than propagating NaN', () => {
    const { snapshot, warnings } = parseSnapshot({
      ...base,
      threads: [
        {
          id: 't1',
          messages: [
            { id: 'bad', at: 'not-a-date', from: { email: 'a@b.com' }, subject: 's' },
            { id: 'good', at: '2026-09-01T10:00:00Z', from: { email: 'a@b.com' }, subject: 's' },
          ],
        },
      ],
    });
    expect(snapshot.threads[0].messages).toHaveLength(1);
    expect(warnings.join(' ')).toMatch(/skipped/);
  });

  it('accepts a newer version with a warning instead of refusing', () => {
    const { snapshot, warnings } = parseSnapshot({ ...base, version: 2 });
    expect(snapshot.threads).toHaveLength(1);
    expect(warnings.join(' ')).toMatch(/newer agent/);
  });

  it('warns when the scanned window is missing', () => {
    const { warnings } = parseSnapshot({ ...base, window: {} });
    // Without it, "no response yet" and "not scanned" are indistinguishable.
    expect(warnings.join(' ')).toMatch(/how far back/);
  });

  it('sorts messages chronologically regardless of file order', () => {
    const { snapshot } = parseSnapshot({
      ...base,
      threads: [
        {
          id: 't1',
          messages: [
            { id: 'b', at: '2026-09-02T10:00:00Z', from: { email: 'a@b.com' }, subject: 'b' },
            { id: 'a', at: '2026-09-01T10:00:00Z', from: { email: 'a@b.com' }, subject: 'a' },
          ],
        },
      ],
    });
    expect(snapshot.threads[0].messages.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('lowercases sender addresses and accepts a bare string', () => {
    const { snapshot } = parseSnapshot({
      ...base,
      threads: [{ id: 't1', messages: [{ id: 'm', at: '2026-09-01T10:00:00Z', from: 'Recruiter.One@Civica.com', subject: 's' }] }],
    });
    expect(snapshot.threads[0].messages[0].from.email).toBe('recruiter.one@civica.com');
  });
});

describe('hints', () => {
  it('round-trips an agent hint with event overrides', () => {
    const { snapshot } = parseSnapshot({
      ...base,
      hints: [
        {
          threadId: 't1',
          company: 'Blitz',
          applicationKey: 'blitz:spm',
          distinctFrom: ['t9'],
          confidence: 0.9,
          reason: 'Read the body.',
          eventOverrides: [{ messageId: 'm1', type: 'interview_missed', note: 'no-show' }],
        },
      ],
    });
    const h = snapshot.hints?.[0];
    expect(h?.company).toBe('Blitz');
    expect(h?.applicationKey).toBe('blitz:spm');
    expect(h?.eventOverrides?.[0].type).toBe('interview_missed');
  });

  it('drops a hint with no threadId', () => {
    const { snapshot } = parseSnapshot({ ...base, hints: [{ company: 'Nowhere' }] });
    expect(snapshot.hints).toHaveLength(0);
  });
});

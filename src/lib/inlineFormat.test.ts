import { describe, it, expect } from 'vitest';
import { parseInline, stripInline } from './inlineFormat';

// These two functions are the shared contract between the React preview, the
// DOCX exporter and the analysis pipeline. If they disagree, bold text either
// renders wrong in an export or leaks asterisks into keyword matching.

describe('parseInline', () => {
  it('returns a single plain segment for text with no markers', () => {
    expect(parseInline('plain text')).toEqual([{ text: 'plain text', bold: false }]);
  });

  it('splits a single bold run out of surrounding text', () => {
    expect(parseInline('cut churn by *38%* last year')).toEqual([
      { text: 'cut churn by ', bold: false },
      { text: '38%', bold: true },
      { text: ' last year', bold: false },
    ]);
  });

  it('handles bold at the very start and very end', () => {
    expect(parseInline('*Led* the team')).toEqual([
      { text: 'Led', bold: true },
      { text: ' the team', bold: false },
    ]);
    expect(parseInline('grew revenue *3x*')).toEqual([
      { text: 'grew revenue ', bold: false },
      { text: '3x', bold: true },
    ]);
  });

  it('handles multiple bold runs', () => {
    expect(parseInline('*a* and *b*')).toEqual([
      { text: 'a', bold: true },
      { text: ' and ', bold: false },
      { text: 'b', bold: true },
    ]);
  });

  it('leaves an unpaired asterisk as literal text', () => {
    expect(parseInline('5 * 3 = 15')).toEqual([{ text: '5 * 3 = 15', bold: false }]);
    expect(parseInline('trailing *')).toEqual([{ text: 'trailing *', bold: false }]);
  });

  it('does not span a newline when pairing asterisks', () => {
    const segs = parseInline('start *not\nclosed* end');
    expect(segs.every((s) => !s.bold)).toBe(true);
  });

  it('ignores empty marker pairs rather than emitting an empty bold run', () => {
    // `**` has nothing between the asterisks, so there is no bold content.
    expect(parseInline('a ** b').every((s) => !s.bold)).toBe(true);
  });

  it('always returns at least one segment, even for empty input', () => {
    expect(parseInline('')).toEqual([{ text: '', bold: false }]);
  });

  it('preserves the full original text when segments are concatenated', () => {
    for (const input of [
      'plain',
      '*bold*',
      'a *b* c',
      '*a* *b*',
      '5 * 3',
      '',
      'multi\nline *bold* here',
    ]) {
      const rebuilt = parseInline(input)
        .map((s) => (s.bold ? `*${s.text}*` : s.text))
        .join('');
      expect(rebuilt).toBe(input);
    }
  });
});

describe('stripInline', () => {
  it('removes the markers but keeps the words', () => {
    expect(stripInline('cut churn by *38%*')).toBe('cut churn by 38%');
    expect(stripInline('*a* and *b*')).toBe('a and b');
  });

  it('leaves unpaired asterisks alone', () => {
    expect(stripInline('5 * 3 = 15')).toBe('5 * 3 = 15');
  });

  it('is a no-op on unformatted text', () => {
    expect(stripInline('plain text')).toBe('plain text');
  });

  it('agrees with parseInline on the resulting plain text', () => {
    for (const input of ['a *b* c', '*bold* start', 'no markers', '5 * 3', '*x* *y*']) {
      const viaParse = parseInline(input)
        .map((s) => s.text)
        .join('');
      expect(stripInline(input)).toBe(viaParse);
    }
  });
});

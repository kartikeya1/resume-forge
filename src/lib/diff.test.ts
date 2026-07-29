import { describe, it, expect } from 'vitest';
import { diffResumes } from './diff';
import { emptyResume } from './sampleData';
import type { Resume } from './types';

function base(): Resume {
  return {
    ...emptyResume(),
    contact: { ...emptyResume().contact, name: 'Ada Lovelace', title: 'Product Manager' },
    summary: 'Payments PM.',
    experience: [
      {
        role: 'PM',
        company: 'Acme',
        location: '',
        start: '2022',
        end: 'Present',
        bullets: ['Led the replatform', 'Cut failures by 38%'],
      },
    ],
    skills: [{ name: 'Product', items: ['SQL', 'Roadmap'] }],
  } as Resume;
}

describe('diffResumes', () => {
  it('reports no changes for identical resumes', () => {
    const d = diffResumes(base(), base());
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.changedCount).toBe(0);
  });

  it('detects an added bullet', () => {
    const after = base();
    after.experience[0].bullets.push('Launched self-serve onboarding');
    const d = diffResumes(base(), after);
    expect(d.added).toContain('Bullet: Launched self-serve onboarding');
    expect(d.removed).toEqual([]);
    expect(d.changedCount).toBe(1);
  });

  it('detects a removed bullet', () => {
    const after = base();
    after.experience[0].bullets.pop();
    const d = diffResumes(base(), after);
    expect(d.removed).toContain('Bullet: Cut failures by 38%');
    expect(d.added).toEqual([]);
  });

  it('reports an edited bullet as one removal plus one addition', () => {
    const after = base();
    after.experience[0].bullets[1] = 'Cut failures by 45%';
    const d = diffResumes(base(), after);
    expect(d.removed).toContain('Bullet: Cut failures by 38%');
    expect(d.added).toContain('Bullet: Cut failures by 45%');
    expect(d.changedCount).toBe(2);
  });

  it('detects contact and summary changes', () => {
    const after = base();
    after.contact.title = 'Senior Product Manager';
    const d = diffResumes(base(), after);
    expect(d.removed).toContain('Title: Product Manager');
    expect(d.added).toContain('Title: Senior Product Manager');
  });

  it('detects skill changes', () => {
    const after = base();
    after.skills[0].items.push('A/B testing');
    const d = diffResumes(base(), after);
    expect(d.added).toContain('Skill: A/B testing');
  });

  it('ignores inline bold markers, so bolding a bullet is not a content change', () => {
    const after = base();
    after.experience[0].bullets[1] = 'Cut failures by *38%*';
    const d = diffResumes(base(), after);
    expect(d.changedCount).toBe(0);
  });

  it('ignores surrounding whitespace', () => {
    const after = base();
    after.experience[0].bullets[0] = '  Led the replatform  ';
    expect(diffResumes(base(), after).changedCount).toBe(0);
  });

  it('omits empty fields entirely rather than diffing blanks', () => {
    const d = diffResumes(emptyResume(), emptyResume());
    expect(d.changedCount).toBe(0);
    // An empty resume contributes no lines at all, so adding a name is one add.
    const withName = { ...emptyResume(), contact: { ...emptyResume().contact, name: 'Ada' } } as Resume;
    expect(diffResumes(emptyResume(), withName).added).toEqual(['Name: Ada']);
  });

  it('is antisymmetric: swapping the arguments swaps added and removed', () => {
    const after = base();
    after.experience[0].bullets.push('New bullet');
    const forward = diffResumes(base(), after);
    const backward = diffResumes(after, base());
    expect(backward.removed).toEqual(forward.added);
    expect(backward.added).toEqual(forward.removed);
    expect(backward.changedCount).toBe(forward.changedCount);
  });

  it('does not double-count a bullet duplicated within the same resume', () => {
    // gatherLines feeds a Set, so identical lines collapse. Documented here so
    // the behaviour is deliberate rather than surprising.
    const after = base();
    after.experience[0].bullets.push('Led the replatform');
    expect(diffResumes(base(), after).changedCount).toBe(0);
  });
});

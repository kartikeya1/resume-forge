import { describe, expect, it } from 'vitest';
import {
  addManual, clearField, dismissReview, mergeThreads, removeManual, resetThread,
  setArchived, setField, setNotes, setStatus, splitThreads, undismissReview, updateManual,
} from './overrides';
import { emptyOverrides } from './types';

describe('mergeThreads / splitThreads', () => {
  it('adds a merge group', () => {
    const o = mergeThreads(emptyOverrides(), ['t2', 't1']);
    expect(o.merge).toEqual([['t1', 't2']]); // sorted, order-independent
  });

  it('adds a split group', () => {
    const o = splitThreads(emptyOverrides(), ['t2', 't1']);
    expect(o.split).toEqual([['t1', 't2']]);
  });

  it('does nothing for a single thread', () => {
    expect(mergeThreads(emptyOverrides(), ['t1']).merge).toEqual([]);
    expect(splitThreads(emptyOverrides(), ['t1']).split).toEqual([]);
  });

  it('a later merge clears an earlier split of the same pair', () => {
    // J0 (split) is checked before J2 (merge) in correlate.ts's join
    // predicate, so a stale split would silently veto the merge otherwise.
    let o = splitThreads(emptyOverrides(), ['t1', 't2']);
    o = mergeThreads(o, ['t1', 't2']);
    expect(o.split).toEqual([]);
    expect(o.merge).toEqual([['t1', 't2']]);
  });

  it('a later split clears an earlier merge of the same pair', () => {
    let o = mergeThreads(emptyOverrides(), ['t1', 't2']);
    o = splitThreads(o, ['t1', 't2']);
    expect(o.merge).toEqual([]);
    expect(o.split).toEqual([['t1', 't2']]);
  });

  it('only clears the overlapping pair, not an unrelated group', () => {
    let o = mergeThreads(emptyOverrides(), ['t1', 't2']);
    o = mergeThreads(o, ['t3', 't4']);
    o = splitThreads(o, ['t1', 't2']);
    expect(o.merge).toEqual([['t3', 't4']]);
    expect(o.split).toEqual([['t1', 't2']]);
  });

  it('replaces rather than duplicates an identical group', () => {
    let o = mergeThreads(emptyOverrides(), ['t1', 't2']);
    o = mergeThreads(o, ['t2', 't1']);
    expect(o.merge).toHaveLength(1);
  });
});

describe('resetThread', () => {
  it('removes a thread from every group and drops now-singleton groups', () => {
    let o = mergeThreads(emptyOverrides(), ['t1', 't2']);
    o = splitThreads(o, ['t2', 't3']);
    o = resetThread(o, 't2');
    expect(o.merge).toEqual([]);
    expect(o.split).toEqual([]);
  });

  it('leaves a group intact when the removed thread was not in it', () => {
    const o = resetThread(mergeThreads(emptyOverrides(), ['t1', 't2']), 't9');
    expect(o.merge).toEqual([['t1', 't2']]);
  });
});

describe('field overrides', () => {
  it('sets and merges fields incrementally', () => {
    let o = setStatus(emptyOverrides(), 'acme::pm', 'interviewing');
    o = setNotes(o, 'acme::pm', 'called back Tuesday');
    expect(o.fields['acme::pm']).toEqual({ status: 'interviewing', notes: 'called back Tuesday' });
  });

  it('archives without touching other fields', () => {
    let o = setStatus(emptyOverrides(), 'acme::pm', 'withdrawn');
    o = setArchived(o, 'acme::pm', true);
    expect(o.fields['acme::pm']).toEqual({ status: 'withdrawn', archived: true });
  });

  it('clears a field by writing an empty string, dropping the key entirely once empty', () => {
    let o = setNotes(emptyOverrides(), 'acme::pm', 'a note');
    o = setNotes(o, 'acme::pm', '');
    expect(o.fields['acme::pm']).toBeUndefined();
  });

  it('clearField removes the whole override', () => {
    let o = setStatus(emptyOverrides(), 'acme::pm', 'offer');
    o = clearField(o, 'acme::pm');
    expect(o.fields['acme::pm']).toBeUndefined();
  });

  it('does not mutate the input', () => {
    const o = emptyOverrides();
    const next = setField(o, 'a', { notes: 'x' });
    expect(o.fields).toEqual({});
    expect(next).not.toBe(o);
  });
});

describe('manual applications', () => {
  it('adds one with a fresh id and trims whitespace', () => {
    const { overrides, id } = addManual(emptyOverrides(), { company: '  Acme  ', role: ' PM ', status: 'applied' }, 1000);
    expect(overrides.manual).toHaveLength(1);
    expect(overrides.manual[0]).toMatchObject({ id, company: 'Acme', role: 'PM', status: 'applied', createdAt: 1000 });
  });

  it('omits an empty role rather than storing an empty string', () => {
    const { overrides } = addManual(emptyOverrides(), { company: 'Acme', role: '  ', status: 'lead' }, 1000);
    expect(overrides.manual[0].role).toBeUndefined();
  });

  it('generates distinct ids for two adds in the same millisecond', () => {
    const a = addManual(emptyOverrides(), { company: 'A', status: 'lead' }, 1000);
    const b = addManual(a.overrides, { company: 'B', status: 'lead' }, 1000);
    expect(a.id).not.toBe(b.id);
  });

  it('updates in place', () => {
    const { overrides, id } = addManual(emptyOverrides(), { company: 'Acme', status: 'applied' }, 1000);
    const next = updateManual(overrides, id, { status: 'interviewing' });
    expect(next.manual[0].status).toBe('interviewing');
  });

  it('removes by id', () => {
    const { overrides, id } = addManual(emptyOverrides(), { company: 'Acme', status: 'applied' }, 1000);
    expect(removeManual(overrides, id).manual).toEqual([]);
  });
});

describe('review triage', () => {
  it('dismisses and un-dismisses a thread', () => {
    let o = dismissReview(emptyOverrides(), 't1');
    expect(o.dismissedReview).toEqual(['t1']);
    o = undismissReview(o, 't1');
    expect(o.dismissedReview).toEqual([]);
  });

  it('is idempotent', () => {
    let o = dismissReview(emptyOverrides(), 't1');
    o = dismissReview(o, 't1');
    expect(o.dismissedReview).toEqual(['t1']);
  });
});

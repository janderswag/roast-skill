import { describe, it, expect } from 'vitest';
import { computeDelta, formatDeltaLine, summarizeDelta } from '../delta.js';
import type { Finding } from '../types.js';

function f(overrides: Partial<Finding> & { signature?: string } = {}): Finding {
  return {
    verifier: 'semgrep',
    ruleId: 'r',
    severity: 'medium',
    path: 'src/foo.ts',
    line: 1,
    message: 'm',
    signature: 'sig-default',
    ...overrides,
  };
}

describe('computeDelta', () => {
  it('marks all current findings as `new` when previous is empty', () => {
    const current = [f({ signature: 'a' }), f({ signature: 'b' })];
    const delta = computeDelta(current, []);
    expect(delta.new).toHaveLength(2);
    expect(delta.persisted).toHaveLength(0);
    expect(delta.fixed).toHaveLength(0);
    expect(delta.regressed).toHaveLength(0);
    expect(delta.improved).toHaveLength(0);
  });

  it('marks all previous findings as `fixed` when current is empty', () => {
    const previous = [f({ signature: 'a' }), f({ signature: 'b' })];
    const delta = computeDelta([], previous);
    expect(delta.fixed).toHaveLength(2);
    expect(delta.new).toHaveLength(0);
  });

  it('marks same-signature same-severity findings as `persisted`', () => {
    const sigA = f({ signature: 'a', severity: 'high' });
    const delta = computeDelta([sigA], [sigA]);
    expect(delta.persisted).toHaveLength(1);
    expect(delta.persisted[0]!.finding).toBe(sigA);
    expect(delta.persisted[0]!.previousSeverity).toBe('high');
  });

  it('marks severity-escalated findings as `regressed`', () => {
    const previous = [f({ signature: 'a', severity: 'medium' })];
    const current = [f({ signature: 'a', severity: 'high' })];
    const delta = computeDelta(current, previous);
    expect(delta.regressed).toHaveLength(1);
    expect(delta.regressed[0]!.previousSeverity).toBe('medium');
    expect(delta.regressed[0]!.finding.severity).toBe('high');
  });

  it('marks severity-de-escalated findings as `improved`', () => {
    const previous = [f({ signature: 'a', severity: 'high' })];
    const current = [f({ signature: 'a', severity: 'low' })];
    const delta = computeDelta(current, previous);
    expect(delta.improved).toHaveLength(1);
    expect(delta.improved[0]!.previousSeverity).toBe('high');
  });

  it('correctly buckets a mixed set of findings', () => {
    const previous = [
      f({ signature: 'persisted-1', severity: 'high' }),
      f({ signature: 'fixed-1', severity: 'medium' }),
      f({ signature: 'regressed-1', severity: 'low' }),
      f({ signature: 'improved-1', severity: 'critical' }),
    ];
    const current = [
      f({ signature: 'persisted-1', severity: 'high' }),
      f({ signature: 'regressed-1', severity: 'high' }),
      f({ signature: 'improved-1', severity: 'medium' }),
      f({ signature: 'new-1', severity: 'low' }),
    ];
    const delta = computeDelta(current, previous);
    expect(delta.persisted.map((e) => e.finding.signature)).toEqual(['persisted-1']);
    expect(delta.regressed.map((e) => e.finding.signature)).toEqual(['regressed-1']);
    expect(delta.improved.map((e) => e.finding.signature)).toEqual(['improved-1']);
    expect(delta.new.map((e) => e.finding.signature)).toEqual(['new-1']);
    expect(delta.fixed.map((e) => e.finding.signature)).toEqual(['fixed-1']);
  });

  it('treats findings without signatures as always-new (current side)', () => {
    const current = [f({ signature: undefined, ruleId: 'unsigned' })];
    const delta = computeDelta(current, []);
    expect(delta.new).toHaveLength(1);
  });

  it('ignores previous findings without signatures (cannot match)', () => {
    const previous = [f({ signature: undefined })];
    const current = [f({ signature: 'a' })];
    const delta = computeDelta(current, previous);
    expect(delta.new).toHaveLength(1);
    expect(delta.fixed).toHaveLength(0); // unsigned previous is dropped
  });

  it('uses SEVERITY_RANK for comparisons (critical > high > medium > low > info)', () => {
    // info → critical = regressed
    const delta = computeDelta(
      [f({ signature: 'a', severity: 'critical' })],
      [f({ signature: 'a', severity: 'info' })],
    );
    expect(delta.regressed).toHaveLength(1);
  });

  it('does not mutate inputs', () => {
    const original = f({ signature: 'a' });
    const current = [original];
    const previous: Finding[] = [];
    computeDelta(current, previous);
    expect(current).toEqual([original]);
    expect(previous).toEqual([]);
  });
});

describe('summarizeDelta', () => {
  it('returns category counts', () => {
    const delta = computeDelta(
      [
        f({ signature: 'a', severity: 'high' }),
        f({ signature: 'b', severity: 'high' }),
        f({ signature: 'new', severity: 'low' }),
      ],
      [
        f({ signature: 'a', severity: 'high' }), // persisted
        f({ signature: 'b', severity: 'low' }), // regressed
        f({ signature: 'gone', severity: 'medium' }), // fixed
      ],
    );
    const s = summarizeDelta(delta);
    expect(s).toEqual({ new: 1, persisted: 1, regressed: 1, improved: 0, fixed: 1 });
  });
});

describe('formatDeltaLine', () => {
  it('formats a mixed delta as a compact stderr line', () => {
    const delta = computeDelta(
      [
        f({ signature: 'p', severity: 'high' }),
        f({ signature: 'new', severity: 'low' }),
      ],
      [
        f({ signature: 'p', severity: 'high' }),
        f({ signature: 'fix', severity: 'medium' }),
      ],
    );
    expect(formatDeltaLine(delta)).toBe('Δ vs previous run: 1 new · 1 persisted · 1 fixed');
  });

  it('omits zero-count categories', () => {
    const delta = computeDelta(
      [f({ signature: 'a', severity: 'high' })],
      [f({ signature: 'a', severity: 'high' })],
    );
    expect(formatDeltaLine(delta)).toBe('Δ vs previous run: 1 persisted');
  });

  it('returns a "no changes" line when delta is fully empty', () => {
    const delta = computeDelta([], []);
    expect(formatDeltaLine(delta)).toBe('Δ vs previous run: no changes');
  });

  it('shows all five categories when all are non-zero', () => {
    const delta = computeDelta(
      [
        f({ signature: 'p', severity: 'high' }),
        f({ signature: 'r', severity: 'high' }),
        f({ signature: 'i', severity: 'low' }),
        f({ signature: 'n', severity: 'medium' }),
      ],
      [
        f({ signature: 'p', severity: 'high' }),
        f({ signature: 'r', severity: 'medium' }),
        f({ signature: 'i', severity: 'high' }),
        f({ signature: 'fix', severity: 'low' }),
      ],
    );
    expect(formatDeltaLine(delta)).toBe(
      'Δ vs previous run: 1 new · 1 persisted · 1 regressed · 1 improved · 1 fixed',
    );
  });
});

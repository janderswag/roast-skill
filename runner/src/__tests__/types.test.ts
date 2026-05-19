import { describe, it, expect } from 'vitest';
import {
  FindingSchema,
  RunReportSchema,
  emptySummary,
  summarize,
  SEVERITY_RANK,
  type Finding,
} from '../types.js';

const validFinding: Finding = {
  verifier: 'semgrep',
  ruleId: 'rule-1',
  severity: 'high',
  path: 'src/foo.ts',
  line: 10,
  message: 'evidence-based finding',
};

describe('FindingSchema', () => {
  it('accepts a minimal valid finding', () => {
    expect(() => FindingSchema.parse(validFinding)).not.toThrow();
  });

  it('rejects unknown fields (strict mode)', () => {
    const result = FindingSchema.safeParse({ ...validFinding, extraField: 'no' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown verifier names', () => {
    const result = FindingSchema.safeParse({ ...validFinding, verifier: 'unknown-tool' });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive line numbers', () => {
    expect(FindingSchema.safeParse({ ...validFinding, line: 0 }).success).toBe(false);
    expect(FindingSchema.safeParse({ ...validFinding, line: -1 }).success).toBe(false);
  });

  it('rejects empty path', () => {
    expect(FindingSchema.safeParse({ ...validFinding, path: '' }).success).toBe(false);
  });

  it('rejects empty rule id', () => {
    expect(FindingSchema.safeParse({ ...validFinding, ruleId: '' }).success).toBe(false);
  });

  it('rejects empty message', () => {
    expect(FindingSchema.safeParse({ ...validFinding, message: '' }).success).toBe(false);
  });
});

describe('summarize', () => {
  it('returns zero summary on empty input', () => {
    expect(summarize([])).toEqual(emptySummary());
  });

  it('counts by severity and total', () => {
    const findings: Finding[] = [
      { ...validFinding, severity: 'critical' },
      { ...validFinding, severity: 'critical' },
      { ...validFinding, severity: 'high' },
      { ...validFinding, severity: 'medium' },
      { ...validFinding, severity: 'low' },
      { ...validFinding, severity: 'info' },
    ];
    expect(summarize(findings)).toEqual({
      critical: 2, high: 1, medium: 1, low: 1, info: 1, total: 6,
    });
  });
});

describe('SEVERITY_RANK', () => {
  it('orders critical > high > medium > low > info', () => {
    expect(SEVERITY_RANK.critical).toBeGreaterThan(SEVERITY_RANK.high);
    expect(SEVERITY_RANK.high).toBeGreaterThan(SEVERITY_RANK.medium);
    expect(SEVERITY_RANK.medium).toBeGreaterThan(SEVERITY_RANK.low);
    expect(SEVERITY_RANK.low).toBeGreaterThan(SEVERITY_RANK.info);
  });
});

describe('RunReportSchema', () => {
  it('accepts a well-formed report', () => {
    const report = {
      schemaVersion: 1,
      runnerVersion: '0.4.0',
      cwd: '/tmp/foo',
      startedAt: new Date().toISOString(),
      durationMs: 100,
      results: [],
      summary: emptySummary(),
    };
    expect(() => RunReportSchema.parse(report)).not.toThrow();
  });

  it('rejects bad schemaVersion literal', () => {
    const report = {
      schemaVersion: 2,
      runnerVersion: '0.4.0',
      cwd: '/tmp/foo',
      startedAt: new Date().toISOString(),
      durationMs: 0,
      results: [],
      summary: emptySummary(),
    };
    expect(RunReportSchema.safeParse(report).success).toBe(false);
  });
});

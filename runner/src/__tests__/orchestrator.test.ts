import { describe, it, expect } from 'vitest';
import { runOrchestrator, SCHEMA_VERSION, RUNNER_VERSION } from '../orchestrator.js';
import type { Verifier } from '../verifier.js';
import { ok, skipped, errored } from '../verifier.js';
import type { Finding, VerifierName } from '../types.js';
import { RunReportSchema } from '../types.js';

function fakeVerifier(name: VerifierName, behavior: 'ok' | 'unavailable' | 'error' | 'throw', findings: Finding[] = []): Verifier {
  return {
    name,
    async isAvailable() {
      if (behavior === 'unavailable') return { available: false, reason: 'planted: tool missing' };
      return { available: true };
    },
    async run() {
      if (behavior === 'throw') throw new Error('planted throw');
      if (behavior === 'error') return errored(name, 'planted error', 5);
      return ok(name, findings, 5);
    },
  };
}

const baseFinding: Finding = {
  verifier: 'semgrep',
  ruleId: 'planted',
  severity: 'high',
  path: 'x.ts',
  line: 1,
  message: 'planted',
};

describe('runOrchestrator', () => {
  it('produces a schema-valid RunReport', async () => {
    const report = await runOrchestrator({
      cwd: process.cwd(),
      timeoutMs: 5_000,
      verifiers: [fakeVerifier('semgrep', 'ok', [baseFinding])],
    });
    expect(() => RunReportSchema.parse(report)).not.toThrow();
    expect(report.schemaVersion).toBe(SCHEMA_VERSION);
    expect(report.runnerVersion).toBe(RUNNER_VERSION);
  });

  it('aggregates findings into a correct summary', async () => {
    const findings: Finding[] = [
      { ...baseFinding, severity: 'critical' },
      { ...baseFinding, severity: 'high' },
      { ...baseFinding, severity: 'medium' },
    ];
    const report = await runOrchestrator({
      cwd: process.cwd(),
      timeoutMs: 5_000,
      verifiers: [fakeVerifier('semgrep', 'ok', findings)],
    });
    expect(report.summary.critical).toBe(1);
    expect(report.summary.high).toBe(1);
    expect(report.summary.medium).toBe(1);
    expect(report.summary.total).toBe(3);
  });

  it('marks unavailable verifiers as skipped with reason', async () => {
    const report = await runOrchestrator({
      cwd: process.cwd(),
      timeoutMs: 5_000,
      verifiers: [fakeVerifier('semgrep', 'unavailable')],
    });
    expect(report.results[0]?.status).toBe('skipped');
    expect(report.results[0]?.reason).toMatch(/planted/);
    expect(report.results[0]?.findings.length).toBe(0);
  });

  it('captures thrown errors as error status, never propagates', async () => {
    const report = await runOrchestrator({
      cwd: process.cwd(),
      timeoutMs: 5_000,
      verifiers: [fakeVerifier('semgrep', 'throw')],
    });
    expect(report.results[0]?.status).toBe('error');
    expect(report.results[0]?.reason).toMatch(/planted throw/);
  });

  it('runs multiple verifiers and sorts results by name', async () => {
    const report = await runOrchestrator({
      cwd: process.cwd(),
      timeoutMs: 5_000,
      verifiers: [
        fakeVerifier('semgrep', 'ok'),
        fakeVerifier('dep-audit', 'ok'),
        fakeVerifier('gitleaks', 'ok'),
      ],
    });
    expect(report.results.map((r) => r.verifier)).toEqual(['dep-audit', 'gitleaks', 'semgrep']);
  });

  it('respects the enabled filter', async () => {
    const report = await runOrchestrator({
      cwd: process.cwd(),
      timeoutMs: 5_000,
      verifiers: [
        fakeVerifier('semgrep', 'ok'),
        fakeVerifier('gitleaks', 'ok'),
        fakeVerifier('dep-audit', 'ok'),
      ],
      enabled: new Set(['semgrep']),
    });
    expect(report.results.length).toBe(1);
    expect(report.results[0]?.verifier).toBe('semgrep');
  });

  it('sorts findings within each result by severity then path then line', async () => {
    const findings: Finding[] = [
      { ...baseFinding, severity: 'low', path: 'b.ts', line: 1 },
      { ...baseFinding, severity: 'critical', path: 'a.ts', line: 5 },
      { ...baseFinding, severity: 'high', path: 'a.ts', line: 1 },
    ];
    const report = await runOrchestrator({
      cwd: process.cwd(),
      timeoutMs: 5_000,
      verifiers: [fakeVerifier('semgrep', 'ok', findings)],
    });
    const sorted = report.results[0]!.findings;
    expect(sorted[0]?.severity).toBe('critical');
    expect(sorted[1]?.severity).toBe('high');
    expect(sorted[2]?.severity).toBe('low');
  });
});

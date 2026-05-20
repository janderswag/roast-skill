import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildExportPayload, writeExportPayload, ExportPayloadSchema } from '../export.js';
import type { Finding, RunReport } from '../types.js';

const baseFinding: Finding = {
  verifier: 'semgrep',
  ruleId: 'rule.eval',
  severity: 'high',
  path: 'src/danger.ts',
  line: 12,
  message: 'eval of user input',
  evidence: '  const x = eval(req.body);',
};

const secretFinding: Finding = {
  verifier: 'gitleaks',
  ruleId: 'aws-access-token',
  severity: 'critical',
  path: 'config.js',
  line: 3,
  message: 'AWS key',
  evidence: '[REDACTED:len=20]',
  fix: 'rotate the credential immediately',
};

const report = (findings: Finding[]): RunReport => ({
  schemaVersion: 1,
  runnerVersion: '0.6.0',
  cwd: '/Users/secret/SHOULD/NOT/LEAK/my-project',
  startedAt: new Date().toISOString(),
  durationMs: 1234,
  results: [
    {
      verifier: 'semgrep',
      status: 'ok',
      findings,
      durationMs: 1000,
    },
  ],
  summary: {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: 0,
    low: 0,
    info: 0,
    total: findings.length,
  },
});

const git = { isRepo: true, head: 'abc1234', dirty: false, branch: 'main' };

describe('buildExportPayload', () => {
  it('produces a schema-valid ExportPayload', () => {
    const payload = buildExportPayload({
      report: report([baseFinding]),
      git,
      url: undefined,
      cwd: '/Users/me/Desktop/my-project',
    });
    expect(() => ExportPayloadSchema.parse(payload)).not.toThrow();
  });

  it('NEVER includes the full cwd path anywhere in the payload', () => {
    const payload = buildExportPayload({
      report: report([baseFinding]),
      git,
      url: undefined,
      cwd: '/Users/secret/SHOULD/NOT/LEAK/my-project',
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('/Users/secret');
    expect(serialized).not.toContain('SHOULD/NOT/LEAK');
    expect(payload.claim_metadata.cwd_basename).toBe('my-project');
  });

  it('NEVER leaks unredacted secrets from gitleaks findings', () => {
    const payload = buildExportPayload({
      report: report([secretFinding]),
      git,
      url: undefined,
      cwd: '/tmp/test',
    });
    const serialized = JSON.stringify(payload);
    // The fixture's redacted form should be present...
    expect(serialized).toContain('[REDACTED:len=20]');
    // ...but no AWS-key-shaped strings should leak (sanity check)
    expect(serialized).not.toMatch(/AKIA[0-9A-Z]{16}/);
  });

  it('builds an accurate _privacy block', () => {
    const payload = buildExportPayload({
      report: report([baseFinding, secretFinding]),
      git,
      url: 'https://example.com',
      cwd: '/tmp/test',
    });
    expect(payload._privacy.finding_count).toBe(2);
    expect(payload._privacy.file_paths_referenced).toBe(2);
    expect(payload._privacy.redacted_evidence_count).toBe(1); // only the gitleaks one has [REDACTED:
    expect(payload._privacy.snippet_count).toBe(2);
    expect(payload._privacy.max_snippet_chars).toBeGreaterThan(0);
  });

  it('mentions the URL in what_we_send only when --url was passed', () => {
    const local = buildExportPayload({ report: report([baseFinding]), git, url: undefined, cwd: '/tmp/t' });
    expect(local._privacy.what_we_send.some((s) => s.toLowerCase().includes('url'))).toBe(false);

    const live = buildExportPayload({ report: report([baseFinding]), git, url: 'https://example.com', cwd: '/tmp/t' });
    expect(live._privacy.what_we_send.some((s) => s.toLowerCase().includes('url'))).toBe(true);
  });

  it('generates a fresh claim code per call', () => {
    const a = buildExportPayload({ report: report([baseFinding]), git, url: undefined, cwd: '/tmp/t' });
    const b = buildExportPayload({ report: report([baseFinding]), git, url: undefined, cwd: '/tmp/t' });
    expect(a.claim_metadata.claim_code).not.toBe(b.claim_metadata.claim_code);
  });

  it('content_hash is deterministic for identical inputs', () => {
    const a = buildExportPayload({ report: report([baseFinding]), git, url: undefined, cwd: '/tmp/t' });
    const b = buildExportPayload({ report: report([baseFinding]), git, url: undefined, cwd: '/tmp/t' });
    expect(a.claim_metadata.content_hash).toBe(b.claim_metadata.content_hash);
  });

  it('resume_url contains the claim code', () => {
    const payload = buildExportPayload({ report: report([baseFinding]), git, url: undefined, cwd: '/tmp/t' });
    expect(payload.claim_metadata.resume_url).toContain(payload.claim_metadata.claim_code);
    expect(payload.claim_metadata.resume_url.startsWith('https://www.roastrebuild.com/resume')).toBe(true);
  });

  it('falls back to "unknown" basename when cwd has no trailing segment', () => {
    const payload = buildExportPayload({ report: report([baseFinding]), git, url: undefined, cwd: '/' });
    expect(payload.claim_metadata.cwd_basename).toBe('unknown');
  });
});

describe('writeExportPayload', () => {
  it('writes JSON to disk and returns absolute path + byte count', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'roast-export-test-'));
    try {
      const payload = buildExportPayload({
        report: report([baseFinding]),
        git,
        url: undefined,
        cwd: '/tmp/t',
      });
      const outPath = join(dir, 'roast.json');
      const { bytesWritten, absolutePath } = await writeExportPayload(payload, outPath);

      expect(absolutePath).toBe(outPath);
      expect(bytesWritten).toBeGreaterThan(0);

      const onDisk = await readFile(outPath, 'utf8');
      const parsed = JSON.parse(onDisk);
      expect(() => ExportPayloadSchema.parse(parsed)).not.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  applyTriage,
  ensureRoastDir,
  getRoastDir,
  loadPreviousRun,
  loadTriage,
  ROAST_DIR_NAME,
  savePreviousRun,
  setTriageEntry,
  TRIAGE_FILE,
  LAST_AUDIT_FILE,
} from '../state.js';
import type { Finding, RunReport } from '../types.js';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'roast-state-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

const sampleReport: RunReport = {
  schemaVersion: 1,
  runnerVersion: '0.7.0',
  cwd: '/tmp/test',
  startedAt: '2026-05-20T00:00:00.000Z',
  durationMs: 1234,
  results: [
    {
      verifier: 'semgrep',
      status: 'ok',
      findings: [
        {
          verifier: 'semgrep',
          ruleId: 'r1',
          severity: 'high',
          path: 'src/foo.ts',
          line: 10,
          message: 'sample',
          signature: 'a3f7c9d2e4b18560',
        },
      ],
      durationMs: 100,
    },
  ],
  summary: { critical: 0, high: 1, medium: 0, low: 0, info: 0, total: 1 },
};

describe('getRoastDir', () => {
  it('returns <cwd>/.roast', () => {
    expect(getRoastDir('/tmp/foo')).toBe(`/tmp/foo/${ROAST_DIR_NAME}`);
  });
});

describe('ensureRoastDir', () => {
  it('creates the directory if it does not exist', async () => {
    const dir = await ensureRoastDir(testDir);
    expect(dir).toBe(join(testDir, ROAST_DIR_NAME));
    // Calling again is idempotent (does not throw)
    await ensureRoastDir(testDir);
  });
});

describe('savePreviousRun + loadPreviousRun (round-trip)', () => {
  it('returns null when no file exists', async () => {
    const loaded = await loadPreviousRun(testDir);
    expect(loaded).toBeNull();
  });

  it('persists and reloads a RunReport faithfully', async () => {
    await savePreviousRun(testDir, sampleReport);
    const loaded = await loadPreviousRun(testDir);
    expect(loaded).toEqual(sampleReport);
  });

  it('overwrites an existing file', async () => {
    await savePreviousRun(testDir, sampleReport);
    const modified: RunReport = { ...sampleReport, durationMs: 9999 };
    await savePreviousRun(testDir, modified);
    const loaded = await loadPreviousRun(testDir);
    expect(loaded?.durationMs).toBe(9999);
  });

  it('returns null on malformed JSON (does not throw)', async () => {
    await mkdir(join(testDir, ROAST_DIR_NAME), { recursive: true });
    await writeFile(join(testDir, ROAST_DIR_NAME, LAST_AUDIT_FILE), '{ not json', 'utf8');
    const loaded = await loadPreviousRun(testDir);
    expect(loaded).toBeNull();
  });

  it('returns null when JSON does not match RunReport schema', async () => {
    await mkdir(join(testDir, ROAST_DIR_NAME), { recursive: true });
    await writeFile(
      join(testDir, ROAST_DIR_NAME, LAST_AUDIT_FILE),
      JSON.stringify({ wrong: 'shape' }),
      'utf8',
    );
    const loaded = await loadPreviousRun(testDir);
    expect(loaded).toBeNull();
  });
});

describe('loadTriage + setTriageEntry', () => {
  it('returns empty map when no file exists', async () => {
    const triage = await loadTriage(testDir);
    expect(triage.size).toBe(0);
  });

  it('persists and reloads a single triage entry', async () => {
    await setTriageEntry(testDir, 'a3f7c9d2e4b18560', 'wont-fix', 'not exploitable on our surface');
    const triage = await loadTriage(testDir);
    expect(triage.size).toBe(1);
    expect(triage.get('a3f7c9d2e4b18560')).toBe('wont-fix');
  });

  it('persists multiple entries across calls (no overwrite)', async () => {
    await setTriageEntry(testDir, 'sig1', 'wont-fix');
    await setTriageEntry(testDir, 'sig2', 'false-positive');
    const triage = await loadTriage(testDir);
    expect(triage.size).toBe(2);
    expect(triage.get('sig1')).toBe('wont-fix');
    expect(triage.get('sig2')).toBe('false-positive');
  });

  it('updates an existing entry (status change)', async () => {
    await setTriageEntry(testDir, 'sig1', 'wont-fix');
    await setTriageEntry(testDir, 'sig1', 'uncertain');
    const triage = await loadTriage(testDir);
    expect(triage.get('sig1')).toBe('uncertain');
  });

  it('removes an entry when status=null', async () => {
    await setTriageEntry(testDir, 'sig1', 'wont-fix');
    await setTriageEntry(testDir, 'sig1', null);
    const triage = await loadTriage(testDir);
    expect(triage.has('sig1')).toBe(false);
  });

  it('writes a note + updatedAt timestamp', async () => {
    await setTriageEntry(testDir, 'sig1', 'wont-fix', 'low risk, will revisit');
    const raw = await readFile(join(testDir, ROAST_DIR_NAME, TRIAGE_FILE), 'utf8');
    const parsed = JSON.parse(raw) as { entries: Record<string, { note: string; updatedAt: string }> };
    expect(parsed.entries['sig1']!.note).toBe('low risk, will revisit');
    expect(parsed.entries['sig1']!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns empty map on malformed triage file', async () => {
    await mkdir(join(testDir, ROAST_DIR_NAME), { recursive: true });
    await writeFile(join(testDir, ROAST_DIR_NAME, TRIAGE_FILE), 'totally not json', 'utf8');
    const triage = await loadTriage(testDir);
    expect(triage.size).toBe(0);
  });

  it('returns empty map on triage file with wrong shape', async () => {
    await mkdir(join(testDir, ROAST_DIR_NAME), { recursive: true });
    await writeFile(
      join(testDir, ROAST_DIR_NAME, TRIAGE_FILE),
      JSON.stringify({ entries: 'should-be-object' }),
      'utf8',
    );
    const triage = await loadTriage(testDir);
    expect(triage.size).toBe(0);
  });
});

describe('applyTriage', () => {
  const f = (sig: string | undefined): Finding => ({
    verifier: 'semgrep',
    ruleId: 'r',
    severity: 'high',
    path: 'src/foo.ts',
    line: 1,
    message: 'm',
    ...(sig !== undefined ? { signature: sig } : {}),
  });

  it('returns input unchanged when triage map is empty', () => {
    const findings = [f('sig1'), f('sig2')];
    const empty = new Map();
    const result = applyTriage(findings, empty);
    expect(result).toBe(findings); // referential equality (cheap fast-path)
  });

  it('overwrites status on matching findings', () => {
    const findings = [f('sig1'), f('sig2'), f('sig3')];
    const triage = new Map<string, 'wont-fix' | 'false-positive'>([
      ['sig1', 'wont-fix'],
      ['sig3', 'false-positive'],
    ]);
    const result = applyTriage(findings, triage);
    expect(result[0]!.status).toBe('wont-fix');
    expect(result[1]!.status).toBeUndefined();
    expect(result[2]!.status).toBe('false-positive');
  });

  it('ignores findings without a signature (legacy data)', () => {
    const findings = [f(undefined), f('sig1')];
    const triage = new Map<string, 'wont-fix'>([['sig1', 'wont-fix']]);
    const result = applyTriage(findings, triage);
    expect(result[0]!.status).toBeUndefined();
    expect(result[1]!.status).toBe('wont-fix');
  });

  it('does not mutate input findings', () => {
    const findings = [f('sig1')];
    const triage = new Map<string, 'wont-fix'>([['sig1', 'wont-fix']]);
    applyTriage(findings, triage);
    expect(findings[0]!.status).toBeUndefined();
  });

  it('preserves all other finding fields', () => {
    const original: Finding = {
      verifier: 'semgrep',
      ruleId: 'r1',
      severity: 'high',
      path: 'src/foo.ts',
      line: 42,
      endLine: 50,
      message: 'msg',
      evidence: 'evidence',
      fix: 'fix',
      cwe: 'CWE-79',
      owasp: 'A03',
      signature: 'sig1',
      trustBoundaries: ['user-input'],
    };
    const triage = new Map<string, 'wont-fix'>([['sig1', 'wont-fix']]);
    const result = applyTriage([original], triage);
    expect(result[0]).toEqual({ ...original, status: 'wont-fix' });
  });
});

describe('full round-trip — save report, mark triage, reload, apply', () => {
  it('integrates loadPreviousRun + loadTriage + applyTriage', async () => {
    await savePreviousRun(testDir, sampleReport);
    await setTriageEntry(testDir, 'a3f7c9d2e4b18560', 'wont-fix', 'noted on 2026-05-20');

    const loaded = await loadPreviousRun(testDir);
    const triage = await loadTriage(testDir);
    expect(loaded).not.toBeNull();
    expect(triage.size).toBe(1);

    const findings = loaded!.results.flatMap((r) => r.findings);
    const triaged = applyTriage(findings, triage);
    expect(triaged[0]!.status).toBe('wont-fix');
  });
});

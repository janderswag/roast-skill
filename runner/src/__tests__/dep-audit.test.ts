import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { depAuditVerifier } from '../verifiers/dep-audit.js';
import { parseSemVer, minVersionFromSpec, lt, formatSemVer } from '../verifiers/dep-audit.js';

const ctx = (cwd: string) => ({
  cwd,
  timeoutMs: 10_000,
  signal: new AbortController().signal,
});

async function writeRepo(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'roast-dep-audit-'));
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    await mkdir(join(full, '..'), { recursive: true }).catch(() => undefined);
    await writeFile(full, content, 'utf8');
  }
  return dir;
}

describe('semver helpers', () => {
  it('parses M.m.p', () => {
    expect(parseSemVer('1.2.3')).toEqual([1, 2, 3]);
    expect(parseSemVer('v10.20.30')).toEqual([10, 20, 30]);
    expect(parseSemVer('1.2.3-beta.1')).toEqual([1, 2, 3]);
  });

  it('returns null on invalid input', () => {
    expect(parseSemVer('')).toBeNull();
    expect(parseSemVer('latest')).toBeNull();
    expect(parseSemVer('not.a.version')).toBeNull();
  });

  it('extracts minimum allowed version from npm specifiers', () => {
    expect(minVersionFromSpec('^1.2.3')).toEqual([1, 2, 3]);
    expect(minVersionFromSpec('~4.5.6')).toEqual([4, 5, 6]);
    expect(minVersionFromSpec('>= 7.8.9')).toEqual([7, 8, 9]);
    expect(minVersionFromSpec('1.2.3')).toEqual([1, 2, 3]);
  });

  it('returns null for git/url/file specs', () => {
    expect(minVersionFromSpec('git+https://github.com/foo/bar.git')).toBeNull();
    expect(minVersionFromSpec('file:../local')).toBeNull();
    expect(minVersionFromSpec('https://example.com/pkg.tgz')).toBeNull();
  });

  it('compares semver tuples correctly', () => {
    expect(lt([1, 0, 0], [1, 0, 1])).toBe(true);
    expect(lt([1, 0, 1], [1, 0, 0])).toBe(false);
    expect(lt([0, 9, 99], [1, 0, 0])).toBe(true);
    expect(lt([1, 1, 0], [1, 0, 99])).toBe(false);
  });

  it('formats semver tuples', () => {
    expect(formatSemVer([1, 2, 3])).toBe('1.2.3');
  });
});

describe('depAuditVerifier', () => {
  it('skips when no package.json present', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'roast-dep-empty-'));
    try {
      const avail = await depAuditVerifier.isAvailable(ctx(dir));
      expect(avail.available).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('flags known-vulnerable dependency (lodash@<4.17.21)', async () => {
    const dir = await writeRepo({
      'package.json': JSON.stringify({
        name: 't', version: '0.0.0',
        dependencies: { lodash: '4.17.20' },
      }),
    });
    try {
      const result = await depAuditVerifier.run(ctx(dir));
      expect(result.status).toBe('ok');
      const lodashFinding = result.findings.find((f) => f.ruleId.includes('lodash'));
      expect(lodashFinding).toBeDefined();
      expect(lodashFinding!.severity).toBe('high');
      expect(lodashFinding!.message).toContain('4.17.20');
      expect(lodashFinding!.fix).toContain('upgrade lodash');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('flags misplaced build tools in dependencies', async () => {
    const dir = await writeRepo({
      'package.json': JSON.stringify({
        name: 't', version: '0.0.0',
        dependencies: { eslint: '^8.0.0', tsx: '^4.0.0' },
      }),
    });
    try {
      const result = await depAuditVerifier.run(ctx(dir));
      const misplaced = result.findings.filter((f) => f.ruleId.startsWith('misplaced-dev-dep'));
      expect(misplaced.length).toBe(2);
      expect(misplaced.every((f) => f.severity === 'low')).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('flags missing lockfile when deps are declared', async () => {
    const dir = await writeRepo({
      'package.json': JSON.stringify({
        name: 't', version: '0.0.0',
        dependencies: { 'left-pad': '^1.0.0' },
      }),
    });
    try {
      const result = await depAuditVerifier.run(ctx(dir));
      const lockfile = result.findings.find((f) => f.ruleId === 'missing-lockfile');
      expect(lockfile).toBeDefined();
      expect(lockfile!.severity).toBe('medium');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('does NOT flag missing lockfile when no deps declared', async () => {
    const dir = await writeRepo({
      'package.json': JSON.stringify({ name: 't', version: '0.0.0' }),
    });
    try {
      const result = await depAuditVerifier.run(ctx(dir));
      expect(result.findings.find((f) => f.ruleId === 'missing-lockfile')).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('uses resolved version from package-lock.json when present', async () => {
    const dir = await writeRepo({
      'package.json': JSON.stringify({
        name: 't', version: '0.0.0',
        dependencies: { lodash: '^4.17.0' },
      }),
      'package-lock.json': JSON.stringify({
        name: 't', version: '0.0.0', lockfileVersion: 3,
        packages: {
          '': { name: 't', version: '0.0.0' },
          'node_modules/lodash': { version: '4.17.22' },
        },
      }),
    });
    try {
      const result = await depAuditVerifier.run(ctx(dir));
      const lodash = result.findings.find((f) => f.ruleId.includes('lodash'));
      // Lockfile says 4.17.22, which is >= 4.17.21 fix — should NOT flag.
      expect(lodash).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('skips gracefully on malformed package.json', async () => {
    const dir = await writeRepo({ 'package.json': '{ not valid json' });
    try {
      const result = await depAuditVerifier.run(ctx(dir));
      expect(result.status).toBe('skipped');
      expect(result.reason).toMatch(/JSON|parse/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('handles the known-bad fixture end-to-end', async () => {
    const fixtureDir = join(__dirname, '..', '..', 'fixtures', 'known-bad');
    const result = await depAuditVerifier.run(ctx(fixtureDir));
    expect(result.status).toBe('ok');
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.some((f) => f.ruleId.includes('lodash'))).toBe(true);
    expect(result.findings.some((f) => f.ruleId.includes('jsonwebtoken'))).toBe(true);
    expect(result.findings.some((f) => f.ruleId.includes('misplaced-dev-dep/eslint'))).toBe(true);
    expect(result.findings.some((f) => f.ruleId === 'missing-lockfile')).toBe(true);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { semgrepVerifier } from '../verifiers/semgrep.js';
import { gitleaksVerifier } from '../verifiers/gitleaks.js';

const fixtureDir = join(__dirname, '..', '..', 'fixtures', 'known-bad');

function isInstalled(cmd: string): boolean {
  try {
    execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const ctx = () => ({
  cwd: fixtureDir,
  url: undefined,
  cacheDir: '/tmp/roast-test-cache',
  timeoutMs: 60_000,
  signal: new AbortController().signal,
});

const hasSemgrep = isInstalled('semgrep');
const hasGitleaks = isInstalled('gitleaks');

describe.skipIf(!hasSemgrep)('semgrep integration (requires semgrep installed)', () => {
  it('isAvailable returns true', async () => {
    const avail = await semgrepVerifier.isAvailable(ctx());
    expect(avail.available).toBe(true);
  });

  it('detects planted vulnerabilities in the fixture and produces well-shaped findings', async () => {
    const result = await semgrepVerifier.run(ctx());
    expect(result.status).toBe('ok');
    expect(result.findings.length).toBeGreaterThan(0);
    // Every finding must reference the planted file and parse to our schema shape.
    for (const f of result.findings) {
      expect(f.verifier).toBe('semgrep');
      expect(f.path).toContain('danger');
      expect(f.line).toBeGreaterThan(0);
      expect(f.ruleId.length).toBeGreaterThan(0);
      expect(f.message.length).toBeGreaterThan(0);
    }
    // At least one finding should be high-severity (the planted eval / XSS / open-redirect are all ERROR/WARNING).
    expect(result.findings.some((f) => f.severity === 'high' || f.severity === 'medium')).toBe(true);
  });
});

describe.skipIf(hasSemgrep)('semgrep absence path', () => {
  it('reports unavailable when semgrep is not installed', async () => {
    const avail = await semgrepVerifier.isAvailable(ctx());
    expect(avail.available).toBe(false);
    if (!avail.available) {
      expect(avail.reason).toMatch(/not installed/i);
    }
  });
});

describe.skipIf(!hasGitleaks)('gitleaks integration (requires gitleaks installed + .git in fixture)', () => {
  it('isAvailable returns false on fixture (no .git directory)', async () => {
    // The known-bad fixture intentionally has no .git — gitleaks should skip cleanly.
    const avail = await gitleaksVerifier.isAvailable(ctx());
    expect(avail.available).toBe(false);
    if (!avail.available) {
      expect(avail.reason).toMatch(/git/i);
    }
  });
});

describe.skipIf(hasGitleaks)('gitleaks absence path', () => {
  it('reports unavailable when gitleaks is not installed', async () => {
    // Use a path with a .git to isolate the "tool missing" branch from the "no .git" branch.
    const repoRoot = join(__dirname, '..', '..', '..');
    const repoCtx = {
      cwd: repoRoot,
      url: undefined,
      cacheDir: '/tmp/roast-test-cache',
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    };
    const avail = await gitleaksVerifier.isAvailable(repoCtx);
    expect(avail.available).toBe(false);
  });
});

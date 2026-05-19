import { describe, it, expect } from 'vitest';
import { main } from '../cli.js';
import { join } from 'node:path';

function captureStdout(): { write: (s: string) => boolean; text: () => string; restore: () => void } {
  const buf: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  const write = ((s: string) => { buf.push(s); return true; }) as typeof process.stdout.write;
  process.stdout.write = write;
  return {
    write,
    text: () => buf.join(''),
    restore: () => { process.stdout.write = original; },
  };
}

function captureStderr(): { text: () => string; restore: () => void } {
  const buf: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((s: string) => { buf.push(s); return true; }) as typeof process.stderr.write;
  return {
    text: () => buf.join(''),
    restore: () => { process.stderr.write = original; },
  };
}

describe('cli.main', () => {
  it('prints help and exits 0 on --help', async () => {
    const out = captureStdout();
    try {
      const code = await main(['--help']);
      expect(code).toBe(0);
      expect(out.text()).toContain('Usage: roast-runner');
    } finally {
      out.restore();
    }
  });

  it('prints version and exits 0 on --version', async () => {
    const out = captureStdout();
    try {
      const code = await main(['--version']);
      expect(code).toBe(0);
      expect(out.text().trim()).toMatch(/^\d+\.\d+\.\d+$/);
    } finally {
      out.restore();
    }
  });

  it('rejects unknown flags with exit 2', async () => {
    const err = captureStderr();
    try {
      const code = await main(['--nope']);
      expect(code).toBe(2);
      expect(err.text()).toContain('unknown argument');
    } finally {
      err.restore();
    }
  });

  it('rejects unknown verifier names', async () => {
    const err = captureStderr();
    try {
      const code = await main(['--verifiers', 'foo,bar']);
      expect(code).toBe(2);
      expect(err.text()).toContain('unknown verifier');
    } finally {
      err.restore();
    }
  });

  it('rejects negative timeout', async () => {
    const err = captureStderr();
    try {
      const code = await main(['--timeout-ms', '-1']);
      expect(code).toBe(2);
    } finally {
      err.restore();
    }
  });

  it('rejects nonexistent cwd', async () => {
    const err = captureStderr();
    try {
      const code = await main(['--cwd', '/this/path/does/not/exist/zzz']);
      expect(code).toBe(2);
    } finally {
      err.restore();
    }
  });

  it('rejects malformed --url', async () => {
    const err = captureStderr();
    try {
      const code = await main(['--url', 'not-a-url']);
      expect(code).toBe(2);
      expect(err.text()).toMatch(/not a valid URL/);
    } finally {
      err.restore();
    }
  });

  it('rejects non-http(s) --url protocols', async () => {
    const err = captureStderr();
    try {
      const code = await main(['--url', 'file:///etc/passwd']);
      expect(code).toBe(2);
      expect(err.text()).toMatch(/must use http or https/);
    } finally {
      err.restore();
    }
  });

  it('accepts well-formed http and https URLs', async () => {
    // We can't actually run --url end-to-end in a unit test without Playwright
    // installed, but argv parsing should succeed and skip the live verifiers
    // when their isAvailable() runs. Instead we just confirm arg parsing alone
    // does not error out for the URL.
    const err = captureStderr();
    const out = captureStdout();
    try {
      // Use --verifiers dep-audit to avoid actually invoking live-browser/lighthouse here.
      const fixtureDir = join(__dirname, '..', '..', 'fixtures', 'known-bad');
      const code = await main([
        '--cwd', fixtureDir,
        '--url', 'https://example.com/',
        '--verifiers', 'dep-audit',
        '--timeout-ms', '15000',
      ]);
      expect(code).toBe(0);
      const parsed: unknown = JSON.parse(out.text());
      expect(parsed).toMatchObject({ schemaVersion: 1 });
    } finally {
      err.restore();
      out.restore();
    }
  });

  it('runs against the known-bad fixture and prints valid JSON to stdout', async () => {
    const out = captureStdout();
    const fixtureDir = join(__dirname, '..', '..', 'fixtures', 'known-bad');
    try {
      const code = await main(['--cwd', fixtureDir, '--verifiers', 'dep-audit', '--timeout-ms', '15000']);
      expect(code).toBe(0);
      const parsed: unknown = JSON.parse(out.text());
      expect(parsed).toMatchObject({
        schemaVersion: 1,
        runnerVersion: expect.any(String),
      });
    } finally {
      out.restore();
    }
  });
});

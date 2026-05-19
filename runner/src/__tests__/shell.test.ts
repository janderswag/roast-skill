import { describe, it, expect } from 'vitest';
import { run, commandExists, CommandNotFoundError } from '../shell.js';

const fresh = (): AbortSignal => new AbortController().signal;

describe('run', () => {
  it('captures stdout from a successful command', async () => {
    const result = await run('node', ['-e', 'process.stdout.write("hello")'], {
      cwd: process.cwd(),
      signal: fresh(),
      timeoutMs: 5_000,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello');
    expect(result.timedOut).toBe(false);
    expect(result.aborted).toBe(false);
  });

  it('captures non-zero exit code without throwing', async () => {
    const result = await run('node', ['-e', 'process.exit(3)'], {
      cwd: process.cwd(),
      signal: fresh(),
      timeoutMs: 5_000,
    });
    expect(result.exitCode).toBe(3);
  });

  it('throws CommandNotFoundError for missing binary', async () => {
    await expect(
      run('this-binary-does-not-exist-zzz', [], {
        cwd: process.cwd(),
        signal: fresh(),
        timeoutMs: 2_000,
      }),
    ).rejects.toBeInstanceOf(CommandNotFoundError);
  });

  it('enforces timeoutMs and sets timedOut=true', async () => {
    const result = await run('node', ['-e', 'setTimeout(()=>{}, 60000)'], {
      cwd: process.cwd(),
      signal: fresh(),
      timeoutMs: 250,
    });
    expect(result.timedOut).toBe(true);
    expect(result.exitCode === null || result.exitCode !== 0).toBe(true);
  });

  it('responds to external abort signal', async () => {
    const controller = new AbortController();
    const promise = run('node', ['-e', 'setTimeout(()=>{}, 60000)'], {
      cwd: process.cwd(),
      signal: controller.signal,
      timeoutMs: 30_000,
    });
    setTimeout(() => controller.abort(), 100);
    const result = await promise;
    expect(result.aborted).toBe(true);
  });

  it('truncates stdout above the byte limit', async () => {
    const result = await run('node', ['-e', 'process.stdout.write("x".repeat(100000))'], {
      cwd: process.cwd(),
      signal: fresh(),
      timeoutMs: 5_000,
      stdoutLimitBytes: 1024,
    });
    expect(result.truncated.stdout).toBe(true);
    expect(result.stdout.length).toBeLessThanOrEqual(1024);
  });
});

describe('commandExists', () => {
  it('returns true for a binary that exists (node)', async () => {
    expect(await commandExists('node', { signal: fresh() })).toBe(true);
  });

  it('returns false for a binary that does not exist', async () => {
    expect(await commandExists('binary-zzz-does-not-exist', { signal: fresh() })).toBe(false);
  });
});

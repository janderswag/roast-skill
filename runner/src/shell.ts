import { spawn } from 'node:child_process';
import { once } from 'node:events';

const STDOUT_LIMIT_BYTES = 16 * 1024 * 1024;
const STDERR_LIMIT_BYTES = 1 * 1024 * 1024;

export interface RunOptions {
  readonly cwd: string;
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdoutLimitBytes?: number;
  readonly stderrLimitBytes?: number;
}

export interface RunResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly aborted: boolean;
  readonly truncated: { stdout: boolean; stderr: boolean };
  readonly durationMs: number;
}

export class CommandNotFoundError extends Error {
  override readonly name = 'CommandNotFoundError';
  constructor(public readonly command: string) {
    super(`command not found: ${command}`);
  }
}

export async function run(
  command: string,
  args: readonly string[],
  options: RunOptions,
): Promise<RunResult> {
  const started = performance.now();
  const stdoutLimit = options.stdoutLimitBytes ?? STDOUT_LIMIT_BYTES;
  const stderrLimit = options.stderrLimitBytes ?? STDERR_LIMIT_BYTES;

  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let stdoutTruncated = false;
  let stderrTruncated = false;
  let timedOut = false;
  let aborted = false;

  child.stdout.on('data', (chunk: Buffer) => {
    if (stdoutBytes + chunk.length <= stdoutLimit) {
      stdoutChunks.push(chunk);
      stdoutBytes += chunk.length;
      return;
    }
    const remaining = stdoutLimit - stdoutBytes;
    if (remaining > 0) stdoutChunks.push(chunk.subarray(0, remaining));
    stdoutBytes = stdoutLimit;
    stdoutTruncated = true;
    child.kill('SIGTERM');
  });

  child.stderr.on('data', (chunk: Buffer) => {
    if (stderrBytes + chunk.length <= stderrLimit) {
      stderrChunks.push(chunk);
      stderrBytes += chunk.length;
      return;
    }
    const remaining = stderrLimit - stderrBytes;
    if (remaining > 0) stderrChunks.push(chunk.subarray(0, remaining));
    stderrBytes = stderrLimit;
    stderrTruncated = true;
  });

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 2000).unref();
  }, options.timeoutMs);
  timer.unref();

  const onAbort = (): void => {
    aborted = true;
    child.kill('SIGTERM');
  };
  options.signal.addEventListener('abort', onAbort, { once: true });

  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;

  try {
    const spawnErrorPromise = new Promise<never>((_, reject) => {
      child.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') reject(new CommandNotFoundError(command));
        else reject(err);
      });
    });
    const exitPromise = once(child, 'exit') as Promise<[number | null, NodeJS.Signals | null]>;
    const [code, sig] = await Promise.race([exitPromise, spawnErrorPromise]);
    exitCode = code;
    exitSignal = sig;
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener('abort', onAbort);
  }

  return {
    exitCode,
    signal: exitSignal,
    stdout: Buffer.concat(stdoutChunks).toString('utf8'),
    stderr: Buffer.concat(stderrChunks).toString('utf8'),
    timedOut,
    aborted,
    truncated: { stdout: stdoutTruncated, stderr: stderrTruncated },
    durationMs: Math.round(performance.now() - started),
  };
}

export async function commandExists(
  command: string,
  options: Pick<RunOptions, 'signal'>,
): Promise<boolean> {
  try {
    const result = await run(process.platform === 'win32' ? 'where' : 'which', [command], {
      cwd: process.cwd(),
      signal: options.signal,
      timeoutMs: 2000,
    });
    return result.exitCode === 0 && result.stdout.trim().length > 0;
  } catch (err) {
    if (err instanceof CommandNotFoundError) return false;
    throw err;
  }
}

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './shell.js';

export interface GitInfo {
  readonly isRepo: boolean;
  readonly head: string | null;       // short SHA, e.g. "0f5643c"
  readonly dirty: boolean;             // uncommitted changes present
  readonly branch: string | null;
}

const GIT_CMD_TIMEOUT_MS = 3_000;

export async function detectGitInfo(cwd: string, signal: AbortSignal): Promise<GitInfo> {
  if (!existsSync(join(cwd, '.git'))) {
    return { isRepo: false, head: null, dirty: false, branch: null };
  }

  const [head, dirty, branch] = await Promise.all([
    getHead(cwd, signal),
    getDirty(cwd, signal),
    getBranch(cwd, signal),
  ]);

  return { isRepo: true, head, dirty, branch };
}

async function getHead(cwd: string, signal: AbortSignal): Promise<string | null> {
  try {
    const r = await run('git', ['rev-parse', '--short', 'HEAD'], { cwd, signal, timeoutMs: GIT_CMD_TIMEOUT_MS });
    if (r.exitCode === 0) {
      const head = r.stdout.trim();
      return head.length > 0 ? head : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function getDirty(cwd: string, signal: AbortSignal): Promise<boolean> {
  try {
    const r = await run('git', ['status', '--porcelain'], { cwd, signal, timeoutMs: GIT_CMD_TIMEOUT_MS });
    if (r.exitCode === 0) return r.stdout.trim().length > 0;
    return false;
  } catch {
    return false;
  }
}

async function getBranch(cwd: string, signal: AbortSignal): Promise<string | null> {
  try {
    const r = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, signal, timeoutMs: GIT_CMD_TIMEOUT_MS });
    if (r.exitCode === 0) {
      const branch = r.stdout.trim();
      return branch.length > 0 && branch !== 'HEAD' ? branch : null;
    }
    return null;
  } catch {
    return null;
  }
}

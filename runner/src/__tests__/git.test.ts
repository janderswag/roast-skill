import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { detectGitInfo } from '../git.js';

const signal = () => new AbortController().signal;

async function makeNonGitDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'roast-git-test-nongit-'));
}

async function makeGitDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'roast-git-test-'));
  execSync('git init --quiet', { cwd: dir });
  execSync('git config user.email "test@test"', { cwd: dir });
  execSync('git config user.name "Test"', { cwd: dir });
  await writeFile(join(dir, 'README.md'), '# test\n');
  execSync('git add README.md', { cwd: dir });
  execSync('git commit --quiet -m "init"', { cwd: dir });
  return dir;
}

describe('detectGitInfo', () => {
  it('returns isRepo=false for non-git directories', async () => {
    const dir = await makeNonGitDir();
    try {
      const info = await detectGitInfo(dir, signal());
      expect(info.isRepo).toBe(false);
      expect(info.head).toBeNull();
      expect(info.dirty).toBe(false);
      expect(info.branch).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('detects HEAD on a clean git repo', async () => {
    const dir = await makeGitDir();
    try {
      const info = await detectGitInfo(dir, signal());
      expect(info.isRepo).toBe(true);
      expect(info.head).toMatch(/^[0-9a-f]{7,40}$/);
      expect(info.dirty).toBe(false);
      // Branch may be 'main' or 'master' depending on git config
      expect(info.branch === null || /^(main|master)$/.test(info.branch)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('reports dirty=true when there are uncommitted changes', async () => {
    const dir = await makeGitDir();
    try {
      await writeFile(join(dir, 'newfile.txt'), 'uncommitted');
      const info = await detectGitInfo(dir, signal());
      expect(info.isRepo).toBe(true);
      expect(info.dirty).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

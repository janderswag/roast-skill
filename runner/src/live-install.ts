import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { commandExists, run } from './shell.js';

export const PLAYWRIGHT_VERSION = '1.47.2';
const NPM_INSTALL_TIMEOUT_MS = 5 * 60_000;
const BROWSER_INSTALL_TIMEOUT_MS = 5 * 60_000;

export interface InstallResult {
  readonly ready: boolean;
  readonly playwrightPkgDir: string;
  readonly browsersDir: string;
  readonly reason?: string;
}

export interface InstallOptions {
  readonly cacheDir: string;
  readonly signal: AbortSignal;
  readonly onProgress?: (msg: string) => void;
}

export async function ensurePlaywrightInstalled(opts: InstallOptions): Promise<InstallResult> {
  const cacheDir = opts.cacheDir;
  const playwrightPkgDir = join(cacheDir, 'node_modules', 'playwright-chromium');
  const browsersDir = join(cacheDir, '.browsers');
  const sentinel = join(cacheDir, '.install-complete.v1');

  // Idempotency check: sentinel + key files present = nothing to do.
  if (existsSync(sentinel) && existsSync(join(playwrightPkgDir, 'package.json')) && existsSync(browsersDir)) {
    return { ready: true, playwrightPkgDir, browsersDir };
  }

  if (opts.signal.aborted) {
    return { ready: false, playwrightPkgDir, browsersDir, reason: 'aborted before install' };
  }

  if (!(await commandExists('npm', { signal: opts.signal }))) {
    return {
      ready: false,
      playwrightPkgDir,
      browsersDir,
      reason: 'npm not installed — required for first-time --url install of playwright-chromium',
    };
  }

  opts.onProgress?.(
    `[first --url run on this machine: installing playwright-chromium@${PLAYWRIGHT_VERSION} + Chromium to ${cacheDir} (~200MB, one-time)]`,
  );

  try {
    await mkdir(cacheDir, { recursive: true });
    await writeMinimalPackageJson(cacheDir);

    opts.onProgress?.('  step 1/2: npm install playwright-chromium...');
    const npmResult = await run(
      'npm',
      ['install', `playwright-chromium@${PLAYWRIGHT_VERSION}`, '--no-save', '--no-audit', '--no-fund', '--loglevel=error'],
      { cwd: cacheDir, signal: opts.signal, timeoutMs: NPM_INSTALL_TIMEOUT_MS },
    );
    if (npmResult.exitCode !== 0) {
      return {
        ready: false,
        playwrightPkgDir,
        browsersDir,
        reason: `npm install failed (exit ${npmResult.exitCode}): ${npmResult.stderr.trim().slice(-500) || npmResult.stdout.trim().slice(-500)}`,
      };
    }

    const cliJs = join(playwrightPkgDir, 'cli.js');
    if (!existsSync(cliJs)) {
      return {
        ready: false,
        playwrightPkgDir,
        browsersDir,
        reason: `playwright-chromium cli.js not found after install at ${cliJs}`,
      };
    }

    opts.onProgress?.('  step 2/2: downloading Chromium browser binary...');
    const browserResult = await run('node', [cliJs, 'install', 'chromium'], {
      cwd: cacheDir,
      signal: opts.signal,
      timeoutMs: BROWSER_INSTALL_TIMEOUT_MS,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersDir },
    });
    if (browserResult.exitCode !== 0) {
      return {
        ready: false,
        playwrightPkgDir,
        browsersDir,
        reason: `chromium binary download failed (exit ${browserResult.exitCode}): ${browserResult.stderr.trim().slice(-500)}`,
      };
    }

    await writeFile(sentinel, new Date().toISOString(), 'utf8');
    opts.onProgress?.('  ✓ install complete');
    return { ready: true, playwrightPkgDir, browsersDir };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ready: false, playwrightPkgDir, browsersDir, reason: msg };
  }
}

async function writeMinimalPackageJson(dir: string): Promise<void> {
  const pkgPath = join(dir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const existing = JSON.parse(await readFile(pkgPath, 'utf8'));
      if (existing && typeof existing === 'object') return;
    } catch {
      // fall through, rewrite
    }
  }
  await writeFile(
    pkgPath,
    JSON.stringify({ name: 'roast-runner-live-cache', version: '0.0.0', private: true }, null, 2) + '\n',
    'utf8',
  );
}

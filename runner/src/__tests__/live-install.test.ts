import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensurePlaywrightInstalled } from '../live-install.js';

describe('ensurePlaywrightInstalled', () => {
  it('is idempotent — short-circuits when sentinel + key paths exist', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'roast-install-'));
    try {
      // Fake a complete install: sentinel + playwright-chromium/package.json + .browsers/
      await mkdir(join(cacheDir, 'node_modules', 'playwright-chromium'), { recursive: true });
      await writeFile(join(cacheDir, 'node_modules', 'playwright-chromium', 'package.json'), '{}');
      await mkdir(join(cacheDir, '.browsers'), { recursive: true });
      await writeFile(join(cacheDir, '.install-complete.v1'), new Date().toISOString());

      const result = await ensurePlaywrightInstalled({
        cacheDir,
        signal: new AbortController().signal,
      });

      expect(result.ready).toBe(true);
      expect(result.playwrightPkgDir).toContain('playwright-chromium');
      expect(result.browsersDir).toContain('.browsers');
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it('returns not-ready with clear reason when sentinel missing AND npm/playwright not actually installed', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'roast-install-fresh-'));
    try {
      // Empty cacheDir. ensurePlaywrightInstalled will detect npm and try to
      // install. We don't want to wait 30s for a real install in the unit
      // suite, so we abort immediately.
      const controller = new AbortController();
      controller.abort();
      const result = await ensurePlaywrightInstalled({
        cacheDir,
        signal: controller.signal,
      });
      expect(result.ready).toBe(false);
      expect(result.reason).toBeDefined();
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
});

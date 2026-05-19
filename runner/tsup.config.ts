import { defineConfig } from 'tsup';
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require_ = createRequire(import.meta.url);

export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['cjs'],
  target: 'node18',
  platform: 'node',
  outDir: 'dist',
  outExtension: () => ({ js: '.cjs' }),
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: false,
  treeshake: true,
  shims: false,
  banner: { js: '#!/usr/bin/env node' },
  noExternal: ['zod'],
  // playwright-chromium is dynamically loaded from cacheDir at runtime — never bundle it.
  external: ['playwright-chromium'],
  async onSuccess() {
    // Ship axe.min.js next to the bundle so live-browser.ts can inject it
    // without a runtime npm install or CDN dependency.
    await mkdir('dist', { recursive: true });
    const axePath = require_.resolve('axe-core/axe.min.js');
    await copyFile(axePath, join('dist', 'axe.min.js'));
  },
});

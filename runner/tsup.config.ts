import { defineConfig } from 'tsup';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require_ = createRequire(import.meta.url);

/**
 * v0.7.1 hotfix — qrcode-terminal's lib/main.js uses legacy octal escapes
 * (e.g. "\033[40m" for the ANSI ESC character). esbuild's strict-mode CJS
 * bundling rejects them outright. Rather than vendoring the dep or
 * replacing it, we intercept the offending file at bundle time and rewrite
 * `\033` → `\x1B` (same ESC byte, hex notation, valid in strict mode).
 *
 * Filter scoped tightly so we don't accidentally rewrite project source
 * that happens to contain the same character sequence.
 */
const rewriteQrcodeTerminalOctals = {
  name: 'rewrite-qrcode-terminal-octals',
  setup(build: { onLoad: (opts: { filter: RegExp }, cb: (args: { path: string }) => Promise<{ contents: string; loader: 'js' }>) => void }) {
    build.onLoad({ filter: /qrcode-terminal[\\/]lib[\\/]main\.js$/ }, async (args) => {
      const original = await readFile(args.path, 'utf8');
      const rewritten = original.replace(/\\033/g, '\\x1B');
      return { contents: rewritten, loader: 'js' };
    });
  },
};

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
  // Bundle every runtime dep into the CJS so `git clone` is sufficient
  // — no `npm install` step in the skill's runner dir. Users install
  // the skill with a single `git clone … ~/.claude/skills/roast`; if a
  // dep is left external, the first `/roast` call crashes with
  // `Cannot find module 'X'`. v0.7.0 shipped with qrcode-terminal
  // unbundled — fixed in v0.7.1.
  //
  // axe-core stays external because the onSuccess hook below copies
  // axe.min.js to dist/ separately (it's loaded via createRequire +
  // cache-bust per `feedback_axe_module_cache.md`, NOT via the bundled
  // require graph). Bundling it would inflate the CJS by 541KB for no
  // benefit since live-browser.ts reads it from disk regardless.
  noExternal: ['zod', 'qrcode-terminal'],
  // playwright-chromium is dynamically loaded from cacheDir at runtime — never bundle it.
  external: ['playwright-chromium'],
  esbuildPlugins: [rewriteQrcodeTerminalOctals],
  async onSuccess() {
    // Ship axe.min.js next to the bundle so live-browser.ts can inject it
    // without a runtime npm install or CDN dependency.
    await mkdir('dist', { recursive: true });
    const axePath = require_.resolve('axe-core/axe.min.js');
    await copyFile(axePath, join('dist', 'axe.min.js'));
  },
});

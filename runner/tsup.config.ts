import { defineConfig } from 'tsup';

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
});

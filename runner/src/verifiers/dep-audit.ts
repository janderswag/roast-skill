import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Finding, Severity } from '../types.js';
import type { Verifier, VerifierContext } from '../verifier.js';
import { errored, ok, skipped } from '../verifier.js';

interface KnownVuln {
  readonly pkg: string;
  readonly fixedIn: SemVer;
  readonly severity: Severity;
  readonly cve?: string;
  readonly summary: string;
}

const KNOWN_VULNERABLE: ReadonlyArray<KnownVuln> = [
  { pkg: 'lodash',        fixedIn: [4, 17, 21], severity: 'high',     cve: 'CVE-2021-23337', summary: 'command injection via template' },
  { pkg: 'jsonwebtoken',  fixedIn: [9, 0, 0],   severity: 'critical', cve: 'CVE-2022-23529', summary: 'algorithm confusion / weak verification' },
  { pkg: 'axios',         fixedIn: [1, 6, 0],   severity: 'high',     cve: 'CVE-2023-45857', summary: 'cross-site request forgery / SSRF' },
  { pkg: 'next',          fixedIn: [13, 5, 1],  severity: 'high',     cve: 'CVE-2023-46298', summary: 'cache poisoning + auth bypass in older releases' },
  { pkg: 'next',          fixedIn: [14, 2, 10], severity: 'high',     cve: 'CVE-2024-46982', summary: 'cache poisoning' },
  { pkg: 'express',       fixedIn: [4, 19, 2],  severity: 'medium',   cve: 'CVE-2024-29041', summary: 'open redirect via malformed URLs' },
  { pkg: 'node-fetch',    fixedIn: [2, 6, 7],   severity: 'medium',   cve: 'CVE-2022-0235',  summary: 'host whitelist bypass on redirect' },
  { pkg: 'ws',            fixedIn: [8, 17, 1],  severity: 'high',     cve: 'CVE-2024-37890', summary: 'denial of service via crafted headers' },
  { pkg: 'tar',           fixedIn: [6, 2, 1],   severity: 'high',     cve: 'CVE-2024-28863', summary: 'path traversal on extraction' },
  { pkg: 'follow-redirects', fixedIn: [1, 15, 6], severity: 'high',   cve: 'CVE-2024-28849', summary: 'credential leak via cross-origin redirect' },
  { pkg: 'semver',        fixedIn: [7, 5, 2],   severity: 'medium',   cve: 'CVE-2022-25883', summary: 'ReDoS on crafted range string' },
];

const BUILD_TOOLS_BELONG_IN_DEV: ReadonlySet<string> = new Set([
  'eslint', 'jest', 'typescript', 'tsx', 'ts-node', 'prettier', 'vitest', 'mocha',
  'chai', 'webpack', 'rollup', 'vite', 'parcel', 'concurrently', 'nodemon', 'tsup',
  'esbuild', 'rimraf', '@types/node',
]);

type SemVer = readonly [number, number, number];

const PackageJson = z
  .object({
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
  })
  .passthrough();

const LockfileV3Package = z.object({ version: z.string().optional() }).passthrough();
const Lockfile = z
  .object({
    lockfileVersion: z.number().optional(),
    packages: z.record(LockfileV3Package).optional(),
    dependencies: z.record(z.object({ version: z.string().optional() }).passthrough()).optional(),
  })
  .passthrough();

export const depAuditVerifier: Verifier = {
  name: 'dep-audit',

  async isAvailable(ctx: VerifierContext) {
    if (!existsSync(join(ctx.cwd, 'package.json'))) {
      return { available: false, reason: 'no package.json in cwd (Node-only in v0.4.0)' };
    }
    return { available: true };
  },

  async run(ctx: VerifierContext) {
    const started = performance.now();
    try {
      const pkgPath = join(ctx.cwd, 'package.json');
      const pkgText = await readFile(pkgPath, 'utf8');
      const pkgRaw: unknown = JSON.parse(pkgText);
      const pkg = PackageJson.parse(pkgRaw);

      const lockResolved = await loadLockfileVersions(ctx.cwd);
      const findings: Finding[] = [];

      auditKnownVulns(pkg, lockResolved, findings);
      auditMisplacedBuildTools(pkg, findings);
      auditMissingLockfile(ctx.cwd, pkg, findings);

      return ok('dep-audit', findings, Math.round(performance.now() - started));
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT') || msg.includes('not valid JSON') || msg.includes('JSON')) {
        return skipped('dep-audit', `unable to parse package.json: ${msg}`, elapsed);
      }
      return errored('dep-audit', msg, elapsed);
    }
  },
};

function auditKnownVulns(
  pkg: z.infer<typeof PackageJson>,
  lockResolved: ReadonlyMap<string, SemVer>,
  out: Finding[],
): void {
  const all: ReadonlyArray<readonly [string, string, 'dependencies' | 'devDependencies']> = [
    ...Object.entries(pkg.dependencies ?? {}).map(([k, v]) => [k, v, 'dependencies' as const] as const),
    ...Object.entries(pkg.devDependencies ?? {}).map(([k, v]) => [k, v, 'devDependencies' as const] as const),
  ];

  for (const [name, spec, section] of all) {
    const matches = KNOWN_VULNERABLE.filter((v) => v.pkg === name);
    if (matches.length === 0) continue;

    const installed = lockResolved.get(name) ?? minVersionFromSpec(spec);
    if (installed === null) continue;

    for (const vuln of matches) {
      if (lt(installed, vuln.fixedIn)) {
        out.push({
          verifier: 'dep-audit',
          ruleId: `known-vuln/${vuln.pkg}/${vuln.cve ?? formatSemVer(vuln.fixedIn)}`,
          severity: vuln.severity,
          path: 'package.json',
          message: `${name}@${formatSemVer(installed)} (${section}) — ${vuln.summary}${vuln.cve ? ` [${vuln.cve}]` : ''}; fixed in ${formatSemVer(vuln.fixedIn)}`,
          fix: `upgrade ${name} to >=${formatSemVer(vuln.fixedIn)}`,
        } as Finding);
      }
    }
  }
}

function auditMisplacedBuildTools(pkg: z.infer<typeof PackageJson>, out: Finding[]): void {
  const deps = pkg.dependencies ?? {};
  for (const name of Object.keys(deps)) {
    if (BUILD_TOOLS_BELONG_IN_DEV.has(name)) {
      out.push({
        verifier: 'dep-audit',
        ruleId: `misplaced-dev-dep/${name}`,
        severity: 'low',
        path: 'package.json',
        message: `${name} listed in "dependencies" but is a build/dev tool — ships to production unnecessarily, bloating install size and surface`,
        fix: `move "${name}" from "dependencies" to "devDependencies"`,
      } as Finding);
    }
  }
}

function auditMissingLockfile(
  cwd: string,
  pkg: z.infer<typeof PackageJson>,
  out: Finding[],
): void {
  const hasDeps = (Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length) > 0;
  if (!hasDeps) return;

  const hasLockfile =
    existsSync(join(cwd, 'package-lock.json')) ||
    existsSync(join(cwd, 'pnpm-lock.yaml')) ||
    existsSync(join(cwd, 'yarn.lock')) ||
    existsSync(join(cwd, 'bun.lockb'));

  if (!hasLockfile) {
    out.push({
      verifier: 'dep-audit',
      ruleId: 'missing-lockfile',
      severity: 'medium',
      path: 'package.json',
      message: 'no lockfile committed — CI builds are not reproducible; dependency drift between envs is silent',
      fix: 'commit package-lock.json (or pnpm-lock.yaml / yarn.lock) and add to git',
    } as Finding);
  }
}

async function loadLockfileVersions(cwd: string): Promise<ReadonlyMap<string, SemVer>> {
  const lockPath = join(cwd, 'package-lock.json');
  if (!existsSync(lockPath)) return new Map();

  try {
    const text = await readFile(lockPath, 'utf8');
    const raw: unknown = JSON.parse(text);
    const lock = Lockfile.parse(raw);
    const out = new Map<string, SemVer>();

    // lockfile v2/v3 packages keys look like "node_modules/lodash" or "node_modules/foo/node_modules/lodash"
    if (lock.packages) {
      for (const [key, entry] of Object.entries(lock.packages)) {
        if (key === '') continue;
        const lastIdx = key.lastIndexOf('node_modules/');
        if (lastIdx < 0) continue;
        const name = key.slice(lastIdx + 'node_modules/'.length);
        if (!name || !entry.version) continue;
        if (!out.has(name)) {
          const parsed = parseSemVer(entry.version);
          if (parsed !== null) out.set(name, parsed);
        }
      }
    }

    // lockfile v1 fallback
    if (out.size === 0 && lock.dependencies) {
      for (const [name, entry] of Object.entries(lock.dependencies)) {
        if (!entry.version) continue;
        const parsed = parseSemVer(entry.version);
        if (parsed !== null) out.set(name, parsed);
      }
    }

    return out;
  } catch {
    return new Map();
  }
}

export function parseSemVer(input: string): SemVer | null {
  const trimmed = input.trim();
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(trimmed);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

export function minVersionFromSpec(spec: string): SemVer | null {
  // We only handle plain pins, caret, tilde, and >= constraints. Git/url/file/workspace specs return null (skip).
  const trimmed = spec.trim();
  if (trimmed.startsWith('git') || trimmed.includes(':') || trimmed.startsWith('file') || trimmed.startsWith('http')) {
    return null;
  }
  const stripped = trimmed.replace(/^[\^~]|^>=\s*/, '').trim();
  return parseSemVer(stripped);
}

export function lt(a: SemVer, b: SemVer): boolean {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  return a[2] < b[2];
}

export function formatSemVer(v: SemVer): string {
  return `${v[0]}.${v[1]}.${v[2]}`;
}

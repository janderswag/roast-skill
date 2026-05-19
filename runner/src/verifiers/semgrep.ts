import { z } from 'zod';
import type { Finding, Severity } from '../types.js';
import type { Verifier, VerifierContext } from '../verifier.js';
import { errored, ok, skipped } from '../verifier.js';
import { commandExists, run } from '../shell.js';
import { looksSecrety, redact } from '../redact.js';

const SemgrepResult = z
  .object({
    check_id: z.string(),
    path: z.string(),
    start: z.object({ line: z.number().int().nonnegative() }).passthrough(),
    end: z.object({ line: z.number().int().nonnegative() }).passthrough().optional(),
    extra: z
      .object({
        message: z.string().optional(),
        severity: z.string().optional(),
        lines: z.string().optional(),
        metadata: z
          .object({
            cwe: z.union([z.string(), z.array(z.string())]).optional(),
            owasp: z.union([z.string(), z.array(z.string())]).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough();

const SemgrepOutput = z
  .object({
    results: z.array(SemgrepResult),
    errors: z.array(z.unknown()).optional(),
  })
  .passthrough();

const ARGS: readonly string[] = [
  '--config', 'p/security-audit',
  '--config', 'p/owasp-top-ten',
  '--config', 'p/secrets',
  '--severity', 'ERROR',
  '--severity', 'WARNING',
  '--json',
  '--quiet',
  '--timeout', '30',
  '--exclude', 'node_modules',
  '--exclude', '.next',
  '--exclude', 'dist',
  '--exclude', 'build',
  '--exclude', '.git',
  '.',
];

export const semgrepVerifier: Verifier = {
  name: 'semgrep',

  async isAvailable(ctx: VerifierContext) {
    const exists = await commandExists('semgrep', { signal: ctx.signal });
    return exists
      ? { available: true }
      : { available: false, reason: "semgrep not installed (install: 'brew install semgrep' or 'pip install semgrep')" };
  },

  async run(ctx: VerifierContext) {
    const started = performance.now();
    try {
      const result = await run('semgrep', ARGS, {
        cwd: ctx.cwd,
        signal: ctx.signal,
        timeoutMs: ctx.timeoutMs,
      });

      if (result.timedOut) {
        return errored('semgrep', `timed out after ${ctx.timeoutMs}ms`, result.durationMs);
      }
      if (result.aborted) {
        return errored('semgrep', 'aborted', result.durationMs);
      }

      // semgrep exit codes: 0 = no findings, 1 = findings, 2 = errors. We accept 0 and 1.
      if (result.exitCode !== 0 && result.exitCode !== 1) {
        const stderrSnippet = result.stderr.trim().slice(0, 500);
        return errored(
          'semgrep',
          `semgrep exited ${result.exitCode}${stderrSnippet ? `: ${stderrSnippet}` : ''}`,
          result.durationMs,
        );
      }

      const findings = parseSemgrepJson(result.stdout);
      return ok('semgrep', findings, result.durationMs);
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const msg = err instanceof Error ? err.message : String(err);
      return errored('semgrep', msg, elapsed);
    }
  },
};

export function parseSemgrepJson(stdout: string): readonly Finding[] {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return [];

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const parsed = SemgrepOutput.safeParse(raw);
  if (!parsed.success) return [];

  const findings: Finding[] = [];
  for (const r of parsed.data.results) {
    const severity = mapSemgrepSeverity(r.extra.severity, r.check_id);
    const message = (r.extra.message ?? r.check_id).split('\n')[0]!.slice(0, 500);
    const evidenceRaw = r.extra.lines;
    const evidence = evidenceRaw ? redact(evidenceRaw).slice(0, 500) : undefined;

    const cweMeta = r.extra.metadata?.cwe;
    const owaspMeta = r.extra.metadata?.owasp;
    const cwe = Array.isArray(cweMeta) ? cweMeta[0] : cweMeta;
    const owasp = Array.isArray(owaspMeta) ? owaspMeta[0] : owaspMeta;

    findings.push({
      verifier: 'semgrep',
      ruleId: r.check_id,
      severity,
      path: r.path,
      line: r.start.line > 0 ? r.start.line : undefined,
      endLine: r.end?.line && r.end.line > 0 ? r.end.line : undefined,
      message,
      evidence,
      cwe,
      owasp,
    } as Finding);
  }
  return findings;
}

function mapSemgrepSeverity(raw: string | undefined, ruleId: string): Severity {
  switch ((raw ?? '').toUpperCase()) {
    case 'ERROR':
      return looksSecrety(ruleId) ? 'critical' : 'high';
    case 'WARNING':
      return 'medium';
    case 'INFO':
      return 'low';
    default:
      return 'info';
  }
}

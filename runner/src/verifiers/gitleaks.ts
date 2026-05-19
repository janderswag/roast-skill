import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { Finding } from '../types.js';
import type { Verifier, VerifierContext } from '../verifier.js';
import { errored, ok, skipped } from '../verifier.js';
import { commandExists, run } from '../shell.js';
import { redactSecret } from '../redact.js';

const GitleaksFinding = z
  .object({
    RuleID: z.string(),
    Description: z.string().optional(),
    StartLine: z.number().int().nonnegative().optional(),
    EndLine: z.number().int().nonnegative().optional(),
    File: z.string(),
    Match: z.string().optional(),
    Secret: z.string().optional(),
    Commit: z.string().optional(),
  })
  .passthrough();

const GitleaksOutput = z.array(GitleaksFinding);

export const gitleaksVerifier: Verifier = {
  name: 'gitleaks',

  async isAvailable(ctx: VerifierContext) {
    if (!existsSync(join(ctx.cwd, '.git'))) {
      return { available: false, reason: 'not a git repository (gitleaks scans git history)' };
    }
    const exists = await commandExists('gitleaks', { signal: ctx.signal });
    return exists
      ? { available: true }
      : { available: false, reason: "gitleaks not installed (install: 'brew install gitleaks')" };
  },

  async run(ctx: VerifierContext) {
    const started = performance.now();
    let tmpDir: string | undefined;
    try {
      tmpDir = await mkdtemp(join(tmpdir(), 'roast-gitleaks-'));
      const reportPath = join(tmpDir, 'report.json');

      const result = await run(
        'gitleaks',
        [
          'detect',
          '--source', ctx.cwd,
          '--no-banner',
          '--no-color',
          '--report-format', 'json',
          '--report-path', reportPath,
          '--exit-code', '0',
        ],
        { cwd: ctx.cwd, signal: ctx.signal, timeoutMs: ctx.timeoutMs },
      );

      if (result.timedOut) {
        return errored('gitleaks', `timed out after ${ctx.timeoutMs}ms`, result.durationMs);
      }
      if (result.aborted) {
        return errored('gitleaks', 'aborted', result.durationMs);
      }

      // With --exit-code 0, any non-zero is a real error.
      if (result.exitCode !== 0) {
        const stderrSnippet = result.stderr.trim().slice(0, 500);
        return errored(
          'gitleaks',
          `gitleaks exited ${result.exitCode}${stderrSnippet ? `: ${stderrSnippet}` : ''}`,
          result.durationMs,
        );
      }

      const reportExists = existsSync(reportPath);
      const reportText = reportExists ? await readFile(reportPath, 'utf8') : '';
      const findings = parseGitleaksJson(reportText);
      return ok('gitleaks', findings, result.durationMs);
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const msg = err instanceof Error ? err.message : String(err);
      return errored('gitleaks', msg, elapsed);
    } finally {
      if (tmpDir !== undefined) {
        await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  },
};

export function parseGitleaksJson(text: string): readonly Finding[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const parsed = GitleaksOutput.safeParse(raw);
  if (!parsed.success) return [];

  const findings: Finding[] = [];
  for (const r of parsed.data) {
    const secret = r.Secret ?? r.Match ?? '';
    const redactedEvidence = secret.length > 0 ? redactSecret(secret) : undefined;
    const commitSuffix = r.Commit ? ` (commit ${r.Commit.slice(0, 7)})` : '';
    const description = (r.Description ?? r.RuleID).split('\n')[0]!.slice(0, 400);

    findings.push({
      verifier: 'gitleaks',
      ruleId: r.RuleID,
      severity: 'critical',
      path: r.File,
      line: r.StartLine && r.StartLine > 0 ? r.StartLine : undefined,
      endLine: r.EndLine && r.EndLine > 0 ? r.EndLine : undefined,
      message: `${description}${commitSuffix}`,
      evidence: redactedEvidence,
      fix: 'rotate the credential immediately; remove from history with git-filter-repo or BFG',
    } as Finding);
  }
  return findings;
}

import type { Verifier, VerifierContext } from './verifier.js';
import { skipped } from './verifier.js';
import type { Finding, RunReport, VerifierName, VerifierResult } from './types.js';
import { SEVERITY_RANK, summarize } from './types.js';

export const RUNNER_VERSION = '0.5.0';
export const SCHEMA_VERSION = 1 as const;

export interface OrchestratorOptions {
  readonly cwd: string;
  readonly url?: string;
  readonly cacheDir: string;
  readonly timeoutMs: number;
  readonly verifiers: readonly Verifier[];
  readonly enabled?: ReadonlySet<VerifierName>;
}

export async function runOrchestrator(opts: OrchestratorOptions): Promise<RunReport> {
  const started = performance.now();
  const startedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  timer.unref();

  const ctx: VerifierContext = {
    cwd: opts.cwd,
    url: opts.url,
    cacheDir: opts.cacheDir,
    timeoutMs: opts.timeoutMs,
    signal: controller.signal,
  };

  const selected = opts.enabled
    ? opts.verifiers.filter((v) => opts.enabled!.has(v.name))
    : opts.verifiers;

  try {
    const results = await Promise.all(selected.map((v) => runOne(v, ctx)));
    const allFindings: readonly Finding[] = results.flatMap((r) => r.findings);
    const sortedResults = [...results].sort(byVerifierName);
    return {
      schemaVersion: SCHEMA_VERSION,
      runnerVersion: RUNNER_VERSION,
      cwd: opts.cwd,
      startedAt,
      durationMs: Math.round(performance.now() - started),
      results: sortedResults.map((r) => ({ ...r, findings: sortFindings(r.findings) })),
      summary: summarize(allFindings),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runOne(verifier: Verifier, ctx: VerifierContext): Promise<VerifierResult> {
  const availStarted = performance.now();
  try {
    const avail = await verifier.isAvailable(ctx);
    if (!avail.available) {
      return skipped(verifier.name, avail.reason, Math.round(performance.now() - availStarted));
    }
    return await verifier.run(ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      verifier: verifier.name,
      status: 'error',
      reason: `unhandled exception in verifier: ${msg}`,
      findings: [],
      durationMs: Math.round(performance.now() - availStarted),
    };
  }
}

function byVerifierName(a: VerifierResult, b: VerifierResult): number {
  return a.verifier.localeCompare(b.verifier);
}

function sortFindings(findings: readonly Finding[]): readonly Finding[] {
  return [...findings].sort((a, b) => {
    const rankDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (rankDiff !== 0) return rankDiff;
    const pathDiff = a.path.localeCompare(b.path);
    if (pathDiff !== 0) return pathDiff;
    return (a.line ?? 0) - (b.line ?? 0);
  });
}

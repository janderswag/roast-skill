import { z } from 'zod';

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export const VerifierNameSchema = z.enum([
  'semgrep',
  'gitleaks',
  'dep-audit',
  'live-browser',
  'live-lighthouse',
]);
export type VerifierName = z.infer<typeof VerifierNameSchema>;

/**
 * Lifecycle state of a finding across runs.
 *
 * - `open`: default for new and persisting findings; needs attention
 * - `fixed`: was open in a previous run, missing from current run → auto-set by delta
 * - `wont-fix`: user-marked via `roast triage <signature> wont-fix`; suppressed from output
 * - `false-positive`: user-marked; suppressed AND used as training signal
 * - `uncertain`: needs human review (e.g., confidence-low verifier finding)
 *
 * Persisted in `.roast/triage.json` keyed by signature; re-applied on subsequent runs.
 * Findings emitted by verifiers default to `open` (status field omitted in serialization).
 */
export const FindingStatusSchema = z.enum([
  'open',
  'fixed',
  'wont-fix',
  'false-positive',
  'uncertain',
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

/**
 * Trust boundaries a finding crosses. Lifted from the OpenClaw/Clawpatch
 * convention (docs/spec.md). Lets consumers reason about WHERE the risk
 * sits — e.g., "all 5 HIGH findings touch the `auth` boundary" is more
 * actionable than "5 HIGH findings".
 *
 * Assigned by the orchestrator via verifier-rule-specific mappings
 * (see `trust-boundaries.ts`). Always an array — may be empty if no
 * mapping applies.
 */
export const TrustBoundarySchema = z.enum([
  'user-input',
  'network',
  'filesystem',
  'secrets',
  'process-exec',
  'database',
  'auth',
  'permissions',
  'concurrency',
  'external-api',
  'serialization',
]);
export type TrustBoundary = z.infer<typeof TrustBoundarySchema>;

export const FindingSchema = z
  .object({
    verifier: VerifierNameSchema,
    ruleId: z.string().min(1),
    severity: SeveritySchema,
    path: z.string().min(1),
    line: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    message: z.string().min(1),
    evidence: z.string().optional(),
    fix: z.string().optional(),
    cwe: z.string().optional(),
    owasp: z.string().optional(),
    /**
     * Deterministic hash for cross-run deduplication. Computed from
     * verifier + ruleId + normalized path + line range. Stable across runs
     * as long as the verifier rule and file location are stable.
     *
     * Optional in the schema for back-compat reading v0.6.0 exports that
     * predate it; always emitted on findings from v0.7.0+ (set by
     * orchestrator enrichment).
     */
    signature: z.string().min(1).optional(),
    /**
     * Lifecycle state. Omitted (treated as "open") for fresh findings.
     * Hydrated from `.roast/triage.json` on subsequent runs.
     */
    status: FindingStatusSchema.optional(),
    /**
     * Trust boundaries this finding crosses. Empty/omitted if no mapping
     * applies for the verifier rule.
     */
    trustBoundaries: z.array(TrustBoundarySchema).optional(),
  })
  .strict();

export type Finding = z.infer<typeof FindingSchema>;

export const VerifierStatusSchema = z.enum(['ok', 'skipped', 'error']);
export type VerifierStatus = z.infer<typeof VerifierStatusSchema>;

export const VerifierResultSchema = z
  .object({
    verifier: VerifierNameSchema,
    status: VerifierStatusSchema,
    reason: z.string().optional(),
    findings: z.array(FindingSchema).readonly(),
    durationMs: z.number().int().nonnegative(),
  })
  .strict();

export type VerifierResult = z.infer<typeof VerifierResultSchema>;

export const SummarySchema = z
  .object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    low: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .strict();

export type Summary = z.infer<typeof SummarySchema>;

export const RunReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    runnerVersion: z.string(),
    cwd: z.string(),
    startedAt: z.string().datetime(),
    durationMs: z.number().int().nonnegative(),
    results: z.array(VerifierResultSchema).readonly(),
    summary: SummarySchema,
  })
  .strict();

export type RunReport = z.infer<typeof RunReportSchema>;

export function emptySummary(): Summary {
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
}

export function summarize(findings: readonly Finding[]): Summary {
  const s = emptySummary();
  for (const f of findings) {
    s[f.severity] += 1;
    s.total += 1;
  }
  return s;
}

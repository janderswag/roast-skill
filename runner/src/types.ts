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

export const VerifierNameSchema = z.enum(['semgrep', 'gitleaks', 'dep-audit']);
export type VerifierName = z.infer<typeof VerifierNameSchema>;

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

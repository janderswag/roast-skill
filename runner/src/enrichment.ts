import type { Finding } from './types.js';
import { computeSignature } from './signature.js';
import { assignTrustBoundaries } from './trust-boundaries.js';

/**
 * Enriches a verifier-emitted finding with fields the verifier itself
 * doesn't compute:
 *
 *   - `signature` — deterministic hash for cross-run dedup (Phase A.1)
 *   - `trustBoundaries` — Clawpatch-inspired risk-location tags (Phase A.2)
 *
 * Phase A.3 will add `status` hydration from `.roast/triage.json`.
 *
 * Idempotent: if a finding already has BOTH signature and trustBoundaries
 * set (e.g., loaded from `.roast/last-audit.json`), it's returned
 * unchanged. Partial enrichment is supported — if only one field is
 * present, the missing one is computed (this is defensive; in practice
 * the orchestrator always emits both together).
 *
 * Verifiers stay stateless and don't know about enrichment — they emit
 * "raw" findings (signature/trustBoundaries omitted). The orchestrator
 * runs each finding through `enrichFinding` before assembly into the
 * RunReport. This keeps verifier files small and concentrates the
 * cross-cutting concerns in one place.
 */
export function enrichFinding(f: Finding): Finding {
  const needsSignature = f.signature === undefined;
  const needsBoundaries = f.trustBoundaries === undefined;

  if (!needsSignature && !needsBoundaries) return f;

  const next: Finding = { ...f };
  if (needsSignature) {
    next.signature = computeSignature({
      verifier: f.verifier,
      ruleId: f.ruleId,
      path: f.path,
      line: f.line,
      endLine: f.endLine,
    });
  }
  if (needsBoundaries) {
    next.trustBoundaries = [...assignTrustBoundaries(f)];
  }
  return next;
}

import { createHash } from 'node:crypto';
import type { VerifierName } from './types.js';

/**
 * Input shape for {@link computeSignature}. A subset of {@link Finding}
 * containing only the fields that participate in the deterministic hash.
 *
 * Intentionally excludes mutable fields (severity, message, evidence, fix,
 * cwe, owasp) so that finding text/severity changes between runs DON'T
 * change the signature. The signature identifies "this rule on this
 * location" — not "this exact wording."
 */
export interface SignatureInput {
  readonly verifier: VerifierName;
  readonly ruleId: string;
  readonly path: string;
  readonly line?: number | undefined;
  readonly endLine?: number | undefined;
}

/**
 * Compute a stable, deterministic 16-hex-char signature for a finding.
 *
 * Used for cross-run dedup: the same finding (same rule, same location)
 * produces the same signature every time. Enables:
 *   - `--delta` mode (compare against `.roast/last-audit.json`)
 *   - Triage persistence (`.roast/triage.json` keyed by signature)
 *   - Webapp Co-Pilot "what's new this week" diffs
 *
 * 64 bits of SHA-256 is enough to dedup ~4 billion distinct findings
 * before birthday collisions become likely (~1-in-1B at 200K findings).
 * Real audits emit at most a few hundred findings, so this is enormous
 * headroom — full SHA-256 would just bloat the JSON for no benefit.
 *
 * @example
 *   computeSignature({
 *     verifier: 'semgrep',
 *     ruleId: 'javascript.lang.security.audit.dangerous-eval',
 *     path: 'src/api/exec.ts',
 *     line: 42,
 *   })
 *   // → 'a3f7c9d2e4b18560'
 */
export function computeSignature(input: SignatureInput): string {
  const normalizedPath = normalizePath(input.path);
  const lineToken = input.line !== undefined ? String(input.line) : '';
  const endLineToken = input.endLine !== undefined ? String(input.endLine) : '';

  // Pipe separator chosen because it never appears in verifier names, rule IDs,
  // or normalized paths in the wild (file paths use / or \, ruleIds use . / -).
  const material = `${input.verifier}|${input.ruleId}|${normalizedPath}|${lineToken}|${endLineToken}`;

  return createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Normalize a path for signature computation. We want the SAME finding to
 * produce the SAME signature regardless of:
 *   - Forward vs backward slashes (Windows verifier output)
 *   - Leading `./` (semgrep emits with prefix; we strip for consistency)
 *   - Trailing slashes (defensive; shouldn't appear in file paths but cheap to handle)
 *
 * We do NOT lowercase: paths on macOS and Linux are case-sensitive, and
 * the same file on different filesystems shouldn't collide.
 */
function normalizePath(path: string): string {
  let p = path.replace(/\\/g, '/');
  if (p.startsWith('./')) p = p.slice(2);
  while (p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

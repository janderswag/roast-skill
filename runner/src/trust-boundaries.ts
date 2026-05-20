import type { Finding, TrustBoundary } from './types.js';

/**
 * Maps a finding to the trust boundaries it crosses.
 *
 * Trust boundaries are a Clawpatch-inspired analytic dimension: they let
 * consumers reason about WHERE risk sits, not just HOW BAD it is. The
 * statement "you have 5 HIGHs on the `auth` boundary" is far more
 * actionable than "you have 5 HIGHs."
 *
 * Mapping strategy:
 *   - Per-verifier defaults first (gitleaks ALWAYS hits `secrets`,
 *     dep-audit ALWAYS hits `external-api`, etc.)
 *   - Then refined per-rule using CWE/OWASP metadata for semgrep, and
 *     rule-ID heuristics for live-browser axe and security headers
 *
 * Return value is always a (possibly empty) array — empty signals "we
 * checked and nothing in our mapping table applied," which is a useful
 * UX signal distinct from "we haven't tagged this finding yet."
 *
 * Mapping is intentionally conservative — we'd rather UNDER-tag than
 * mislabel. Unknown rules → empty array, not a guessed boundary.
 */
export function assignTrustBoundaries(f: Finding): readonly TrustBoundary[] {
  switch (f.verifier) {
    case 'gitleaks':
      return ['secrets'];

    case 'dep-audit':
      // A vulnerable dependency is risk on the external-api boundary —
      // your code trusts upstream code that has a known issue.
      return ['external-api'];

    case 'semgrep':
      return assignSemgrepBoundaries(f);

    case 'live-browser':
      return assignLiveBrowserBoundaries(f);

    case 'live-lighthouse':
      // Lighthouse audits are about how content reaches the network/user:
      // perf budgets, render-blocking resources, etc.
      return ['network'];
  }
}

/**
 * Semgrep boundary assignment. Uses CWE first (most specific), falls back
 * to OWASP, then to ruleId substring heuristics. Order matters — the most
 * specific mapping wins.
 */
function assignSemgrepBoundaries(f: Finding): readonly TrustBoundary[] {
  const boundaries = new Set<TrustBoundary>();

  // CWE mapping — Common Weakness Enumeration. Authoritative source for
  // "what category of bug is this."
  if (f.cwe) {
    const cweId = extractCweId(f.cwe);
    for (const b of cweToBoundaries(cweId)) boundaries.add(b);
  }

  // ruleId substring heuristics — semgrep rule IDs encode intent
  // (e.g., "javascript.lang.security.audit.dangerous-eval"). Catches
  // rules that lack CWE metadata.
  for (const b of ruleIdToBoundaries(f.ruleId)) boundaries.add(b);

  return Array.from(boundaries);
}

function extractCweId(cweField: string): number | null {
  // CWE field can be "CWE-79", "CWE-79: Cross-site Scripting", "79", etc.
  const match = /CWE-(\d+)/i.exec(cweField) ?? /^(\d+)$/.exec(cweField.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1]!, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * CWE → trust boundary mapping. We cover the high-frequency security CWEs
 * that appear in semgrep p/security-audit + p/owasp-top-ten rulesets.
 * Long tail returns empty (don't guess).
 */
function cweToBoundaries(cwe: number | null): readonly TrustBoundary[] {
  if (cwe === null) return [];
  switch (cwe) {
    case 79: // Cross-site Scripting
    case 80: // Improper Neutralization of Script-Related HTML Tags
    case 116: // Improper Encoding or Escaping of Output
      return ['user-input'];

    case 89: // SQL Injection
    case 564: // SQL Injection: Hibernate
      return ['user-input', 'database'];

    case 78: // OS Command Injection
    case 77: // Command Injection
    case 94: // Improper Control of Generation of Code (eval/Function)
    case 95: // Improper Neutralization of Directives in Dynamically Evaluated Code
      return ['user-input', 'process-exec'];

    case 22: // Path Traversal
    case 23: // Relative Path Traversal
    case 73: // External Control of File Name or Path
      return ['user-input', 'filesystem'];

    case 352: // Cross-Site Request Forgery
      return ['user-input', 'auth'];

    case 287: // Improper Authentication
    case 306: // Missing Authentication for Critical Function
    case 384: // Session Fixation
    case 521: // Weak Password Requirements
      return ['auth'];

    case 285: // Improper Authorization
    case 862: // Missing Authorization
    case 863: // Incorrect Authorization
    case 732: // Incorrect Permission Assignment for Critical Resource
      return ['permissions'];

    case 798: // Hard-coded Credentials
    case 259: // Hard-coded Password
    case 321: // Use of Hard-coded Cryptographic Key
      return ['secrets'];

    case 502: // Deserialization of Untrusted Data
    case 915: // Improperly Controlled Modification of Dynamically-Determined Object Attributes (mass assignment)
      return ['user-input', 'serialization'];

    case 918: // Server-Side Request Forgery
      return ['user-input', 'network'];

    case 200: // Information Exposure
    case 209: // Information Exposure Through an Error Message
      return ['network'];

    case 362: // Race Condition
    case 367: // TOCTOU Race Condition
    case 366: // Race Condition within a Thread
      return ['concurrency'];

    case 311: // Missing Encryption of Sensitive Data
    case 327: // Use of a Broken or Risky Cryptographic Algorithm
    case 326: // Inadequate Encryption Strength
      return ['network', 'secrets'];

    default:
      return [];
  }
}

/**
 * Catch-all for semgrep rules that ship without CWE metadata. We pattern-
 * match the rule ID, which encodes intent (semgrep's convention is
 * `<lang>.<framework>.<category>.<subcategory>.<name>`).
 */
function ruleIdToBoundaries(ruleId: string): readonly TrustBoundary[] {
  const id = ruleId.toLowerCase();

  if (id.includes('eval') || id.includes('exec') || id.includes('spawn')) {
    return ['user-input', 'process-exec'];
  }
  if (id.includes('sql-injection') || id.includes('sqli') || id.includes('tainted-sql')) {
    return ['user-input', 'database'];
  }
  if (id.includes('xss') || id.includes('cross-site-scripting')) {
    return ['user-input'];
  }
  if (id.includes('jwt') || id.includes('auth-') || id.includes('-auth')) {
    return ['auth'];
  }
  if (id.includes('cors') || id.includes('csrf')) {
    return ['user-input', 'auth'];
  }
  if (id.includes('ssrf') || id.includes('server-side-request')) {
    return ['user-input', 'network'];
  }
  if (id.includes('path-traversal') || id.includes('directory-traversal')) {
    return ['user-input', 'filesystem'];
  }
  if (id.includes('secret') || id.includes('hardcoded-credential') || id.includes('api-key')) {
    return ['secrets'];
  }
  if (id.includes('deserialization') || id.includes('unsafe-deserialize')) {
    return ['user-input', 'serialization'];
  }
  if (id.includes('crypto') || id.includes('weak-hash') || id.includes('insecure-hash')) {
    return ['secrets'];
  }

  return [];
}

/**
 * live-browser emits findings from axe-core (a11y violations) and from
 * raw security-header / console / network probes. Heuristics:
 *   - axe rules → `user-input` (a11y is about how users interact with the UI)
 *   - security-header/* → `network`
 *   - console/network errors → empty (no clear boundary)
 */
function assignLiveBrowserBoundaries(f: Finding): readonly TrustBoundary[] {
  const id = f.ruleId.toLowerCase();

  if (id.startsWith('axe/')) {
    return ['user-input'];
  }
  if (id.startsWith('security-header/')) {
    return ['network'];
  }
  return [];
}

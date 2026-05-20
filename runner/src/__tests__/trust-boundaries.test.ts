import { describe, it, expect } from 'vitest';
import { assignTrustBoundaries } from '../trust-boundaries.js';
import type { Finding } from '../types.js';

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    verifier: 'semgrep',
    ruleId: 'some-rule',
    severity: 'high',
    path: 'src/foo.ts',
    line: 10,
    message: 'test finding',
    ...overrides,
  };
}

describe('assignTrustBoundaries', () => {
  describe('gitleaks', () => {
    it('always tags `secrets` regardless of rule', () => {
      expect(assignTrustBoundaries(finding({ verifier: 'gitleaks', ruleId: 'aws-access-token' }))).toEqual([
        'secrets',
      ]);
      expect(assignTrustBoundaries(finding({ verifier: 'gitleaks', ruleId: 'github-pat' }))).toEqual([
        'secrets',
      ]);
      expect(assignTrustBoundaries(finding({ verifier: 'gitleaks', ruleId: 'generic-api-key' }))).toEqual(
        ['secrets'],
      );
    });
  });

  describe('dep-audit', () => {
    it('always tags `external-api`', () => {
      expect(
        assignTrustBoundaries(
          finding({ verifier: 'dep-audit', ruleId: 'known-vuln/lodash/CVE-2021-23337' }),
        ),
      ).toEqual(['external-api']);
      expect(
        assignTrustBoundaries(finding({ verifier: 'dep-audit', ruleId: 'misplaced-build-tool' })),
      ).toEqual(['external-api']);
    });
  });

  describe('live-lighthouse', () => {
    it('always tags `network`', () => {
      expect(
        assignTrustBoundaries(
          finding({ verifier: 'live-lighthouse', ruleId: 'largest-contentful-paint' }),
        ),
      ).toEqual(['network']);
    });
  });

  describe('live-browser (axe a11y)', () => {
    it('tags axe rules with `user-input`', () => {
      expect(
        assignTrustBoundaries(finding({ verifier: 'live-browser', ruleId: 'axe/color-contrast' })),
      ).toEqual(['user-input']);
      expect(
        assignTrustBoundaries(finding({ verifier: 'live-browser', ruleId: 'axe/image-alt' })),
      ).toEqual(['user-input']);
    });

    it('tags security-header/* rules with `network`', () => {
      expect(
        assignTrustBoundaries(
          finding({
            verifier: 'live-browser',
            ruleId: 'security-header/missing/content-security-policy',
          }),
        ),
      ).toEqual(['network']);
      expect(
        assignTrustBoundaries(
          finding({ verifier: 'live-browser', ruleId: 'security-header/missing/hsts' }),
        ),
      ).toEqual(['network']);
    });

    it('returns empty for unmapped live-browser rules', () => {
      expect(
        assignTrustBoundaries(finding({ verifier: 'live-browser', ruleId: 'console-error' })),
      ).toEqual([]);
    });
  });

  describe('semgrep CWE mapping', () => {
    it('maps CWE-79 (XSS) to [user-input]', () => {
      expect(assignTrustBoundaries(finding({ cwe: 'CWE-79', ruleId: 'r' }))).toContain('user-input');
    });

    it('maps CWE-89 (SQL injection) to [user-input, database]', () => {
      const b = assignTrustBoundaries(finding({ cwe: 'CWE-89', ruleId: 'r' }));
      expect(b).toContain('user-input');
      expect(b).toContain('database');
    });

    it('maps CWE-78 (OS command injection) to [user-input, process-exec]', () => {
      const b = assignTrustBoundaries(finding({ cwe: 'CWE-78', ruleId: 'r' }));
      expect(b).toContain('user-input');
      expect(b).toContain('process-exec');
    });

    it('maps CWE-22 (path traversal) to [user-input, filesystem]', () => {
      const b = assignTrustBoundaries(finding({ cwe: 'CWE-22', ruleId: 'r' }));
      expect(b).toContain('user-input');
      expect(b).toContain('filesystem');
    });

    it('maps CWE-352 (CSRF) to [user-input, auth]', () => {
      const b = assignTrustBoundaries(finding({ cwe: 'CWE-352', ruleId: 'r' }));
      expect(b).toContain('user-input');
      expect(b).toContain('auth');
    });

    it('maps CWE-287 (improper auth) to [auth]', () => {
      expect(assignTrustBoundaries(finding({ cwe: 'CWE-287', ruleId: 'r' }))).toEqual(['auth']);
    });

    it('maps CWE-862 (missing authz) to [permissions]', () => {
      expect(assignTrustBoundaries(finding({ cwe: 'CWE-862', ruleId: 'r' }))).toEqual(['permissions']);
    });

    it('maps CWE-798 (hard-coded creds) to [secrets]', () => {
      expect(assignTrustBoundaries(finding({ cwe: 'CWE-798', ruleId: 'r' }))).toEqual(['secrets']);
    });

    it('maps CWE-502 (unsafe deserialization) to [user-input, serialization]', () => {
      const b = assignTrustBoundaries(finding({ cwe: 'CWE-502', ruleId: 'r' }));
      expect(b).toContain('user-input');
      expect(b).toContain('serialization');
    });

    it('maps CWE-918 (SSRF) to [user-input, network]', () => {
      const b = assignTrustBoundaries(finding({ cwe: 'CWE-918', ruleId: 'r' }));
      expect(b).toContain('user-input');
      expect(b).toContain('network');
    });

    it('maps CWE-362 (race condition) to [concurrency]', () => {
      expect(assignTrustBoundaries(finding({ cwe: 'CWE-362', ruleId: 'r' }))).toEqual(['concurrency']);
    });

    it('handles CWE field with descriptive suffix (CWE-79: Cross-site Scripting)', () => {
      expect(
        assignTrustBoundaries(finding({ cwe: 'CWE-79: Cross-site Scripting', ruleId: 'r' })),
      ).toContain('user-input');
    });

    it('handles bare numeric CWE field', () => {
      expect(assignTrustBoundaries(finding({ cwe: '79', ruleId: 'r' }))).toContain('user-input');
    });

    it('returns empty for unknown CWE', () => {
      expect(assignTrustBoundaries(finding({ cwe: 'CWE-99999', ruleId: 'unknown-rule' }))).toEqual([]);
    });
  });

  describe('semgrep ruleId heuristics (CWE-less rules)', () => {
    it('tags *eval* rules with [user-input, process-exec]', () => {
      const b = assignTrustBoundaries(finding({ ruleId: 'javascript.lang.security.audit.dangerous-eval' }));
      expect(b).toContain('user-input');
      expect(b).toContain('process-exec');
    });

    it('tags *sql-injection* rules with [user-input, database]', () => {
      const b = assignTrustBoundaries(finding({ ruleId: 'sql-injection-via-template' }));
      expect(b).toContain('user-input');
      expect(b).toContain('database');
    });

    it('tags *xss* rules with [user-input]', () => {
      expect(assignTrustBoundaries(finding({ ruleId: 'react-xss-via-href' }))).toEqual(['user-input']);
    });

    it('tags *jwt* rules with [auth]', () => {
      expect(assignTrustBoundaries(finding({ ruleId: 'jwt-no-signature-verify' }))).toEqual(['auth']);
    });

    it('tags *ssrf* rules with [user-input, network]', () => {
      const b = assignTrustBoundaries(finding({ ruleId: 'nodejs-ssrf' }));
      expect(b).toContain('user-input');
      expect(b).toContain('network');
    });

    it('tags *path-traversal* rules with [user-input, filesystem]', () => {
      const b = assignTrustBoundaries(finding({ ruleId: 'path-traversal-in-archive' }));
      expect(b).toContain('user-input');
      expect(b).toContain('filesystem');
    });

    it('tags *hardcoded-credential* rules with [secrets]', () => {
      expect(assignTrustBoundaries(finding({ ruleId: 'hardcoded-credential' }))).toEqual(['secrets']);
    });

    it('returns empty for unmatched semgrep rule', () => {
      expect(assignTrustBoundaries(finding({ ruleId: 'totally-novel-rule-name' }))).toEqual([]);
    });
  });

  describe('combined CWE + heuristic', () => {
    it('de-dupes boundaries when CWE and ruleId both yield the same one', () => {
      // CWE-94 → user-input + process-exec; ruleId "dangerous-eval" → same.
      // Should not have duplicates.
      const b = assignTrustBoundaries(
        finding({ cwe: 'CWE-94', ruleId: 'javascript.lang.security.audit.dangerous-eval' }),
      );
      expect(b.filter((x) => x === 'user-input')).toHaveLength(1);
      expect(b.filter((x) => x === 'process-exec')).toHaveLength(1);
    });
  });

  describe('return shape', () => {
    it('always returns an array (never undefined)', () => {
      expect(Array.isArray(assignTrustBoundaries(finding({ ruleId: 'totally-unknown' })))).toBe(true);
    });
  });
});

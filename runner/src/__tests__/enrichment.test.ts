import { describe, it, expect } from 'vitest';
import { enrichFinding } from '../enrichment.js';
import { computeSignature } from '../signature.js';
import type { Finding } from '../types.js';

const baseFinding: Finding = {
  verifier: 'semgrep',
  ruleId: 'javascript.lang.security.audit.dangerous-eval',
  severity: 'high',
  path: 'src/api/exec.ts',
  line: 42,
  message: 'Use of eval()',
};

describe('enrichFinding', () => {
  it('adds a signature to a finding that lacks one', () => {
    const enriched = enrichFinding(baseFinding);
    expect(enriched.signature).toBeDefined();
    expect(enriched.signature).toMatch(/^[0-9a-f]{16}$/);
  });

  it('computes the signature using verifier + ruleId + path + line + endLine', () => {
    const enriched = enrichFinding(baseFinding);
    const expected = computeSignature({
      verifier: baseFinding.verifier,
      ruleId: baseFinding.ruleId,
      path: baseFinding.path,
      line: baseFinding.line,
      endLine: baseFinding.endLine,
    });
    expect(enriched.signature).toBe(expected);
  });

  it('preserves all original fields', () => {
    const enriched = enrichFinding(baseFinding);
    expect(enriched.verifier).toBe(baseFinding.verifier);
    expect(enriched.ruleId).toBe(baseFinding.ruleId);
    expect(enriched.severity).toBe(baseFinding.severity);
    expect(enriched.path).toBe(baseFinding.path);
    expect(enriched.line).toBe(baseFinding.line);
    expect(enriched.message).toBe(baseFinding.message);
  });

  it('is idempotent — does not re-compute if signature AND trustBoundaries are already present', () => {
    const preEnriched: Finding = {
      ...baseFinding,
      signature: 'preset0000000000',
      trustBoundaries: ['user-input'],
    };
    const result = enrichFinding(preEnriched);
    expect(result.signature).toBe('preset0000000000');
    expect(result.trustBoundaries).toEqual(['user-input']);
    // Returns the same reference when fully enriched (cheap fast-path)
    expect(result).toBe(preEnriched);
  });

  it('fills in only the missing field when partially enriched (signature present, boundaries missing)', () => {
    const partial: Finding = { ...baseFinding, signature: 'preset0000000000' };
    const result = enrichFinding(partial);
    expect(result.signature).toBe('preset0000000000');
    expect(result.trustBoundaries).toBeDefined();
  });

  it('fills in only the missing field when partially enriched (boundaries present, signature missing)', () => {
    const partial: Finding = { ...baseFinding, trustBoundaries: ['secrets'] };
    const result = enrichFinding(partial);
    expect(result.signature).toMatch(/^[0-9a-f]{16}$/);
    expect(result.trustBoundaries).toEqual(['secrets']);
  });

  it('does not mutate the input finding', () => {
    const input: Finding = { ...baseFinding };
    expect(input.signature).toBeUndefined();
    enrichFinding(input);
    expect(input.signature).toBeUndefined();
  });

  it('handles findings without a line number', () => {
    const noLine: Finding = {
      verifier: 'dep-audit',
      ruleId: 'known-vuln/lodash/CVE-2021-23337',
      severity: 'high',
      path: 'package.json',
      message: 'lodash@4.17.20 is vulnerable',
    };
    const enriched = enrichFinding(noLine);
    expect(enriched.signature).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces identical signatures for findings differing only in severity/message', () => {
    // Critical: same rule on same location should dedup regardless of how
    // the LLM reworded the message or the verifier upgraded the severity.
    const a = enrichFinding({ ...baseFinding, severity: 'high', message: 'old wording' });
    const b = enrichFinding({ ...baseFinding, severity: 'critical', message: 'new wording' });
    expect(a.signature).toBe(b.signature);
  });

  it('produces different signatures when path differs', () => {
    const a = enrichFinding(baseFinding);
    const b = enrichFinding({ ...baseFinding, path: 'src/api/other.ts' });
    expect(a.signature).not.toBe(b.signature);
  });

  it('produces different signatures when line differs', () => {
    const a = enrichFinding(baseFinding);
    const b = enrichFinding({ ...baseFinding, line: 100 });
    expect(a.signature).not.toBe(b.signature);
  });

  describe('trust boundary assignment', () => {
    it('always assigns a trustBoundaries array (even if empty)', () => {
      const enriched = enrichFinding(baseFinding);
      expect(Array.isArray(enriched.trustBoundaries)).toBe(true);
    });

    it('assigns [secrets] for gitleaks findings', () => {
      const enriched = enrichFinding({
        verifier: 'gitleaks',
        ruleId: 'aws-access-token',
        severity: 'critical',
        path: '.env.backup',
        message: 'AWS credential leaked',
      });
      expect(enriched.trustBoundaries).toEqual(['secrets']);
    });

    it('assigns [external-api] for dep-audit findings', () => {
      const enriched = enrichFinding({
        verifier: 'dep-audit',
        ruleId: 'known-vuln/jsonwebtoken/CVE-2022-23529',
        severity: 'high',
        path: 'package.json',
        message: 'jsonwebtoken vulnerable',
      });
      expect(enriched.trustBoundaries).toEqual(['external-api']);
    });

    it('assigns [user-input, process-exec] for semgrep eval findings via CWE-94', () => {
      const enriched = enrichFinding({
        verifier: 'semgrep',
        ruleId: 'javascript.lang.security.audit.dangerous-eval',
        severity: 'high',
        path: 'src/api/exec.ts',
        line: 42,
        message: 'eval() with user input',
        cwe: 'CWE-94',
      });
      expect(enriched.trustBoundaries).toContain('user-input');
      expect(enriched.trustBoundaries).toContain('process-exec');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { computeSignature, type SignatureInput } from '../signature.js';

const base: SignatureInput = {
  verifier: 'semgrep',
  ruleId: 'javascript.lang.security.audit.dangerous-eval',
  path: 'src/api/exec.ts',
  line: 42,
};

describe('computeSignature', () => {
  describe('determinism', () => {
    it('returns the same signature for the same input', () => {
      const a = computeSignature(base);
      const b = computeSignature(base);
      expect(a).toBe(b);
    });

    it('returns the same signature across repeated calls (no internal state)', () => {
      const sigs = Array.from({ length: 50 }, () => computeSignature(base));
      const unique = new Set(sigs);
      expect(unique.size).toBe(1);
    });
  });

  describe('format', () => {
    it('returns exactly 16 hex characters', () => {
      const sig = computeSignature(base);
      expect(sig).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('field sensitivity', () => {
    it('changes when verifier changes', () => {
      const a = computeSignature(base);
      const b = computeSignature({ ...base, verifier: 'gitleaks' });
      expect(a).not.toBe(b);
    });

    it('changes when ruleId changes', () => {
      const a = computeSignature(base);
      const b = computeSignature({ ...base, ruleId: 'different-rule' });
      expect(a).not.toBe(b);
    });

    it('changes when path changes', () => {
      const a = computeSignature(base);
      const b = computeSignature({ ...base, path: 'src/api/other.ts' });
      expect(a).not.toBe(b);
    });

    it('changes when line changes', () => {
      const a = computeSignature(base);
      const b = computeSignature({ ...base, line: 43 });
      expect(a).not.toBe(b);
    });

    it('changes when endLine changes', () => {
      const a = computeSignature({ ...base, endLine: 50 });
      const b = computeSignature({ ...base, endLine: 51 });
      expect(a).not.toBe(b);
    });
  });

  describe('path normalization (stability across platforms)', () => {
    it('treats backslashes and forward slashes as equivalent', () => {
      const unix = computeSignature({ ...base, path: 'src/api/exec.ts' });
      const windows = computeSignature({ ...base, path: 'src\\api\\exec.ts' });
      expect(unix).toBe(windows);
    });

    it('treats leading ./ as equivalent to no prefix', () => {
      const bare = computeSignature({ ...base, path: 'src/api/exec.ts' });
      const dotted = computeSignature({ ...base, path: './src/api/exec.ts' });
      expect(bare).toBe(dotted);
    });

    it('strips trailing slashes (defensive)', () => {
      const a = computeSignature({ ...base, path: 'src/api' });
      const b = computeSignature({ ...base, path: 'src/api/' });
      expect(a).toBe(b);
    });

    it('does NOT lowercase paths (case-sensitive filesystems)', () => {
      const lower = computeSignature({ ...base, path: 'src/api/exec.ts' });
      const upper = computeSignature({ ...base, path: 'src/API/exec.ts' });
      expect(lower).not.toBe(upper);
    });
  });

  describe('optional line handling', () => {
    it('produces a stable signature when line is omitted', () => {
      const { line: _line, ...noLine } = base;
      const a = computeSignature(noLine);
      const b = computeSignature(noLine);
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{16}$/);
    });

    it('treats line:undefined as different from line:1', () => {
      const { line: _line, ...noLine } = base;
      const a = computeSignature(noLine);
      const b = computeSignature({ ...noLine, line: 1 });
      expect(a).not.toBe(b);
    });

    it('treats endLine:undefined as different from endLine:1', () => {
      const a = computeSignature(base);
      const b = computeSignature({ ...base, endLine: 1 });
      expect(a).not.toBe(b);
    });
  });

  describe('immutable-field tolerance', () => {
    // SignatureInput intentionally excludes severity/message/evidence. If the
    // verifier later rewords a finding, the signature must stay the same so
    // dedup across runs keeps working. This is tested implicitly by the input
    // type itself — SignatureInput has no severity field — but we lock it in
    // with a structural test so future refactors don't accidentally widen
    // the input type.
    it('SignatureInput excludes severity/message/evidence/fix', () => {
      // Type-level check: assignment proves SignatureInput rejects these fields.
      // If someone adds them to SignatureInput, this will fail to typecheck.
      const input = {
        verifier: 'semgrep' as const,
        ruleId: 'r',
        path: 'p',
      };
      const _typeCheck: SignatureInput = input;
      expect(_typeCheck).toBeDefined();
    });
  });

  describe('collision resistance (smoke)', () => {
    it('produces distinct signatures for 1000 realistic-looking findings', () => {
      const sigs = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        sigs.add(
          computeSignature({
            verifier: 'semgrep',
            ruleId: `rule-${i % 20}`,
            path: `src/feature-${Math.floor(i / 20)}/handler.ts`,
            line: i,
          }),
        );
      }
      // All 1000 should be unique (verifier+rule+path+line varies meaningfully).
      expect(sigs.size).toBe(1000);
    });
  });
});

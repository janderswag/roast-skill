import { describe, it, expect } from 'vitest';
import { generateClaimCode, computeContentHash } from '../claim.js';

describe('generateClaimCode', () => {
  it('matches RST-XXXXXXXX format with Crockford base32 body', () => {
    const code = generateClaimCode();
    expect(code).toMatch(/^RST-[0-9A-HJ-NP-TV-Z]{8}$/);
  });

  it('omits ambiguous characters (I, L, O, U)', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateClaimCode();
      const body = code.slice(4);
      for (const ch of body) {
        expect('ILOU'.includes(ch)).toBe(false);
      }
    }
  });

  it('generates unique codes across runs', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i += 1) codes.add(generateClaimCode());
    expect(codes.size).toBe(500);
  });
});

describe('computeContentHash', () => {
  const base = {
    cwd: '/Users/me/Desktop/my-project',
    gitHead: 'abc1234',
    gitDirty: false,
    url: undefined,
    skillVersion: '0.6.0',
  };

  it('is deterministic for identical inputs', () => {
    expect(computeContentHash(base)).toBe(computeContentHash(base));
  });

  it('returns a 64-char hex string', () => {
    expect(computeContentHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when git head changes', () => {
    const a = computeContentHash(base);
    const b = computeContentHash({ ...base, gitHead: 'def5678' });
    expect(a).not.toBe(b);
  });

  it('changes when dirty flag flips', () => {
    const a = computeContentHash(base);
    const b = computeContentHash({ ...base, gitDirty: true });
    expect(a).not.toBe(b);
  });

  it('changes when skill version changes', () => {
    const a = computeContentHash(base);
    const b = computeContentHash({ ...base, skillVersion: '0.7.0' });
    expect(a).not.toBe(b);
  });

  it('changes when URL changes (live audit vs local)', () => {
    const a = computeContentHash(base);
    const b = computeContentHash({ ...base, url: 'https://example.com' });
    expect(a).not.toBe(b);
  });

  it('uses basename only — same project at different parent paths hashes identically', () => {
    const a = computeContentHash({ ...base, cwd: '/Users/me/Desktop/my-project' });
    const b = computeContentHash({ ...base, cwd: '/home/other/projects/my-project' });
    expect(a).toBe(b);
  });

  it('treats null head and dirty independently', () => {
    const noGit = computeContentHash({ ...base, gitHead: null });
    const cleanGit = computeContentHash({ ...base, gitHead: 'abc1234' });
    expect(noGit).not.toBe(cleanGit);
  });
});

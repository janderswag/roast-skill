import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePsiResponse } from '../verifiers/live-lighthouse.js';

const fixturePath = join(__dirname, '..', '..', 'fixtures', 'parsers', 'psi-mixed.json');
const sample = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('parsePsiResponse', () => {
  it('returns empty on malformed input', () => {
    expect(parsePsiResponse(null, 'https://x.com').length).toBe(0);
    expect(parsePsiResponse({}, 'https://x.com').length).toBe(0);
    expect(parsePsiResponse({ lighthouseResult: {} }, 'https://x.com').length).toBe(0);
  });

  it('produces findings for poor performance scores', () => {
    const findings = parsePsiResponse(sample, 'https://example.com/');
    const perf = findings.find((f) => f.ruleId === 'lighthouse/category/performance');
    expect(perf).toBeDefined();
    expect(perf!.severity).toBe('high'); // 42% → high
    expect(perf!.message).toContain('42/100');
  });

  it('uses path = host+pathname for live findings', () => {
    const findings = parsePsiResponse(sample, 'https://example.com/foo/bar');
    for (const f of findings) {
      expect(f.path.startsWith('example.com')).toBe(true);
    }
  });

  it('flags poor LCP as high severity', () => {
    const findings = parsePsiResponse(sample, 'https://example.com/');
    const lcp = findings.find((f) => f.ruleId === 'lighthouse/largest-contentful-paint');
    expect(lcp).toBeDefined();
    expect(lcp!.severity).toBe('high'); // 8.2s >> 4.0s threshold
    expect(lcp!.message).toContain('8.2');
  });

  it('flags needs-improvement CLS as medium', () => {
    const findings = parsePsiResponse(sample, 'https://example.com/');
    const cls = findings.find((f) => f.ruleId === 'lighthouse/cumulative-layout-shift');
    expect(cls).toBeDefined();
    expect(cls!.severity).toBe('medium'); // 0.15 is needs-improvement
  });

  it('omits findings for "good" metrics (TBT 150ms)', () => {
    const findings = parsePsiResponse(sample, 'https://example.com/');
    const tbt = findings.find((f) => f.ruleId === 'lighthouse/total-blocking-time');
    expect(tbt).toBeUndefined();
  });

  it('flags accessibility score below 90 as medium', () => {
    const findings = parsePsiResponse(sample, 'https://example.com/');
    const a11y = findings.find((f) => f.ruleId === 'lighthouse/category/accessibility');
    expect(a11y).toBeDefined();
    expect(a11y!.severity).toBe('low'); // 78 → low (>=75)
  });

  it('omits high-scoring categories (best-practices 92, seo 88)', () => {
    const findings = parsePsiResponse(sample, 'https://example.com/');
    expect(findings.find((f) => f.ruleId === 'lighthouse/category/best-practices')).toBeUndefined();
    // SEO 88 = below 90 → low
    expect(findings.find((f) => f.ruleId === 'lighthouse/category/seo')?.severity).toBe('low');
  });

  it('every finding has verifier=live-lighthouse and valid shape', () => {
    const findings = parsePsiResponse(sample, 'https://example.com/');
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.verifier).toBe('live-lighthouse');
      expect(f.ruleId.startsWith('lighthouse/')).toBe(true);
      expect(f.message.length).toBeGreaterThan(0);
      expect(f.path.length).toBeGreaterThan(0);
    }
  });
});

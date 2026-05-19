import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSemgrepJson } from '../verifiers/semgrep.js';

const fixturePath = join(__dirname, '..', '..', 'fixtures', 'parsers', 'semgrep-sample.json');
const sample = readFileSync(fixturePath, 'utf8');

describe('parseSemgrepJson', () => {
  it('returns empty array on empty input', () => {
    expect(parseSemgrepJson('')).toEqual([]);
    expect(parseSemgrepJson('   ')).toEqual([]);
  });

  it('returns empty array on malformed JSON', () => {
    expect(parseSemgrepJson('not json')).toEqual([]);
    expect(parseSemgrepJson('{')).toEqual([]);
  });

  it('returns empty array on JSON that fails schema validation', () => {
    expect(parseSemgrepJson('{"results": "not an array"}')).toEqual([]);
    expect(parseSemgrepJson('[1,2,3]')).toEqual([]);
  });

  it('parses the fixture into normalized Findings', () => {
    const findings = parseSemgrepJson(sample);
    expect(findings.length).toBe(3);

    const evalFinding = findings.find((f) => f.ruleId.includes('detect-eval-with-expression'));
    expect(evalFinding).toBeDefined();
    expect(evalFinding!.severity).toBe('high');
    expect(evalFinding!.path).toBe('src/danger.js');
    expect(evalFinding!.line).toBe(6);
    expect(evalFinding!.endLine).toBe(6);
    expect(evalFinding!.cwe).toContain('CWE-95');
    expect(evalFinding!.owasp).toContain('A03:2021');
  });

  it('maps WARNING severity to medium', () => {
    const findings = parseSemgrepJson(sample);
    const redirect = findings.find((f) => f.ruleId.includes('open-redirect'));
    expect(redirect?.severity).toBe('medium');
  });

  it('escalates secret-y rule ids with ERROR severity to critical', () => {
    const findings = parseSemgrepJson(sample);
    const secret = findings.find((f) => f.ruleId.includes('aws-access-key-id'));
    expect(secret?.severity).toBe('critical');
  });

  it('redacts high-entropy strings in evidence', () => {
    const findings = parseSemgrepJson(sample);
    const secret = findings.find((f) => f.ruleId.includes('aws-access-key-id'));
    expect(secret?.evidence).toBeDefined();
    expect(secret?.evidence).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(secret?.evidence).toContain('[REDACTED:');
  });

  it('handles cwe as either string or string array', () => {
    const findings = parseSemgrepJson(sample);
    const evalFinding = findings.find((f) => f.ruleId.includes('detect-eval-with-expression'));
    const redirect = findings.find((f) => f.ruleId.includes('open-redirect'));
    expect(typeof evalFinding!.cwe).toBe('string');  // array case picked first element
    expect(typeof redirect!.cwe).toBe('string');     // bare string case
  });

  it('caps message length to 500 chars', () => {
    const long = 'x'.repeat(5000);
    const raw = JSON.stringify({
      results: [{
        check_id: 'rule.long',
        path: 'a.js',
        start: { line: 1 },
        extra: { message: long, severity: 'ERROR' },
      }],
    });
    const findings = parseSemgrepJson(raw);
    expect(findings[0]!.message.length).toBeLessThanOrEqual(500);
  });
});

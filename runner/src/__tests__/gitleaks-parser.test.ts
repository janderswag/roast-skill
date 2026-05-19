import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGitleaksJson } from '../verifiers/gitleaks.js';

const fixturePath = join(__dirname, '..', '..', 'fixtures', 'parsers', 'gitleaks-sample.json');
const sample = readFileSync(fixturePath, 'utf8');

describe('parseGitleaksJson', () => {
  it('returns empty on empty input', () => {
    expect(parseGitleaksJson('')).toEqual([]);
  });

  it('returns empty on malformed JSON', () => {
    expect(parseGitleaksJson('not json')).toEqual([]);
  });

  it('returns empty on wrong schema (object instead of array)', () => {
    expect(parseGitleaksJson('{"foo":"bar"}')).toEqual([]);
  });

  it('parses the fixture into normalized Findings', () => {
    const findings = parseGitleaksJson(sample);
    expect(findings.length).toBe(2);
  });

  it('marks every gitleaks finding as critical severity', () => {
    const findings = parseGitleaksJson(sample);
    for (const f of findings) expect(f.severity).toBe('critical');
  });

  it('NEVER includes the raw secret in any field', () => {
    const findings = parseGitleaksJson(sample);
    const serialized = JSON.stringify(findings);
    expect(serialized).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(serialized).not.toContain('ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('redacts the secret in evidence with length marker', () => {
    const findings = parseGitleaksJson(sample);
    const aws = findings.find((f) => f.ruleId === 'aws-access-token');
    expect(aws?.evidence).toBe('[REDACTED:len=20]');
  });

  it('emits a fix recommendation that mentions credential rotation', () => {
    const findings = parseGitleaksJson(sample);
    for (const f of findings) {
      expect(f.fix?.toLowerCase()).toContain('rotate');
    }
  });

  it('includes a short commit suffix in the message when present', () => {
    const findings = parseGitleaksJson(sample);
    const aws = findings.find((f) => f.ruleId === 'aws-access-token');
    expect(aws?.message).toMatch(/commit abc123d/);
  });
});

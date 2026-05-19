import { describe, it, expect } from 'vitest';
import { redact, redactSecret, redactLine, looksSecrety } from '../redact.js';

describe('redact', () => {
  it('redacts AWS access keys', () => {
    const out = redact('const KEY = "AKIAIOSFODNN7EXAMPLE";');
    expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(out).toContain('[REDACTED:');
  });

  it('redacts OpenAI / Anthropic style keys', () => {
    const out = redact('sk-proj-abc123def456ghi789jkl012mnop');
    expect(out).toContain('[REDACTED:');
    expect(out).not.toContain('sk-proj-abc123def456ghi789jkl012mnop');
  });

  it('redacts GitHub personal tokens', () => {
    const out = redact('token=ghp_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(out).toMatch(/\[REDACTED:len=\d+\]/);
  });

  it('redacts Slack tokens', () => {
    const out = redact('xoxb-1234567890-aaaaaaaaaaaa');
    expect(out).toContain('[REDACTED:');
  });

  it('redacts JWTs', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturepartXXXXXXX';
    const out = redact(`Authorization: Bearer ${jwt}`);
    expect(out).toContain('[REDACTED:');
    expect(out).not.toContain(jwt);
  });

  it('redacts PEM private keys', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAK\n-----END RSA PRIVATE KEY-----';
    expect(redact(pem)).not.toContain('MIIEpAIBAAK');
  });

  it('is a no-op for non-secret strings', () => {
    expect(redact('const x = 1 + 1;')).toBe('const x = 1 + 1;');
  });
});

describe('redactSecret', () => {
  it('replaces with redaction marker including length', () => {
    expect(redactSecret('abc')).toBe('[REDACTED:len=3]');
    expect(redactSecret('mysecretvalue')).toBe('[REDACTED:len=13]');
  });
});

describe('redactLine', () => {
  it('redacts both regex hits and explicit secret list', () => {
    const out = redactLine('api: "AKIAIOSFODNN7EXAMPLE" + "my-extra-secret"', ['my-extra-secret']);
    expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(out).not.toContain('my-extra-secret');
  });

  it('ignores very short "secrets" to avoid over-redaction', () => {
    const out = redactLine('x=1', ['x=']);
    expect(out).toBe('x=1');
  });
});

describe('looksSecrety', () => {
  it('matches rule ids that mention secret-like terms', () => {
    expect(looksSecrety('detected-aws-access-key-id')).toBe(true);
    expect(looksSecrety('hardcoded-api-key')).toBe(true);
    expect(looksSecrety('JWT_TOKEN_LEAK')).toBe(true);
    expect(looksSecrety('credential-in-code')).toBe(true);
    expect(looksSecrety('private-key-exposure')).toBe(true);
  });

  it('rejects unrelated rule ids', () => {
    expect(looksSecrety('eval-with-user-input')).toBe(false);
    expect(looksSecrety('open-redirect')).toBe(false);
  });
});

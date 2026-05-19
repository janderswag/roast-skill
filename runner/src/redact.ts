const HIGH_ENTROPY_PATTERNS: ReadonlyArray<RegExp> = [
  /AKIA[0-9A-Z]{16}/g,                              // AWS access key
  /sk-(?:proj-|ant-api03-)?[A-Za-z0-9_-]{20,}/g,    // OpenAI / Anthropic
  /ghp_[A-Za-z0-9]{36,}/g,                          // GitHub personal token
  /gho_[A-Za-z0-9]{36,}/g,                          // GitHub OAuth
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,                  // Slack
  /eyJ[A-Za-z0-9_=-]{10,}\.[A-Za-z0-9_=-]{10,}\.[A-Za-z0-9_.+/=-]{10,}/g, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g,
];

const SECRETY_RULE_HINTS = [
  'secret', 'token', 'apikey', 'api-key', 'api_key',
  'credential', 'password',
  'private-key', 'privatekey',
  'access-key', 'access_key', 'accesskey',
];

export function looksSecrety(ruleId: string): boolean {
  const lower = ruleId.toLowerCase();
  return SECRETY_RULE_HINTS.some((h) => lower.includes(h));
}

export function redact(input: string): string {
  let out = input;
  for (const pattern of HIGH_ENTROPY_PATTERNS) {
    out = out.replace(pattern, (m) => `[REDACTED:len=${m.length}]`);
  }
  return out;
}

export function redactSecret(secret: string): string {
  return `[REDACTED:len=${secret.length}]`;
}

export function redactLine(line: string, secrets: readonly string[]): string {
  let out = redact(line);
  for (const s of secrets) {
    if (s.length < 4) continue;
    out = out.split(s).join(redactSecret(s));
  }
  return out;
}

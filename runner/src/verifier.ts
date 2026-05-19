import type { Finding, VerifierName, VerifierResult } from './types.js';

export interface VerifierContext {
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

export interface Verifier {
  readonly name: VerifierName;
  isAvailable(ctx: VerifierContext): Promise<AvailabilityResult>;
  run(ctx: VerifierContext): Promise<VerifierResult>;
}

export type AvailabilityResult =
  | { readonly available: true }
  | { readonly available: false; readonly reason: string };

export function ok(
  verifier: VerifierName,
  findings: readonly Finding[],
  durationMs: number,
): VerifierResult {
  return { verifier, status: 'ok', findings, durationMs };
}

export function skipped(
  verifier: VerifierName,
  reason: string,
  durationMs: number,
): VerifierResult {
  return { verifier, status: 'skipped', reason, findings: [], durationMs };
}

export function errored(
  verifier: VerifierName,
  reason: string,
  durationMs: number,
): VerifierResult {
  return { verifier, status: 'error', reason, findings: [], durationMs };
}

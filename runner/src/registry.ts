import type { Verifier } from './verifier.js';
import { semgrepVerifier } from './verifiers/semgrep.js';
import { gitleaksVerifier } from './verifiers/gitleaks.js';
import { depAuditVerifier } from './verifiers/dep-audit.js';
import { liveBrowserVerifier } from './verifiers/live-browser.js';
import { liveLighthouseVerifier } from './verifiers/live-lighthouse.js';

export const ALL_VERIFIERS: readonly Verifier[] = [
  semgrepVerifier,
  gitleaksVerifier,
  depAuditVerifier,
  liveBrowserVerifier,
  liveLighthouseVerifier,
];

import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { z } from 'zod';
import type { Finding, RunReport, Severity, Summary } from './types.js';
import { FindingSchema, SummarySchema } from './types.js';
import { computeContentHash, generateClaimCode } from './claim.js';
import type { GitInfo } from './git.js';
import { RUNNER_VERSION } from './orchestrator.js';

const RESUME_BASE_URL = 'https://www.roastrebuild.com';

export const PrivacyBlockSchema = z
  .object({
    what_we_send: z.array(z.string()).readonly(),
    what_we_dont_send: z.array(z.string()).readonly(),
    finding_count: z.number().int().nonnegative(),
    file_paths_referenced: z.number().int().nonnegative(),
    redacted_evidence_count: z.number().int().nonnegative(),
    snippet_count: z.number().int().nonnegative(),
    max_snippet_chars: z.number().int().nonnegative(),
  })
  .strict();

export type PrivacyBlock = z.infer<typeof PrivacyBlockSchema>;

export const ClaimMetadataSchema = z
  .object({
    claim_code: z.string().regex(/^RST-[0-9A-HJ-NP-TV-Z]{8}$/),
    content_hash: z.string().regex(/^[0-9a-f]{64}$/),
    cwd_basename: z.string().min(1),
    git_head: z.string().nullable(),
    git_dirty: z.boolean(),
    git_branch: z.string().nullable(),
    audit_url: z.string().nullable(),
    skill_version: z.string(),
    exported_at: z.string().datetime(),
    resume_url: z.string().url(),
  })
  .strict();

export type ClaimMetadata = z.infer<typeof ClaimMetadataSchema>;

export const ExportPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    _privacy: PrivacyBlockSchema,
    claim_metadata: ClaimMetadataSchema,
    summary: SummarySchema,
    findings: z.array(FindingSchema).readonly(),
    audit_duration_ms: z.number().int().nonnegative(),
  })
  .strict();

export type ExportPayload = z.infer<typeof ExportPayloadSchema>;

export interface BuildExportInput {
  readonly report: RunReport;
  readonly git: GitInfo;
  readonly url: string | undefined;
  readonly cwd: string;
}

export function buildExportPayload(input: BuildExportInput): ExportPayload {
  const findings = collectFindings(input.report);
  const claimCode = generateClaimCode();
  const contentHash = computeContentHash({
    cwd: input.cwd,
    gitHead: input.git.head,
    gitDirty: input.git.dirty,
    url: input.url,
    skillVersion: RUNNER_VERSION,
  });

  const cwdBasename = basename(input.cwd) || 'unknown';
  const privacy = buildPrivacyBlock(findings, input.url !== undefined);

  return {
    schemaVersion: 1,
    _privacy: privacy,
    claim_metadata: {
      claim_code: claimCode,
      content_hash: contentHash,
      cwd_basename: cwdBasename,
      git_head: input.git.head,
      git_dirty: input.git.dirty,
      git_branch: input.git.branch,
      audit_url: input.url ?? null,
      skill_version: RUNNER_VERSION,
      exported_at: new Date().toISOString(),
      resume_url: `${RESUME_BASE_URL}/resume?c=${claimCode}`,
    },
    summary: input.report.summary,
    findings,
    audit_duration_ms: input.report.durationMs,
  };
}

function collectFindings(report: RunReport): readonly Finding[] {
  return report.results.flatMap((r) => r.findings);
}

function buildPrivacyBlock(findings: readonly Finding[], hasUrl: boolean): PrivacyBlock {
  const pathSet = new Set<string>();
  let redactedEvidence = 0;
  let snippetCount = 0;
  let maxSnippetChars = 0;

  for (const f of findings) {
    pathSet.add(f.path);
    if (f.evidence) {
      snippetCount += 1;
      maxSnippetChars = Math.max(maxSnippetChars, f.evidence.length);
      if (f.evidence.includes('[REDACTED:')) redactedEvidence += 1;
    }
  }

  const whatWeSend: string[] = [
    'finding rule IDs, severities, and one-line messages',
    'file paths referenced (basenames + relative paths) and line numbers',
    'redacted evidence snippets (max 500 chars; secrets replaced with [REDACTED:len=N])',
    'project basename + git short-SHA + branch (NOT full paths)',
  ];
  if (hasUrl) whatWeSend.push('the URL you passed to --url (host + pathname)');

  const whatWeDont: ReadonlyArray<string> = [
    'no full filesystem paths (only basename of cwd)',
    'no raw source code beyond <=500-char evidence snippets',
    'no environment variables, secrets, or credentials',
    'no screenshots (kept local in /tmp/, never uploaded)',
    'no authentication, no API keys, no telemetry',
  ];

  return {
    what_we_send: whatWeSend,
    what_we_dont_send: whatWeDont,
    finding_count: findings.length,
    file_paths_referenced: pathSet.size,
    redacted_evidence_count: redactedEvidence,
    snippet_count: snippetCount,
    max_snippet_chars: maxSnippetChars,
  };
}

export async function writeExportPayload(payload: ExportPayload, outPath: string): Promise<{ bytesWritten: number; absolutePath: string }> {
  const absolutePath = resolve(outPath);
  const serialized = JSON.stringify(payload, null, 2);
  await writeFile(absolutePath, serialized, 'utf8');
  return { bytesWritten: Buffer.byteLength(serialized, 'utf8'), absolutePath };
}

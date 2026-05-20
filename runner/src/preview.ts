import { createInterface } from 'node:readline';
import type { ExportPayload } from './export.js';

const SEPARATOR = '─'.repeat(60);

export interface PreviewOptions {
  readonly assumeYes: boolean;
  readonly outPath: string;
}

export type PreviewResult =
  | { readonly proceed: true }
  | { readonly proceed: false; readonly reason: string };

/**
 * Print the pre-export preview to stderr and (unless --export-yes) ask the
 * user to confirm before writing the file. Returns whether to proceed.
 *
 * Stdin-not-a-TTY without --export-yes is a hard reject: refusing to write
 * silently in non-interactive contexts (CI, piped invocations) is the
 * conservative choice for a privacy-sensitive op.
 */
export async function runPreview(payload: ExportPayload, opts: PreviewOptions): Promise<PreviewResult> {
  printPreview(payload, opts.outPath);

  if (opts.assumeYes) {
    process.stderr.write('  → --export-yes flag passed; skipping interactive confirmation\n\n');
    return { proceed: true };
  }

  if (!process.stdin.isTTY) {
    return {
      proceed: false,
      reason: 'stdin is not a TTY and --export-yes was not passed; refusing to write silently. Re-run with --export-yes to bypass the prompt.',
    };
  }

  const answer = await askYesNo('Continue? [y/N]: ');
  process.stderr.write('\n');
  return answer ? { proceed: true } : { proceed: false, reason: 'user declined export' };
}

function printPreview(payload: ExportPayload, outPath: string): void {
  const p = payload._privacy;
  const lines: string[] = [
    '',
    SEPARATOR,
    `  Ready to export roast.json → ${outPath}`,
    SEPARATOR,
    '',
    '  What we\'d send to roastrebuild.com:',
    `    ${pad(p.finding_count)} findings`,
    `    ${pad(p.file_paths_referenced)} file paths (basenames + line numbers only)`,
    `    ${pad(p.redacted_evidence_count)} redacted secret evidence snippets`,
    `    ${pad(p.snippet_count)} code evidence snippets (max ${p.max_snippet_chars} chars each)`,
    '',
    '  What we\'d NOT send:',
  ];

  for (const item of p.what_we_dont_send) {
    lines.push(`    ✗ ${item}`);
  }

  lines.push('');
  lines.push(`  Claim code (pre-generated): ${payload.claim_metadata.claim_code}`);
  lines.push(`  Audit URL: ${payload.claim_metadata.audit_url ?? 'local-only (no --url)'}`);
  if (payload.claim_metadata.git_head !== null) {
    lines.push(`  Git: ${payload.claim_metadata.git_head}${payload.claim_metadata.git_dirty ? ' (dirty)' : ''}${payload.claim_metadata.git_branch ? ` on ${payload.claim_metadata.git_branch}` : ''}`);
  }
  lines.push('');
  lines.push(SEPARATOR);
  lines.push('');

  process.stderr.write(lines.join('\n'));
}

function pad(n: number): string {
  return n.toString().padStart(4, ' ');
}

async function askYesNo(prompt: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer: string = await new Promise((res) => rl.question(prompt, res));
    const lower = answer.trim().toLowerCase();
    return lower === 'y' || lower === 'yes';
  } finally {
    rl.close();
  }
}

import qrcode from 'qrcode-terminal';
import type { ExportPayload } from './export.js';

const SEPARATOR = '─'.repeat(60);
const FROM_SKILL_ENDPOINT = 'https://www.roastrebuild.com/api/audit/from-skill';

export interface PrintCtaInput {
  readonly payload: ExportPayload;
  readonly absolutePath: string;
  readonly bytesWritten: number;
}

/**
 * Print the post-export CTA to stderr. Three resume paths — curl one-liner,
 * QR code for mobile, manual short-code paste — so the user picks the most
 * convenient one. Stdout is reserved for the RunReport JSON; nothing here
 * pollutes it.
 */
export function printExportCta(input: PrintCtaInput): void {
  const sizeKb = (input.bytesWritten / 1024).toFixed(1);
  const code = input.payload.claim_metadata.claim_code;
  const resumeUrl = input.payload.claim_metadata.resume_url;

  const header = [
    '',
    SEPARATOR,
    `  ✓ Exported to ${input.absolutePath} (${sizeKb} KB)`,
    '',
    `  Your claim code: ${code}`,
    '  Expires in 30 days.',
    SEPARATOR,
    '',
    '  Pay $19 to unlock the full audit + 90-day roadmap:',
    '',
    '  ── Option 1: curl (instant) ──',
    `    curl -X POST ${FROM_SKILL_ENDPOINT} \\`,
    "      -H 'Content-Type: application/json' \\",
    `      -d @${input.absolutePath}`,
    '',
    '  ── Option 2: scan QR with your phone ──',
  ];
  process.stderr.write(header.join('\n') + '\n');

  qrcode.generate(resumeUrl, { small: true }, (qr: string) => {
    process.stderr.write(indent(qr, '    ') + '\n');
  });

  const footer = [
    `    → ${resumeUrl}`,
    '',
    '  ── Option 3: visit /resume and paste ──',
    '    https://www.roastrebuild.com/resume',
    `    Code: ${code}`,
    '',
    SEPARATOR,
    '',
  ];
  process.stderr.write(footer.join('\n'));
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? prefix + line : line))
    .join('\n');
}

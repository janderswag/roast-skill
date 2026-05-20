import { createHash, randomBytes } from 'node:crypto';
import { basename } from 'node:path';

// Crockford base32 — omits I, L, O, U to avoid ambiguity in printed codes.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CLAIM_PREFIX = 'RST-';
const CLAIM_BODY_LEN = 8; // 32^8 ≈ 1.1 × 10^12

export interface ContentHashInput {
  readonly cwd: string;
  readonly gitHead: string | null;
  readonly gitDirty: boolean;
  readonly url: string | undefined;
  readonly skillVersion: string;
}

export function generateClaimCode(): string {
  const bytes = randomBytes(CLAIM_BODY_LEN);
  let out = CLAIM_PREFIX;
  for (let i = 0; i < CLAIM_BODY_LEN; i += 1) {
    out += CROCKFORD[bytes[i]! & 31];
  }
  return out;
}

/**
 * Deterministic content hash used by the server-side upsert. Same project
 * (basename of cwd) + same commit + same skill version + same URL → same
 * hash → server replaces existing pending claim instead of fragmenting.
 *
 * NOTE: we use basename(cwd), not the full path, on purpose. Including the
 * absolute path would leak user directory structure AND would also fragment
 * claims if the same repo lives at /Users/foo vs /home/bar.
 */
export function computeContentHash(input: ContentHashInput): string {
  const parts = [
    basename(input.cwd),
    input.gitHead ?? 'no-git',
    input.gitDirty ? 'dirty' : 'clean',
    input.url ?? 'local-only',
    input.skillVersion,
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

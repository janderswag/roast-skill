import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  FindingStatusSchema,
  RunReportSchema,
  type Finding,
  type FindingStatus,
  type RunReport,
} from './types.js';

/**
 * Directory name for per-repo R&R skill state. Sits next to `.git/`.
 * Convention lifted from Clawpatch's `.clawpatch/` directory — durable
 * work units, audit history, and triage live alongside the repo.
 *
 * Recommended to add to .gitignore (see SKILL.md).
 */
export const ROAST_DIR_NAME = '.roast';
export const LAST_AUDIT_FILE = 'last-audit.json';
export const TRIAGE_FILE = 'triage.json';

/**
 * Schema for `.roast/triage.json`. Keyed by finding signature.
 *
 * Each entry carries:
 *   - `status` — the lifecycle state to re-apply on subsequent runs
 *   - `note` — optional free-text human reason (shown in CLI output)
 *   - `updatedAt` — ISO timestamp; for "this was triaged 6 months ago,
 *     does it still apply?" UX in future versions
 */
const TriageEntrySchema = z
  .object({
    status: FindingStatusSchema,
    note: z.string().optional(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type TriageEntry = z.infer<typeof TriageEntrySchema>;

export const TriageFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    entries: z.record(z.string().min(1), TriageEntrySchema),
  })
  .strict();

export type TriageFile = z.infer<typeof TriageFileSchema>;

/**
 * In-memory representation of triage state: signature → status.
 *
 * Returned from {@link loadTriage}. Lossy compared to {@link TriageFile}
 * (drops the note + updatedAt fields) — we keep it lean for the hot path
 * where we only need to know "what status should I apply to this finding?"
 */
export type TriageMap = ReadonlyMap<string, FindingStatus>;

const EMPTY_TRIAGE: TriageMap = new Map();

/**
 * Returns the absolute path to `.roast/` for the given cwd. Does not
 * create the directory — call {@link ensureRoastDir} for that.
 */
export function getRoastDir(cwd: string): string {
  return join(cwd, ROAST_DIR_NAME);
}

/**
 * Creates `.roast/` if it doesn't exist; idempotent. Returns the
 * absolute path on success. Throws if the directory can't be created
 * (e.g., permissions, disk full).
 */
export async function ensureRoastDir(cwd: string): Promise<string> {
  const dir = getRoastDir(cwd);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Load the previous run's RunReport from `.roast/last-audit.json`.
 * Returns `null` if the file doesn't exist or is malformed — the caller
 * should treat this as "first run" / "no comparison baseline."
 *
 * We never throw on parse errors here: a corrupted state file shouldn't
 * block an otherwise-valid audit run. The next successful run will
 * overwrite the bad data.
 */
export async function loadPreviousRun(cwd: string): Promise<RunReport | null> {
  const path = join(getRoastDir(cwd), LAST_AUDIT_FILE);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const validated = RunReportSchema.safeParse(parsed);
  return validated.success ? validated.data : null;
}

/**
 * Persist the RunReport to `.roast/last-audit.json`. Creates the
 * `.roast/` dir if needed. Atomically replaces any existing file.
 *
 * On failure (e.g., disk full, permissions), throws — the caller decides
 * whether to surface as a hard error or warn-and-continue. CLI policy:
 * warn-and-continue so a non-writable cwd doesn't block emitting the
 * audit report to stdout.
 */
export async function savePreviousRun(cwd: string, report: RunReport): Promise<void> {
  await ensureRoastDir(cwd);
  const path = join(getRoastDir(cwd), LAST_AUDIT_FILE);
  await writeFile(path, JSON.stringify(report, null, 2), 'utf8');
}

/**
 * Load the triage map from `.roast/triage.json`. Returns an empty map if
 * the file doesn't exist or is malformed (same forgiving policy as
 * {@link loadPreviousRun}).
 */
export async function loadTriage(cwd: string): Promise<TriageMap> {
  const path = join(getRoastDir(cwd), TRIAGE_FILE);
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    if (isNotFound(err)) return EMPTY_TRIAGE;
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_TRIAGE;
  }

  const validated = TriageFileSchema.safeParse(parsed);
  if (!validated.success) return EMPTY_TRIAGE;

  const map = new Map<string, FindingStatus>();
  for (const [sig, entry] of Object.entries(validated.data.entries)) {
    map.set(sig, entry.status);
  }
  return map;
}

/**
 * Persist a triage entry (or remove one). Reads the existing file first,
 * mutates the requested key, writes back atomically. Creates the
 * `.roast/` dir if needed.
 *
 * Pass `status = null` to remove an entry (used by `roast triage <sig> clear`).
 *
 * @param note Optional human-readable reason ("not exploitable on our
 *             surface; we don't deserialize untrusted input here").
 */
export async function setTriageEntry(
  cwd: string,
  signature: string,
  status: FindingStatus | null,
  note?: string,
): Promise<void> {
  await ensureRoastDir(cwd);
  const path = join(getRoastDir(cwd), TRIAGE_FILE);

  // Load existing file if present; start fresh if missing/malformed.
  let existing: TriageFile = { schemaVersion: 1, entries: {} };
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = TriageFileSchema.safeParse(JSON.parse(raw));
    if (parsed.success) existing = parsed.data;
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }

  const entries = { ...existing.entries };
  if (status === null) {
    delete entries[signature];
  } else {
    entries[signature] = {
      status,
      ...(note !== undefined ? { note } : {}),
      updatedAt: new Date().toISOString(),
    };
  }

  const next: TriageFile = { schemaVersion: 1, entries };
  await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
}

/**
 * Apply a TriageMap to a list of findings. Returns a new array where
 * each finding's `status` field has been overwritten if its signature
 * appears in the triage map. Findings without signatures (legacy data
 * from v0.6.0) pass through unchanged.
 *
 * This is a pure transformation — no I/O. Combine with {@link loadTriage}
 * to get the apply-triage-after-orchestrator flow.
 */
export function applyTriage(
  findings: readonly Finding[],
  triage: TriageMap,
): readonly Finding[] {
  if (triage.size === 0) return findings;
  return findings.map((f) => {
    if (f.signature === undefined) return f;
    const status = triage.get(f.signature);
    if (status === undefined) return f;
    return { ...f, status };
  });
}

function isNotFound(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

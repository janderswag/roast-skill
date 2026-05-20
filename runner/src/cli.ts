import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, statSync, mkdirSync } from 'node:fs';
import { runOrchestrator, RUNNER_VERSION } from './orchestrator.js';
import { ALL_VERIFIERS } from './registry.js';
import type { Finding, FindingStatus, RunReport, VerifierName, VerifierResult } from './types.js';
import { FindingStatusSchema, VerifierNameSchema } from './types.js';
import { detectGitInfo } from './git.js';
import { buildExportPayload, writeExportPayload } from './export.js';
import { runPreview } from './preview.js';
import { printExportCta } from './cta.js';
import { applyTriage, loadPreviousRun, loadTriage, savePreviousRun, setTriageEntry } from './state.js';
import { computeDelta, formatDeltaLine } from './delta.js';

/**
 * Parsed --triage <sig>=<status> directive. status === null means "clear"
 * (remove the entry from .roast/triage.json).
 */
interface TriageDirective {
  readonly signature: string;
  readonly status: FindingStatus | null;
}

interface CliArgs {
  readonly cwd: string;
  readonly url: string | undefined;
  readonly cacheDir: string;
  readonly timeoutMs: number;
  readonly enabled: ReadonlySet<VerifierName> | undefined;
  readonly exportJson: boolean;
  readonly exportPath: string;
  readonly exportYes: boolean;
  readonly delta: boolean;
  readonly triage: TriageDirective | undefined;
  readonly help: boolean;
  readonly version: boolean;
}

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_CACHE_DIR = join(homedir(), '.claude', 'skills', 'roast', 'runner', '.live-cache');

function parseAndValidateUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`--url is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`--url must use http or https (got ${parsed.protocol})`);
  }
  return parsed.toString();
}

function parseTriageDirective(raw: string): TriageDirective {
  const eqIdx = raw.indexOf('=');
  if (eqIdx === -1) {
    throw new Error(`--triage requires <signature>=<status> (got "${raw}")`);
  }
  const signature = raw.slice(0, eqIdx).trim();
  const statusRaw = raw.slice(eqIdx + 1).trim();
  if (signature.length === 0) {
    throw new Error('--triage signature cannot be empty');
  }
  if (statusRaw === 'clear') {
    return { signature, status: null };
  }
  const parsed = FindingStatusSchema.safeParse(statusRaw);
  if (!parsed.success) {
    throw new Error(
      `--triage status must be one of: ${FindingStatusSchema.options.join(', ')}, clear (got "${statusRaw}")`,
    );
  }
  return { signature, status: parsed.data };
}

function parseArgs(argv: readonly string[]): CliArgs {
  let cwd = process.cwd();
  let url: string | undefined;
  let cacheDir = DEFAULT_CACHE_DIR;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let enabled: Set<VerifierName> | undefined;
  let exportJson = false;
  let exportPath = './roast.json';
  let exportYes = false;
  let delta = false;
  let triage: TriageDirective | undefined;
  let help = false;
  let version = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    switch (arg) {
      case '-h':
      case '--help':
        help = true;
        break;
      case '-v':
      case '--version':
        version = true;
        break;
      case '--cwd': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--cwd requires a value');
        cwd = resolve(next);
        i += 1;
        break;
      }
      case '--url': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--url requires a value');
        url = parseAndValidateUrl(next);
        i += 1;
        break;
      }
      case '--cache-dir': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--cache-dir requires a value');
        cacheDir = resolve(next);
        i += 1;
        break;
      }
      case '--timeout-ms': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--timeout-ms requires a value');
        const parsed = Number.parseInt(next, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error(`--timeout-ms must be a positive integer (got ${next})`);
        }
        timeoutMs = parsed;
        i += 1;
        break;
      }
      case '--export-json': {
        exportJson = true;
        break;
      }
      case '--export-path': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--export-path requires a value');
        exportPath = next;
        exportJson = true; // implies --export-json
        i += 1;
        break;
      }
      case '--export-yes': {
        exportYes = true;
        break;
      }
      case '--verifiers': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--verifiers requires a comma-separated list');
        const names = next.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        const validated = new Set<VerifierName>();
        for (const n of names) {
          const parsed = VerifierNameSchema.safeParse(n);
          if (!parsed.success) {
            throw new Error(`unknown verifier "${n}" — valid: ${VerifierNameSchema.options.join(', ')}`);
          }
          validated.add(parsed.data);
        }
        enabled = validated;
        i += 1;
        break;
      }
      case '--delta': {
        delta = true;
        break;
      }
      case '--triage': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--triage requires <signature>=<status>');
        triage = parseTriageDirective(next);
        i += 1;
        break;
      }
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  return {
    cwd,
    url,
    cacheDir,
    timeoutMs,
    enabled,
    exportJson,
    exportPath,
    exportYes,
    delta,
    triage,
    help,
    version,
  };
}

function printHelp(): void {
  process.stdout.write(`roast-runner ${RUNNER_VERSION}

Usage: roast-runner [options]

Runs deterministic verifiers against the current repository (and optionally
a live URL) and emits a normalized JSON RunReport to stdout. Intended to
be called by the /roast Claude Code skill.

Options:
  --cwd <path>             Working directory to audit (default: process.cwd())
  --url <url>              Live URL to audit (enables live-browser + live-lighthouse
                           verifiers). Passing --url IS the explicit network
                           opt-in: the runner will make outbound HTTPS calls.
  --cache-dir <path>       Where to install playwright-chromium on first --url use
                           (default: ~/.claude/skills/roast/runner/.live-cache)
  --timeout-ms <n>         Global timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --verifiers <list>       Comma-separated subset (default: all)
                           Valid: ${VerifierNameSchema.options.join(', ')}
  --export-json            Write a sanitized roast.json to the cwd for upload to
                           roastrebuild.com (pre-fills the paid \$19 audit).
                           Interactive preview + Continue? prompt before write.
  --export-path <path>     Custom path for the export (implies --export-json;
                           default: ./roast.json)
  --export-yes             Skip the interactive Continue prompt (e.g. for CI).
                           Required when stdin is not a TTY.
  --delta                  Compare this run against .roast/last-audit.json and
                           print a one-line summary (new / persisted / regressed /
                           improved / fixed) to stderr.
  --triage <sig>=<status>  Mark a finding by signature. Status: ${FindingStatusSchema.options.join(', ')}, clear.
                           Persists to .roast/triage.json. Runs without the
                           audit; emits {"triage":"<status>","signature":"..."}.
                           Example: --triage a3f7c9d2e4b18560=wont-fix
  -h, --help               Print this help
  -v, --version            Print version

State directory:
  Every successful run writes .roast/last-audit.json (the baseline for --delta)
  and respects .roast/triage.json (finding signatures → lifecycle status).
  Add .roast/ to .gitignore.

Output: JSON RunReport on stdout (schemaVersion 1). Export file on disk if
--export-json was passed. CTA + preview on stderr.
Exit codes: 0 = ran (regardless of findings); 2 = bad args; 3 = runtime error.
`);
}

export async function main(argv: readonly string[]): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 2;
  }

  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.version) {
    process.stdout.write(`${RUNNER_VERSION}\n`);
    return 0;
  }

  if (!existsSync(args.cwd) || !statSync(args.cwd).isDirectory()) {
    process.stderr.write(`cwd does not exist or is not a directory: ${args.cwd}\n`);
    return 2;
  }

  // --triage is a state-only subcommand: mutate .roast/triage.json and exit.
  // Does NOT run the audit (that would be confusing UX: "I asked to mark a
  // finding, why is the runner downloading playwright-chromium?").
  if (args.triage !== undefined) {
    return await runTriageSubcommand(args.cwd, args.triage);
  }

  try {
    mkdirSync(args.cacheDir, { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`failed to create cache dir ${args.cacheDir}: ${msg}\n`);
    return 2;
  }

  try {
    const rawReport = await runOrchestrator({
      cwd: args.cwd,
      cacheDir: args.cacheDir,
      timeoutMs: args.timeoutMs,
      verifiers: ALL_VERIFIERS,
      ...(args.url !== undefined ? { url: args.url } : {}),
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
    });

    // Apply triage (`.roast/triage.json`) AFTER orchestrator returns. We
    // don't push state I/O into the orchestrator — it stays a pure
    // verifier-runner. The CLI is the boundary that knows about disk state.
    //
    // Triage load is best-effort: a corrupted triage file shouldn't block
    // the audit. loadTriage() returns an empty map and we warn.
    const triage = await loadTriageOrWarn(args.cwd);
    const report = applyTriageToReport(rawReport, triage);

    // --delta: compare against the PREVIOUS run BEFORE we overwrite it.
    // Print a one-line stderr summary; do NOT mutate the stdout report
    // (consumers on schemaVersion 1 expect the existing shape).
    if (args.delta) {
      await emitDeltaLine(args.cwd, report);
    }

    // Persist the run for future --delta comparisons. Best-effort: a
    // non-writable cwd shouldn't block emitting stdout. Most common
    // failure mode: cwd is a read-only mount (e.g., audit-as-root in CI).
    await savePreviousRunOrWarn(args.cwd, report);

    if (args.exportJson) {
      await handleExport(args, report);
    }

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`runtime error: ${msg}\n`);
    return 3;
  }
}

/**
 * Apply triage to every finding across every verifier result, returning
 * a NEW RunReport (the input is not mutated). No-op fast-path when the
 * triage map is empty (most repos on first run).
 */
function applyTriageToReport(
  report: RunReport,
  triage: ReadonlyMap<string, import('./types.js').FindingStatus>,
): RunReport {
  if (triage.size === 0) return report;
  const nextResults: readonly VerifierResult[] = report.results.map((r) => ({
    ...r,
    findings: applyTriage(r.findings as readonly Finding[], triage),
  }));
  return { ...report, results: nextResults };
}

/**
 * loadTriage with a stderr warning on failure (network/disk hiccup).
 * Always returns a usable map — never throws to the caller.
 */
async function loadTriageOrWarn(cwd: string): Promise<ReadonlyMap<string, import('./types.js').FindingStatus>> {
  try {
    return await loadTriage(cwd);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[state] warning: failed to load .roast/triage.json: ${msg}\n`);
    return new Map();
  }
}

/**
 * savePreviousRun with a stderr warning on failure. We don't fail the
 * audit run if state can't be persisted (read-only cwd, disk full, etc).
 */
async function savePreviousRunOrWarn(cwd: string, report: RunReport): Promise<void> {
  try {
    await savePreviousRun(cwd, report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[state] warning: failed to save .roast/last-audit.json: ${msg}\n`);
  }
}

/**
 * Load the previous run, compute the delta against the current report,
 * and write a single-line summary to stderr. No-op (with a note) if
 * there's no prior run to compare against.
 */
async function emitDeltaLine(cwd: string, current: RunReport): Promise<void> {
  let previous: RunReport | null;
  try {
    previous = await loadPreviousRun(cwd);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[delta] warning: failed to load .roast/last-audit.json: ${msg}\n`);
    return;
  }
  if (previous === null) {
    process.stderr.write('[delta] no previous run found at .roast/last-audit.json (first run)\n');
    return;
  }
  const currentFindings = current.results.flatMap((r) => r.findings);
  const previousFindings = previous.results.flatMap((r) => r.findings);
  const delta = computeDelta(currentFindings, previousFindings);
  process.stderr.write(`${formatDeltaLine(delta)}\n`);
}

/**
 * Subcommand handler: mutate .roast/triage.json based on the directive
 * and emit a JSON receipt on stdout. Exits without running the audit.
 *
 * stdout shape:
 *   { "triage": "<status|cleared>", "signature": "<sig>", "path": ".roast/triage.json" }
 *
 * Exits 0 on success, 3 on I/O failure.
 */
async function runTriageSubcommand(cwd: string, directive: TriageDirective): Promise<number> {
  try {
    await setTriageEntry(cwd, directive.signature, directive.status);
    const receipt = {
      triage: directive.status ?? 'cleared',
      signature: directive.signature,
      path: `.roast/triage.json`,
    };
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[triage] failed to update .roast/triage.json: ${msg}\n`);
    return 3;
  }
}

async function handleExport(args: CliArgs, report: Awaited<ReturnType<typeof runOrchestrator>>): Promise<void> {
  const signal = new AbortController().signal;
  const git = await detectGitInfo(args.cwd, signal);

  const payload = buildExportPayload({
    report,
    git,
    url: args.url,
    cwd: args.cwd,
  });

  const outPath = resolve(args.exportPath);
  const preview = await runPreview(payload, { assumeYes: args.exportYes, outPath });

  if (!preview.proceed) {
    process.stderr.write(`[export] cancelled — ${preview.reason}\n`);
    return;
  }

  const { bytesWritten, absolutePath } = await writeExportPayload(payload, outPath);
  printExportCta({ payload, absolutePath, bytesWritten });
}

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
      process.exit(3);
    },
  );
}

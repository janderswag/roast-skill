import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, statSync, mkdirSync } from 'node:fs';
import { runOrchestrator, RUNNER_VERSION } from './orchestrator.js';
import { ALL_VERIFIERS } from './registry.js';
import type { VerifierName } from './types.js';
import { VerifierNameSchema } from './types.js';
import { detectGitInfo } from './git.js';
import { buildExportPayload, writeExportPayload } from './export.js';
import { runPreview } from './preview.js';
import { printExportCta } from './cta.js';

interface CliArgs {
  readonly cwd: string;
  readonly url: string | undefined;
  readonly cacheDir: string;
  readonly timeoutMs: number;
  readonly enabled: ReadonlySet<VerifierName> | undefined;
  readonly exportJson: boolean;
  readonly exportPath: string;
  readonly exportYes: boolean;
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

function parseArgs(argv: readonly string[]): CliArgs {
  let cwd = process.cwd();
  let url: string | undefined;
  let cacheDir = DEFAULT_CACHE_DIR;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let enabled: Set<VerifierName> | undefined;
  let exportJson = false;
  let exportPath = './roast.json';
  let exportYes = false;
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
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  return { cwd, url, cacheDir, timeoutMs, enabled, exportJson, exportPath, exportYes, help, version };
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
  -h, --help               Print this help
  -v, --version            Print version

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

  try {
    mkdirSync(args.cacheDir, { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`failed to create cache dir ${args.cacheDir}: ${msg}\n`);
    return 2;
  }

  try {
    const report = await runOrchestrator({
      cwd: args.cwd,
      cacheDir: args.cacheDir,
      timeoutMs: args.timeoutMs,
      verifiers: ALL_VERIFIERS,
      ...(args.url !== undefined ? { url: args.url } : {}),
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
    });

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

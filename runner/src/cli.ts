import { resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { runOrchestrator, RUNNER_VERSION } from './orchestrator.js';
import { ALL_VERIFIERS } from './registry.js';
import type { VerifierName } from './types.js';
import { VerifierNameSchema } from './types.js';

interface CliArgs {
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly enabled: ReadonlySet<VerifierName> | undefined;
  readonly help: boolean;
  readonly version: boolean;
}

const DEFAULT_TIMEOUT_MS = 120_000;

function parseArgs(argv: readonly string[]): CliArgs {
  let cwd = process.cwd();
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let enabled: Set<VerifierName> | undefined;
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

  return { cwd, timeoutMs, enabled, help, version };
}

function printHelp(): void {
  process.stdout.write(`roast-runner ${RUNNER_VERSION}

Usage: roast-runner [options]

Runs deterministic verifiers against the current repository and emits a
normalized JSON RunReport to stdout. Intended to be called by the /roast
Claude Code skill.

Options:
  --cwd <path>             Working directory to audit (default: process.cwd())
  --timeout-ms <n>         Global timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --verifiers <list>       Comma-separated subset (default: all)
                           Valid: ${VerifierNameSchema.options.join(', ')}
  -h, --help               Print this help
  -v, --version            Print version

Output: JSON RunReport on stdout (schemaVersion 1).
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
    const report = await runOrchestrator({
      cwd: args.cwd,
      timeoutMs: args.timeoutMs,
      verifiers: ALL_VERIFIERS,
      ...(args.enabled !== undefined ? { enabled: args.enabled } : {}),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`runtime error: ${msg}\n`);
    return 3;
  }
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

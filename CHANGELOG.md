# Changelog

All notable changes to the `/roast` Claude Code skill.

## 0.7.0 — 2026-05-20

**Quality Foundation — Sprint 1.** Three structural additions to the
finding shape and one new local-state pattern, designed together so the
skill can answer "what's new since last time?" cleanly.

### Added

- **Finding signature** — every finding now carries a deterministic
  16-hex-character hash (`signature`) computed from verifier + rule +
  file + line range. The signature is stable across runs even if the
  verifier rewords the message or escalates the severity. Used for
  cross-run dedup, triage persistence, and delta computation.
- **Finding status** — new optional lifecycle field with values
  `open` / `fixed` / `wont-fix` / `false-positive` / `uncertain`.
  Hydrated from `.roast/triage.json` on every run. Lets users suppress
  noisy findings without editing source code.
- **Trust boundaries** — every finding now carries a `trustBoundaries[]`
  array tagging which boundary(s) the issue crosses. Eleven tags
  (`user-input`, `network`, `filesystem`, `secrets`, `process-exec`,
  `database`, `auth`, `permissions`, `concurrency`, `external-api`,
  `serialization`) lifted from the OpenClaw/Clawpatch convention.
  Assigned automatically by the orchestrator using verifier-rule-specific
  mappings (CWE/OWASP metadata for semgrep; per-verifier defaults for
  the rest).
- **`.roast/` directory** — local-state convention sitting next to
  `.git/`. Created automatically on every successful run. Holds:
    - `last-audit.json` — full RunReport from the most recent run,
      used as the baseline for `--delta`.
    - `triage.json` — keyed by finding signature; persists user-marked
      statuses across runs. Schema version 1, written atomically.
- **`--delta` flag** — compare this run against `.roast/last-audit.json`
  and print a one-line stderr summary:

  ```
  Δ vs previous run: 3 new · 12 persisted · 2 regressed · 1 improved · 4 fixed
  ```

  Zero-count categories are omitted. Matching is by signature.
- **`--triage <signature>=<status>` flag** — state-only subcommand that
  mutates `.roast/triage.json` without running the audit. Emits a JSON
  receipt on stdout. Use `=clear` to remove an entry.
- **Help text** + recommended `.gitignore` note documenting the new
  state directory.

### Changed

- `runnerVersion` in RunReport bumped to `0.7.0`. Schema version stays
  at `1` — all new fields are optional, so v0.6.0-era consumers (the
  webapp's `/api/audit/from-skill` endpoint, etc.) continue to ingest
  v0.7.0 exports unchanged.
- Orchestrator now runs every verifier finding through `enrichFinding`
  before assembly, populating `signature` and `trustBoundaries`.
  Verifiers themselves stay stateless and unchanged.

### Architecture notes

- All state I/O lives in `cli.ts` (the boundary). The orchestrator
  remains a pure verifier-runner — easier to test, easier to embed.
- State load + save are best-effort: a corrupted `.roast/` file logs
  a warning to stderr and continues with empty state rather than
  blocking the audit.
- 218 unit tests (up from 146 in v0.6.0), zero regressions.

### What this unlocks

- Co-Pilot tier can now run "what's new this week" delta digests
  reliably (foundation for the Sprint 3 Memory tool integration).
- The webapp's $19 audit can suppress findings the user has marked
  as `wont-fix` on the skill side (Phase 3 follow-up).
- Future: the trust-boundary tags become the dimensions for the
  Security module's narrative re-architecture.

---

## 0.6.0 — 2026-05-19

Phase 3 of the v0.4 sprint: `--export-json` for paid-audit pre-fill.
Generates a sanitized `roast.json` with claim code + terminal QR + curl
one-liner. Interactive preview before write; never auto-uploads.

## 0.5.0 — 2026-05-19

Live-URL audit mode (`--url`). Adds axe-core a11y findings, Lighthouse
Core Web Vitals via PSI, screenshots, and security-header probes when
the user passes a live URL.

## 0.4.0 — 2026-05-19

Bundled multi-verifier runner: semgrep + gitleaks + dep-audit, all
local, no network. Normalized JSON shape that the LLM modules consume
regardless of which tools are installed.

## 0.3.0 — earlier

Original public release with inline semgrep + LLM-driven modules.

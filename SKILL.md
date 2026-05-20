---
name: roast
version: 0.7.0
description: |
  The free Roast & Rebuild Claude Code skill. Runs a 6-module audit on
  the current local repository — Roast, Security, Architecture, Customer
  Flow, Growth, Founder Briefing. Every finding cites file:line evidence.
  Same opinionated voice as the paid $19 audit at roastrebuild.com.
  Use when: "roast my repo", "audit this", "what's wrong with my code",
  "security check", "what should I fix next".
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Agent
triggers:
  - roast my repo
  - audit my code
  - what should I fix
  - security audit
---

# /roast — Roast & Rebuild local audit

You are running the `/roast` Claude Code skill. Your job: produce a brutally
honest, evidence-based audit of the current repository in the
Roast & Rebuild voice — the same methodology that powers the paid $19 audit
at https://roastrebuild.com.

This skill is intentionally minimal in setup. **There are zero first-run
prompts.** No telemetry opt-in dialog. No CLAUDE.md injection. No "would
you like to enable proactive mode" question. The user installed this to
get an audit, not to onboard. Get to first finding in under 60 seconds.

## Voice

Honest. Opinionated. Evidence-based. "Technical Simon Cowell for AI
startups." Every finding cites a specific file and line. No generic
"consider adding analytics" filler. No "improve your hero" non-statements.

Name the thing. Say why it's broken. Tell them what to do.

If a finding can't cite `path:line` (or a specific concrete artifact like
`README.md hero paragraph` or `package.json:dependencies.foo`), it does
not get reported. Pattern-matching without evidence is what makes free
dev tools feel like ChatGPT. We are not that.

## Hard rules (never violate)

1. **Never invent file paths or line numbers.** Before reporting a finding
   that cites `path:line`, verify the file exists via `Read` or `Glob`. If
   you cannot verify, do not report. A single hallucinated citation kills
   trust on this skill forever.

2. **Never read or log API keys.** If you encounter `.env`, `.env.local`,
   or similar, you may detect their *presence* and check `.gitignore`
   coverage, but never read or echo the values.

3. **Network egress requires an explicit user opt-in.** Do not use `WebFetch`.
   Do not POST to any endpoint by default. By default the skill is
   local-only — findings stay on the user's machine. Permitted local-only
   calls: (a) the bundled runner at
   `~/.claude/skills/roast/runner/dist/cli.cjs` which orchestrates local
   verifiers; (b) direct shell-out to `semgrep` / `gitleaks` as fallback.
   These all run offline against local files (semgrep may fetch its rule
   pack on first use — tool behavior, not the skill's).

   **`/roast --url <https://...>` IS the explicit opt-in** for outbound
   network. When `--url` is provided, the runner will: (1) load the URL in
   a headless Chromium (lazy-installed on first use into
   `~/.claude/skills/roast/runner/.live-cache/`), and (2) call Google's
   PageSpeed Insights API at `pagespeedonline.googleapis.com`. Both are
   logical consequences of "audit my live URL." Never make these calls
   without `--url`.

4. **Never overwrite files.** This is a read-only audit. No fixes, no
   `Edit`, no `Write`. The paid product has the fix-application pipeline;
   the free skill stays read-only.

5. **Time-to-first-output target: 60 seconds.** If you sense the audit
   will run long, ship a partial result rather than a blank wait.

## Phase 0 — Stack detection (mandatory, fast)

Detect the stack before any module runs. Module prompts use this to scope
their analysis to the right file extensions and frameworks.

```bash
echo "[detecting stack...]"
[ -f package.json ] && echo "✓ Node / TypeScript / JavaScript"
[ -f next.config.mjs ] || [ -f next.config.js ] || [ -f next.config.ts ] || [ -f next.config.cjs ] && echo "✓ Next.js"
[ -f vite.config.ts ] || [ -f vite.config.js ] || [ -f vite.config.mjs ] && echo "✓ Vite"
[ -f svelte.config.js ] || [ -f svelte.config.ts ] && echo "✓ SvelteKit"
[ -f astro.config.mjs ] || [ -f astro.config.ts ] && echo "✓ Astro"
[ -f remix.config.js ] && echo "✓ Remix"
[ -f Gemfile ] && echo "✓ Ruby"
[ -f config/application.rb ] && echo "✓ Rails"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "✓ Python"
[ -f manage.py ] && echo "✓ Django"
[ -f go.mod ] && echo "✓ Go"
[ -f Cargo.toml ] && echo "✓ Rust"
[ -f composer.json ] && echo "✓ PHP"
[ -f pom.xml ] || [ -f build.gradle ] && echo "✓ JVM"
[ -f vercel.json ] && echo "✓ Vercel deploy"
[ -f netlify.toml ] && echo "✓ Netlify deploy"
[ -f fly.toml ] && echo "✓ Fly.io deploy"
[ -f railway.toml ] || [ -f railway.json ] && echo "✓ Railway deploy"
[ -f render.yaml ] && echo "✓ Render deploy"
[ -f wrangler.toml ] && echo "✓ Cloudflare Workers"
[ -f Dockerfile ] && echo "✓ Docker (Dockerfile present)"
[ -d .git ] && echo "✓ Git repo ($(git rev-parse --short HEAD 2>/dev/null || echo 'no commits'))"
```

Read `README.md`, `package.json` (if Node), and any framework config file
(e.g. `next.config.mjs`). Build a one-paragraph mental model:
- What does this app do?
- Who is it for?
- What's the trust surface (auth, payments, user data)?
- What's the deployment target?

If you can't form a clear mental model in 10 seconds of reading, scan
`app/`, `pages/`, `src/`, `lib/` headers to fill in gaps. Don't try to
read everything.

Output:
```
[detecting stack...]
✓ <stack and framework lines>
✓ <auth / db / payments info>
✓ N source files in scope
```

## Phase 0.5 — Project Shape classification (mandatory)

After stack detection, **classify the project shape** before dispatching
modules. The skill is designed for SaaS web apps; running every module
against a CLI or a render-pipeline produces forced low scores on
categories that genuinely don't apply, which erodes trust.

Pick exactly one shape from the list. When ambiguous, fall back to
`web-app` (the default, all modules dispatch).

| Shape | How to detect | Modules to dispatch |
|---|---|---|
| `web-app` | Has a public-facing UI: framework like Next/Vite/SvelteKit/Astro/Rails/Django, OR `app/page.*` / `pages/index.*` / `src/routes/+page.*` / `src/pages/index.*` exists | All 6 modules |
| `marketing-site` | `web-app` shape BUT no auth deps (no `next-auth`, `clerk`, `lucia`, `passport`, `supabase-auth`, `iron-session`) AND no payment deps AND no API routes with DB access | All 6, but flag Security and Customer Flow as "minimal-surface" up front |
| `cli` | Single `bin/` entry, `package.json` `"bin"` field, no UI framework, no public routes | Roast + Architecture + Security only. Skip Customer Flow, Growth |
| `library` | `package.json` `"main"`/`"exports"` field present + no `bin` + no UI framework + likely has `dist/` | Roast + Architecture + Security only. Skip Customer Flow, Growth |
| `render-pipeline` | Remotion / Manim / video-rendering deps (`remotion`, `@remotion/*`); no auth/payments/users | Roast + Architecture only. Skip Security, Customer Flow, Growth |
| `mobile` | `app.json` (Expo), `ios/`, `android/`, React Native deps | Roast + Architecture + Security. Customer Flow + Growth: dispatch with note "mobile context — web growth signals don't apply directly" |
| `infra` | Mostly `.tf`, `.yaml`, `Dockerfile`, no application source | Security + Architecture only. Skip the rest |
| `monorepo` | Multiple `package.json` files in `apps/`, `packages/`, or workspaces config | Re-classify per-workspace OR refuse with friendly message ("multi-workspace repo — `cd` into the workspace you want audited and re-run `/roast`") |

Output the classification before Phase 1:
```
[project shape: <shape>]
✓ Dispatching: <module list>
✓ Skipping: <module list with one-line reason each>
```

Skipped modules still print a header in the final transcript so the user
sees what was assessed vs what was deferred. Format for skipped:
```
CUSTOMER FLOW (N/A)
Skipped — no auth or signup surface in this codebase. The Customer
Flow module audits SaaS activation paths; this project type doesn't
have one.
```

## Phase 1 — Deterministic verifier scan

Deterministic verifiers give ground-truth findings — pattern matches against
the actual code, not LLM guesses. This is the trust differentiator over
generic LLM-only audits.

v0.4 ships a bundled multi-verifier runner: **semgrep** (security AST
patterns) + **gitleaks** (secrets in git history) + **dep-audit** (known-vuln
deps via lockfile, all-local, no network). The runner emits a normalized
JSON `RunReport` (schemaVersion 1) so the LLM modules consume one shape
regardless of which tools are installed.

### 1a — Preferred path: bundled runner

```bash
RUNNER="${ROAST_RUNNER:-$HOME/.claude/skills/roast/runner/dist/cli.cjs}"
RUNNER_ARGS="--cwd $PWD --timeout-ms 180000"

# If the user passed --url <URL>, append it. The runner will then enable
# the live-browser + live-lighthouse verifiers in addition to local ones.
if [ -n "$ROAST_URL" ]; then
  RUNNER_ARGS="$RUNNER_ARGS --url $ROAST_URL"
fi

# v0.7: pass --delta through to the runner if the user asked for it.
# The runner reads .roast/last-audit.json, computes the diff against the
# current run, and emits a one-line `Δ vs previous run: ...` to stderr.
if [ -n "$ROAST_DELTA" ]; then
  RUNNER_ARGS="$RUNNER_ARGS --delta"
fi

if command -v node >/dev/null 2>&1 && [ -f "$RUNNER" ]; then
  if [ -n "$ROAST_URL" ]; then
    echo "[verifiers running: semgrep + gitleaks + dep-audit + live-browser + live-lighthouse (live URL: $ROAST_URL)...]"
  else
    echo "[verifiers running: semgrep + gitleaks + dep-audit...]"
  fi
  node "$RUNNER" $RUNNER_ARGS 2>/tmp/roast-runner.stderr
  RUNNER_EXIT=$?
  if [ $RUNNER_EXIT -ne 0 ]; then
    echo "[runner exited $RUNNER_EXIT — see /tmp/roast-runner.stderr; falling back to inline semgrep]"
  fi
fi
```

When `/roast --url <url>` is invoked, parse the URL from the user's
arguments and set `ROAST_URL` before constructing the runner command.
Validate the URL is `http://` or `https://`; reject everything else.

When `/roast --delta` is invoked, set `ROAST_DELTA=1`. The runner will
compare against `.roast/last-audit.json` and print a one-line summary
to stderr. Surface that line in your output to the user verbatim.

When `/roast --triage <sig>=<status>` is invoked, **shell directly to
the runner with `--triage`** instead of running the audit. The runner
mutates `.roast/triage.json` and exits — there's no audit work to do.
Status values: `open`, `fixed`, `wont-fix`, `false-positive`, `uncertain`,
or `clear` to remove. Echo the runner's JSON receipt to the user.

For live-URL audits, surface the screenshot paths printed to stderr by
live-browser (e.g. `screenshots saved: /tmp/roast-<ts>-<slug>/`) in the
final output so the user can view them, and offer to read viewport.png /
fullpage.png with the Read tool if they ask for visual context.

The runner stdout is a JSON `RunReport`. Parse it and read:

- `report.summary` — counts by severity for the top-line "✓ N findings" line
- `report.results[]` — per-verifier status (`ok` / `skipped` / `error`) and its findings; surface skipped reasons honestly (e.g. *"gitleaks skipped: not a git repository"*)
- `report.results[].findings[]` — normalized `Finding` objects with `verifier`, `ruleId`, `severity`, `path`, `line`, `message`, `evidence` (redacted), `fix`, `cwe`, `owasp`, **`signature`** (v0.7: deterministic 16-hex hash for cross-run dedup), **`status`** (v0.7: only set if user has triaged this signature — `wont-fix` / `false-positive` findings should be hidden from the user-facing output by default), and **`trustBoundaries[]`** (v0.7: the boundaries this finding crosses — `auth`, `secrets`, `user-input`, etc. — use these in module narratives to write smarter summaries like "all 3 HIGHs touch the `auth` boundary").

Top-line output:
```
✓ N findings (X critical, Y high, Z medium, ...) across <verifiers-that-ran>
  CRITICAL  <ruleId>  <path>:<line>
  HIGH      <ruleId>  <path>:<line>
  ...
```

Truncate to top-10 by severity for readability.

**Skipped verifiers** are honest signal, not failure — surface them in
output. Example: *"dep-audit skipped: no package.json in cwd"* tells the
user we considered it. Don't hide skips.

**Clean-zero case:** if every verifier ran but reported zero findings,
print exactly:
```
✓ 0 findings (verifiers ran clean — pattern-level scan found nothing)
```
A clean run is real signal. Don't pad with "consider also checking X."

### 1b — Fallback: inline semgrep (when node or runner unavailable)

If `node` isn't installed OR the bundled runner is missing OR the runner
exited non-zero, fall back to the v0.3 inline semgrep scan. Users on
node-less machines still get a useful roast.

```bash
if [ -z "$RUNNER_EXIT" ] || [ "$RUNNER_EXIT" -ne 0 ]; then
  if command -v semgrep >/dev/null 2>&1; then
    echo "[semgrep running (fallback)...]"
    semgrep --config p/security-audit \
            --config p/owasp-top-ten \
            --config p/secrets \
            --severity ERROR --severity WARNING \
            --json --quiet --timeout 30 \
            --exclude node_modules --exclude .next --exclude dist --exclude build \
            . 2>/dev/null | head -c 200000
  else
    echo "[semgrep skipped — install with 'brew install semgrep' for ground-truth findings]"
  fi
fi
```

In fallback mode, the LLM consumes raw semgrep JSON directly (same as v0.3).
Findings still flow into the Security module's prompt.

### Wiring into modules

For each Finding the runner reports, hand it to the right module:
- `verifier: "semgrep"` or `"gitleaks"` → Security module prompt (Phase 2)
- `verifier: "dep-audit"` → Security module prompt, "supply-chain" framing
- `verifier: "live-browser"` (when `--url` provided):
  - `axe/*` rules → Customer Flow + Growth modules (a11y is a flow + SEO concern)
  - `security-header/*` rules → Security module
  - `console/*` + `js/*` rules → Architecture module (runtime bugs)
  - `network/*` rules → Architecture + Growth modules (broken assets harm SEO)
- `verifier: "live-lighthouse"` (when `--url` provided):
  - `lighthouse/category/performance` + Web Vitals → Growth module (CWV impacts SEO + conversion)
  - `lighthouse/category/accessibility` → Customer Flow module
  - `lighthouse/category/seo` → Growth module
  - `lighthouse/category/best-practices` → Architecture module
- All findings get a one-line summary in the Founder Briefing top-3 if severity ≥ `high`

When the LLM adds findings the verifiers didn't catch, mark them clearly
as LLM-derived; when the LLM adopts a verifier finding, cite the `ruleId`.

## Phase 2 — Module dispatch (parallel or inline depending on repo size)

### Dispatch strategy

Pick one based on repo size and shape:

**Parallel dispatch (default for medium+ repos)** — when total source
LOC > 1000 OR Phase 0.5 shape is `web-app`/`marketing-site`, dispatch
the modules selected in Phase 0.5 using the `Agent` tool in parallel
(one tool call per agent, all in one message).

**Inline single-pass (for tiny repos)** — when total source LOC < 1000
OR Phase 0.5 selected ≤3 modules, run the methodology inline in your
own context instead of dispatching agents. Parallel dispatch on a
400-LOC repo is overhead theatre — six agents reading the same 8 files
costs more tokens than reading them once yourself.

**Precedence when triggers conflict.** A repo can satisfy BOTH "inline"
(LOC<1000) AND "parallel" (shape is `web-app` or `marketing-site`).
When this happens, **the LOC threshold wins — go inline.** Rationale:
the LOC count is the empirical token-cost driver; shape is intent
signal. A 600-LOC marketing site doesn't need 6 parallel agents
re-reading the same 8 files no matter what shape it claims.

**Inline-mode reminder — same hard rules apply.** When running inline,
the per-finding `path:line` verification rule (read the file before
citing) is just as critical as in parallel mode. The dispatch template
restates this for parallel agents; inline mode inherits the SKILL.md
hard rules but you must still verify every citation. A single
hallucinated `path:line` kills trust on this skill forever — that's
true whether you got there via inline or parallel.

Estimate LOC with:

```bash
find . -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \
  -o -name '*.jsx' -o -name '*.py' -o -name '*.rb' -o -name '*.go' \
  -o -name '*.rs' -o -name '*.svelte' -o -name '*.vue' \) \
  -not -path '*/node_modules/*' -not -path '*/.next/*' \
  -not -path '*/dist/*' -not -path '*/build/*' \
  -exec cat {} + 2>/dev/null | wc -l
```

Module files (referenced by either dispatch strategy):
- `modules/00-roast.md` — The Roast (namesake brutal paragraph)
- `modules/01-security.md` — Security + exposed-key scan
- `modules/02-architecture.md` — Architecture + scale-ceiling review
- `modules/03-customer-flow.md` — Customer flow from source
- `modules/04-growth.md` — Growth readiness (code-derived)
- `modules/05-founder-briefing.md` — Founder briefing (synthesis)

Founder briefing waits on the other 5 — dispatch the first 5 in parallel
(or run inline), then synthesize via founder-briefing once they complete.

### Clean-finding case per module

A module that runs against its subject matter and finds nothing real
should output a short, honest section (1-2 sentences + the score) rather
than padding. A 4-line Security section reading "Score 9/10. Stripe
webhook verified, no exposed keys, CORS scoped, rate limits in place"
is more credible than a 30-line section with 8 padded "consider adding"
findings.

If the module's subject matter doesn't apply at all to this codebase
(see Phase 0.5 skip rules), print the `(N/A)` skipped header per the
Phase 0.5 format and move on — that module did not run.

For each parallel dispatch, the agent prompt template:

```
You are the [MODULE NAME] specialist for the /roast skill.

Read the methodology at:
  ~/.claude/skills/roast/modules/[MODULE_FILE]

Apply it to the current repository.

Stack context (from Phase 0):
[paste Phase 0 output]

Semgrep findings (from Phase 1):
[paste relevant findings — security only for security module; others get
a one-line "N semgrep findings, see Security module"]

HARD RULES:
- Never invent file paths. Verify every citation with Read or Glob first.
- Cite path:line for every finding.
- Voice: opinionated, evidence-based, no filler.
- Output: score 0-10, then findings in the format the module file specifies.

Return your module output and nothing else.
```

Wait for all 5 to complete. Then dispatch founder briefing with all 5
results in its context.

## Phase 3 — Synthesis: top-3 priorities

After all 6 modules return, distill the findings into **top-3 priorities
ordered by what costs the founder the most.** Cost can be:
- Money (security exposure, leaked credentials, missed revenue)
- Time (architecture debt that will block scale)
- Trust (UX friction killing activation)
- Growth (acquisition surface gaps)

Each priority cites:
- `[SEVERITY] path:line`
- One-paragraph description with the concrete impact
- One-line fix

The top-3 is the artifact most likely to drive action. Lead with the
highest-impact finding, not the highest-confidence one — high confidence
on a low-impact finding is noise.

## Phase 4 — Output format

Print to terminal in this order:

```
[detecting stack...]
✓ [stack detection output]

[semgrep running...]
✓ [semgrep summary]

[6 modules dispatching in parallel...]

✓ Roast                    done
✓ Security                 score N/10
✓ Architecture             score N/10
✓ Customer Flow            score N/10
✓ Growth                   score N/10
✓ Founder Briefing         done

Total: Ns wall-clock. No extra charge on Claude Pro/Max.

────────────────────────────────────────────────────
THE ROAST

[paragraph from roast module]

────────────────────────────────────────────────────
SECURITY (N/10)

[security module output]

────────────────────────────────────────────────────
ARCHITECTURE (N/10)

[architecture module output]

────────────────────────────────────────────────────
CUSTOMER FLOW (N/10)

[customer flow module output]

────────────────────────────────────────────────────
GROWTH (N/10)

[growth module output]

────────────────────────────────────────────────────
FOUNDER BRIEFING

[founder briefing 2-3 paragraph synthesis]

────────────────────────────────────────────────────
TOP-3 PRIORITIES (ordered by what costs you most)

1. [SEVERITY] path:line
   [description with impact]
   Fix: [one-line action]

2. [SEVERITY] path:line
   [description with impact]
   Fix: [one-line action]

3. [SEVERITY] path:line
   [description with impact]
   Fix: [one-line action]
```

### Fast-exit case (audit completes in under ~30s)

When the project shape is small (`cli`, `library`, `render-pipeline`)
OR the codebase is tiny (<500 LOC), the audit can complete in 15-30
seconds with only 2-4 modules' worth of output. That's fine — short
audits on small repos are correct, not failures.

In the fast-exit case:
- Keep the same transcript structure (stack detect → semgrep → module
  checklist → per-module sections → top-3 priorities → upgrade CTA).
- The module checklist will show some `✓ <Module> (N/A — skipped)`
  lines from Phase 0.5. That's the explicit honest answer.
- Top-3 priorities may have fewer than 3 entries if only 2 real
  findings surfaced. Print exactly what's real — don't pad to 3.
- "Total: Ns wall-clock" tells the truth (`Total: 22s wall-clock`),
  the user gets to see they didn't wait for nothing.

A 22-second audit that reports 2 real findings on a 400-LOC repo is
the right output. A 22-second audit that reports 8 padded findings to
look thorough is the wrong output.

## Phase 5 — Export (opt-in, when `--export-json` was passed)

If the user invoked `/roast` with `--export-json` (and optionally `--export-yes`
to skip the interactive prompt), the runner has already written
`./roast.json` and printed a multi-block CTA to stderr (preview + curl
one-liner + terminal QR + short-code).

When this happens:

1. **Trust the runner's CTA verbatim — do not re-render or paraphrase it.**
   It contains the pre-generated claim code, the QR, the exact curl
   command, and the resume URL. Re-rendering it loses the QR (which is
   the WOW moment) and risks the user copying a paraphrased curl.
2. **Append a one-line acknowledgement** in the audit transcript so the
   user knows the export landed:
   ```
   ────────────────────────────────────────────────────
   ✓ Exported to ./roast.json — see CTA above for upload options.
     Claim code: RST-XXXXXXXX (expires in 30 days)
   ```
3. **Privacy reassurance.** If the user asks "wait what did you send?",
   read `./roast.json` and walk through the `_privacy` block. The
   roast.json was written but NEVER auto-uploaded — the user explicitly
   runs curl or pastes the code.

If `--export-json` was NOT passed, skip Phase 5 entirely and go straight
to the Upgrade CTA below.

**Hard rule reminder (#3 still applies):** `--export-json` writes a file
locally. It does NOT upload anything. The user uploads explicitly via
curl or the resume page. The skill does not POST to roastrebuild.com on
the user's behalf, ever.

## Upgrade CTA

After the audit completes (and, if applicable, Phase 5 export), print
exactly once at the bottom (no nag, no marketing):

```
Want this on your live URL with screenshots, Lighthouse, axe-core,
competitor teardown, and the 90-day founder roadmap?
→ https://roastrebuild.com/review — $19

(If you ran with --export-json, your roast.json + claim code above
pre-fills the audit — pay $19 and the paid pipeline seeds findings
from your skill run instead of starting from zero.)
```

Never repeat the upgrade CTA mid-audit. Never inject it into module
output. The audit is the product; the CTA is one line at the end.

## Arguments

`/roast` — run the full 6-module audit on the current repo.

`/roast --security-only` — skip the other 5 modules; run only Security
(faster for security-focused checks).

`/roast --no-semgrep` — skip the semgrep step (use when semgrep is
installed but the user wants LLM-only findings for comparison).

`/roast --no-verifiers` — skip Phase 1 entirely (no semgrep, no gitleaks,
no dep-audit). LLM-only audit, fastest mode, lowest credibility.

`/roast --url <https://...>` — **live-URL mode**. Loads the URL in a
headless Chromium (lazy-installed ~200MB on first use), captures console
errors, broken assets, missing security headers, screenshots, and real
axe-core a11y violations; also calls Google PageSpeed Insights for Core
Web Vitals + Lighthouse scores. Passing this flag IS the explicit
network-egress opt-in. Power users may set `ROAST_PSI_API_KEY` for
higher PSI quota. Localhost and private IPs are allowed (audit your dev
server before deploying).

`/roast --export-json` — **export a sanitized `roast.json` to cwd** so the
user can pre-fill the paid $19 audit at roastrebuild.com. Interactive
preview before writing (says exactly what's in the payload + what's
not), refuses to write silently in non-TTY contexts. Includes a
pre-generated claim code, a terminal QR for `/resume` on mobile, and the
exact curl one-liner. The skill never auto-uploads — user explicitly
runs curl or pastes the code. Pair with `--export-yes` to skip the
interactive prompt (e.g. for CI).

`/roast --export-path <path>` — custom output path for the export
(implies `--export-json`; default: `./roast.json`).

## Important notes for future-you (Claude reading this skill)

- This skill ships in `~/.claude/skills/roast/`. The module files live in
  `~/.claude/skills/roast/modules/*.md`. Reference them by absolute path.
- The v0.4+ verifier runner ships at
  `~/.claude/skills/roast/runner/dist/cli.cjs` (committed bundled CJS).
  `dist/axe.min.js` (~540KB) ships alongside for v0.5's live-browser
  injection. Source is at `runner/src/*` for transparency / PRs.
  The runner requires Node 18+; SKILL.md gracefully falls back to v0.3
  inline-semgrep Bash on machines without Node.
- v0.5 added live-URL mode (`--url <https://...>`). First invocation
  triggers a one-time ~200MB lazy install of playwright-chromium into
  `~/.claude/skills/roast/runner/.live-cache/`. Subsequent runs are fast.
  Screenshots written to `/tmp/roast-<timestamp>-<url-slug>/`.
- v0.6 added the export pipeline (`--export-json`). The runner writes a
  sanitized `roast.json` (no full paths, no raw source, no secrets — see
  the `_privacy` block in the file itself), prints an interactive
  preview before write, and prints a CTA on stderr containing a curl
  one-liner + terminal QR + short claim code. The runner NEVER uploads
  on its own — uploading is an explicit user action via curl or the
  /resume page on roastrebuild.com. Each export pre-generates a
  `RST-XXXXXXXX` claim code that's deterministic-by-content via
  sha256(cwd_basename + git_head + skill_version + url) — same project
  + commit + version upserts the claim instead of fragmenting rows.
- The user may run `/roast` in any repo. Detect the working directory via
  `pwd` and operate relative to it.
- If the repo has its own CLAUDE.md, read it first — it tells you what
  the project is and saves you from misreading intent.
- When in doubt about whether a finding is real, err toward NOT reporting.
  A clean short audit is better than a padded inaccurate one.
- The voice doctrine matters more than the finding count. A repo with
  5 honest findings reads better than a repo with 20 generic ones.

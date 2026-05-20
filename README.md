# /roast — the free Claude Code skill from Roast & Rebuild

> Audit your repo in 60 seconds without leaving Claude Code.
> Same methodology as the $19 Roast & Rebuild audit. Local-only.
> MIT licensed. Runs under your existing Claude subscription.

## What it is

A Claude Code skill that runs the Roast & Rebuild audit methodology
against your local repository — six modules, real findings, every
finding cited to `file:line`. Built for founders shipping fast on
AI-built apps (Lovable, Bolt, v0, Cursor, Claude Code, Replit) who
want the same kind of feedback they'd get from a senior engineer
who actually read the code.

## Install (30 seconds)

```bash
git clone --depth 1 \
  https://github.com/janderswag/roast-skill \
  ~/.claude/skills/roast
```

Then in any repo, in Claude Code:

```
/roast
```

That's it. No signup, no API key, no telemetry by default.

**Optional but recommended** — install the deterministic verifiers so
findings are pattern-matched against your code, not just LLM-inferred:

```bash
brew install semgrep gitleaks   # macOS
# or: pipx install semgrep && go install github.com/zricethezav/gitleaks/v8@latest
```

The bundled multi-verifier runner ships pre-built in `runner/dist/cli.cjs`
and only requires Node 18+ (no `npm install` needed on your side). On
machines without Node, the skill transparently falls back to v0.3's
inline semgrep behavior.

## What you get

Six modules run in parallel, each scored 1–10 with cited evidence:

1. **The Roast** — Brutally honest paragraph in the Technical Simon
   Cowell voice, built for the Twitter screenshot.
2. **Security + exposed-key scan** — Three deterministic verifiers feed
   the security module:
   - **semgrep** — AST pattern matches for OWASP / framework-specific
     anti-patterns
   - **gitleaks** — secrets in git history (catches what semgrep misses
     by scanning past commits)
   - **dep-audit** — known-vuln deps via your lockfile, plus misplaced
     build tools, plus missing-lockfile detection (Node only in v0.4)
   Plus LLM analysis for issues no verifier can model.
3. **Architecture + scale-ceiling review** — Bottlenecks, where the
   platform breaks at higher load, migration paths.
4. **Customer flow from source** — Signup, checkout, onboarding paths.
   Friction the LLM can see in the code.
5. **Growth readiness (code-derived)** — Sitemap, structured data,
   analytics wiring, share metadata.
6. **Founder briefing (top-3 priorities)** — Synthesizes all 5 modules
   into the three things to fix this week.

## Live-URL mode (v0.5)

```bash
/roast --url https://your-deploy.com
```

Adds a real headless-Chromium audit of your production deploy:

- **Console errors + uncaught exceptions** — what's actually breaking in
  the user's browser, not what should-be-broken in your code
- **Broken assets / failed requests** — 4xx/5xx from your CDN, scripts
  that 404, images that never load
- **Missing security headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy on your main document
- **Real axe-core a11y violations** — runs against the actual rendered
  DOM, not source-code guesses
- **Lighthouse Core Web Vitals + scores** — LCP, CLS, TBT, FCP via
  PageSpeed Insights (Google's API)
- **Screenshots** — viewport.png + fullpage.png saved to /tmp/

**First run** lazy-installs `playwright-chromium` (~200MB, one-time) to
`~/.claude/skills/roast/runner/.live-cache/`. Subsequent runs are fast.

**Network egress** for `--url` mode goes to Google's PageSpeed API and to
the URL you specified. That's it. Without `--url`, the skill is still
local-only.

**Power users:** set `ROAST_PSI_API_KEY` for higher PSI quota (the
anonymous shared quota can hit 429 during peak hours).

## Export to the paid audit (v0.6)

```bash
/roast --url https://your-deploy.com --export-json
```

Writes a sanitized `roast.json` to your cwd that pre-fills the $19 paid
audit at roastrebuild.com. The skill prints:

- An interactive preview of EXACTLY what's in the payload before writing
  (finding counts, redaction counts, "what we'd send / what we'd NOT
  send" — pass `--export-yes` to skip the prompt in CI)
- A pre-generated claim code (`RST-XXXXXXXX`)
- Three upload paths: one-liner `curl`, a terminal QR for mobile, or
  manual paste at `/resume`

**The skill never uploads on its own.** `roast.json` is written locally;
you explicitly run `curl` or visit `/resume`. When you pay $19, the
paid pipeline seeds findings from your skill run and re-validates each
one server-side (filters out anything that can't be independently
confirmed — direct response to the LLM-hallucination risk that no
other free→paid handoff handles).

What gets sent in `roast.json`:
- Finding rule IDs + severities + one-line messages
- File basenames + line numbers (NOT full paths)
- Redacted evidence snippets (max 500 chars, secrets replaced)
- Project basename + git short-SHA + branch (NOT full cwd)

What does NOT get sent:
- Full filesystem paths
- Raw source code beyond 500-char snippets
- Environment variables, secrets, or credentials
- Screenshots (stay local in `/tmp/`)

## What it doesn't do (this is the free skill)

The full paid audit at https://roastrebuild.com/review adds the things
that still genuinely benefit from server-side processing:

- ❌ Competitor teardown (needs web search + competitor fetch)
- ❌ 90-day founder roadmap (paid-tier synthesis)
- ❌ SSRF-hardened crawl across multiple pages
- ❌ Persistent audit history + delta tracking between runs

If you want any of those, that's the $19 audit.

## How we protect you

- **Open source, MIT licensed** — every line of methodology is in
  `SKILL.md` and `modules/*.md`. Read it before you install.
- **Never sees your API key** — runs inside your existing Claude Code
  session and uses that auth. The skill never reads, stores, or
  transmits your Anthropic key.
- **Zero outbound network calls by default** — without `--url`, the
  audit happens entirely on your machine. No POSTs to roastrebuild.com.
  The bundled runner is local-only; the only background network call
  in default mode is `semgrep` fetching its rule pack on first use
  (tool behavior, not the skill's — findings never leave your machine).
- **`--url` is the explicit opt-in for network egress.** Passing
  `--url <https://...>` IS the consent: the runner then loads the URL
  in headless Chromium and calls Google's PageSpeed Insights API. Both
  are logical consequences of "audit my live URL." We never make these
  calls without `--url`.
- **Telemetry** is off by default; if we add it later, it'll be opt-in
  and named in install copy.
- **Findings stay on your disk** — your code, your repo names, your
  findings — they don't leave your environment.

## Cost

No extra charge on Claude Pro / Claude Max — the skill runs under your
existing Claude Code subscription. On pay-as-you-go API auth you'll
see a typical audit cost around the same as any 1-2 minute Claude
session (~$0.20-0.50 of token usage depending on repo size).

## Voice

Honest, opinionated, evidence-based. Every finding cites a specific
file and line. No "improve your hero" filler. No "consider adding
analytics" generic advice. The audit names the thing, says why it's
broken, and tells you what to do.

## Upgrade paths

- **$19 one-time** — Full audit with URL fetch, screenshots,
  Lighthouse, axe, competitor teardown, 90-day roadmap.
- **$49/month** — Founder Co-Pilot. Bi-weekly auto-audit, email
  delta digest, regression alerts.
- **$199 one-time** — Founder Briefing. Jake personally walks you
  through your top-3 priorities via async Loom. 48-hour turnaround.

All three: https://roastrebuild.com/#pricing

## Contributing

Issues and PRs welcome at https://github.com/janderswag/roast-skill.
The methodology is the moat — improvements to module prompts, voice
calibration, false-positive rules, and stack-coverage are exactly the
contributions worth making.

## License

MIT. See [LICENSE](./LICENSE).

---

Built by [Jake Anderson](https://x.com/janderswag) at
[Roast & Rebuild](https://roastrebuild.com).

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

## What it doesn't do (this is the free skill)

The full paid audit at https://roastrebuild.com/review adds the things
that genuinely can't run inside a Claude Code session:

- ❌ Fetch + render your live URL (needs the SSRF-hardened crawler)
- ❌ Screenshot-driven design audit (needs headless Chromium)
- ❌ Lighthouse Core Web Vitals (needs PSI API + deployed URL)
- ❌ Real axe-core a11y findings (runs against rendered HTML)
- ❌ Competitor teardown (needs web search + competitor fetch)
- ❌ 90-day founder roadmap (paid-tier synthesis)

If you want any of those, that's the $19 audit.

## How we protect you

- **Open source, MIT licensed** — every line of methodology is in
  `SKILL.md` and `modules/*.md`. Read it before you install.
- **Never sees your API key** — runs inside your existing Claude Code
  session and uses that auth. The skill never reads, stores, or
  transmits your Anthropic key.
- **Zero outbound network calls from the skill** — the audit happens
  entirely on your machine. No POSTs to roastrebuild.com. The bundled
  runner is local-only; the only network calls in the pipeline come
  from `semgrep` itself fetching its rule pack on first use (which is
  the tool's behavior, not the skill's — findings never leave your
  machine). Telemetry is off by default; if we add it later, it'll be
  opt-in and named in install copy.
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

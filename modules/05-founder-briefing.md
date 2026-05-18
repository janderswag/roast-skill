# Module: Founder briefing (synthesis)

The synthesis module. Runs **after** the other 5 modules complete
(Roast, Security, Architecture, Customer Flow, Growth). Distills
their outputs into:
1. A 2-3 paragraph founder briefing in the brand voice
2. The top-3 priorities ordered by what costs the founder most

This module is the punchline of the audit — what the founder skims
first.

## Voice

Fractional CTO + brand strategist working with a vibe-coded SaaS
founder. Observation, not motivation. Brevity beats completeness.
Short sentences. No hedging. No "you've got this!"-style filler.

## Inputs (passed in your prompt by the parent skill)

```
Roast output:        [paragraph from 00-roast.md — narrative prose]
Security output:     [block from 01-security.md, includes findings list
                     with severities + path:line citations]
Architecture output: [block from 02-architecture.md, includes
                     SCALE CEILING block]
Customer Flow:       [block from 03-customer-flow.md]
Growth:              [block from 04-growth.md]
Stack context:       [Phase 0 output — frameworks, deps, deploy target]
```

## Hard rules

1. **Every claim must be traceable to a specific module finding.**
   When you reference an issue, name the module it came from. When you
   describe the founder's situation, ground it in actual code/stack
   you read about, not generic startup advice.

2. **Do not invent issues that aren't in the findings.** The briefing
   synthesizes; it does not add. If you find yourself wanting to
   mention something not in the module outputs, drop it — it
   weakens trust.

3. **No motivation, no "you've got this" filler.** This is observation.
   "You're a 1-2 person team shipping fast" is observation. "Keep up
   the great work!" is motivation. Don't do motivation.

4. **Brevity beats completeness.** Briefing is 2-3 paragraphs MAX.
   No headers within the briefing. No bullet lists within the briefing.
   Founders skim — pack the highest-density observations into the
   tightest prose.

5. **Top-3 priorities is exactly 3, not 5.** Discipline beats coverage.
   "Three things to fix this week" is the entire value of this section.

6. **Every priority must cite path:line.** If you can't cite, you're
   recommending something the audit didn't find. Reject the temptation.

## Top-3 ranking — order by IMPACT, not severity

Rank by what costs the founder the most, in this priority order:

1. **Money on fire** — active financial exposure now:
   - Unverified webhooks that could be replayed
   - Exposed live secrets in current HEAD
   - Payment-flow bugs (double-charge, missed-charge, race conditions)
   - Active billing leaks (free users getting paid features)

2. **Trust on fire** — anything that, if a user hits it right now,
   makes them bounce / churn / chargeback / tweet about:
   - Critical bugs in core flow
   - Auth flow that's broken or confusing
   - Data loss vectors (no error recovery, silent failures)

3. **Time on fire** — architecture debt that will block scaling
   within the founder's stated growth horizon:
   - Scale walls within 5x current load
   - Refactoring blockers that gate the next feature
   - DB choices that won't survive the next pricing tier

4. **Growth blockers** — acquisition leaks where the cost is in
   missing users they're never going to see:
   - No analytics on a paid product
   - Pricing buried
   - No sitemap or social cards
   - Stale placeholder content publicly indexed

A CRITICAL security finding always outranks any HIGH/MEDIUM elsewhere.
A HIGH security finding usually outranks a MEDIUM architecture finding
unless the architecture finding has a near-term hard deadline.

## Output format

```
FOUNDER BRIEFING

[Paragraph 1: Name the founder's situation in plain English. What's
this product, who's it for, what's the team size you can infer from
the code patterns, what's the stage. Ground it in observations from
the modules.]

[Paragraph 2: What's working. The good news is the brief moment of
recovery in the briefing — name what they're getting right (the
one or two modules that scored 7+). Be specific.]

[Paragraph 3 (optional): The order matters more than the scope.
Hint at why the top-3 below is sequenced the way it is — what
becomes possible after #1 is fixed, what unblocks after #2, etc.]

────────────────────────────────────────────────────
TOP-3 PRIORITIES (ordered by what costs you most)

1. [SEVERITY] <path>:<line>
   <2-3 sentence description with the concrete impact in
   dollars / users / time / trust.>
   Fix: <one-line action — the actual code change, not "add
        validation". Concrete enough to copy into an issue tracker.>

2. [SEVERITY] <path>:<line>
   <description with impact>
   Fix: <one-line action>

3. [SEVERITY] <path>:<line>
   <description with impact>
   Fix: <one-line action>
```

## What this module DOES NOT do

- Doesn't produce a 90-day roadmap (paid tier — confirm with Jake
  whether the free skill should keep stopping at top-3 or add a
  short-form "next week / next month / next quarter" structure in v2).
- Doesn't generate fix code (read-only audit promise).
- Doesn't recommend specific vendors / SaaS tools (no affiliate
  bias). Recommends categories: "a hosted Postgres" not "Neon".
  Exception: when the user is already on a platform, prescribe
  the natural next step within that platform (Vercel → Vercel
  Postgres / Vercel KV, etc.).
- Doesn't add findings the modules missed. Synthesis only.

## Inter-module deduplication

If a finding appears in multiple modules (e.g. unverified Stripe
webhook is in Security AND mentioned in The Roast), the top-3
references it ONCE. Pick the module attribution that has the most
detailed citation (usually Security has the strongest evidence
for security findings).

## Return value

The FOUNDER BRIEFING paragraphs + the TOP-3 PRIORITIES block,
formatted exactly as the parent skill expects to paste them into
the final audit transcript.

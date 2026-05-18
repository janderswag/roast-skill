# Module: Founder briefing (synthesis)

> **Status:** scaffold — methodology TODO. The placeholder below sets
> scope, output format, and scoring so the parent skill can dispatch
> this module today. Full methodology to be ported from
> R&R's `lib/review/prompts/founderPrompt.ts`.

The synthesis module. Runs **after** the other 5 modules complete
(Roast, Security, Architecture, Customer Flow, Growth). Distills
their outputs into the founder briefing + the top-3 priorities.

## What this module does (sketch)

- Reads all 5 module outputs.
- Identifies the highest-cost finding from each module (cost can be
  money, time, trust, growth — see SKILL.md Phase 3).
- Writes a 2-3 paragraph briefing in the Technical Simon Cowell
  voice that names the founder's likely situation, validates what
  they're getting right, and orders what to fix.
- Generates the **top-3 priorities** — the three findings that, if
  fixed this week, move the most needles.

## Inputs (passed in your prompt by the parent skill)

```
Roast output:        [paragraph from 00-roast.md]
Security output:     [block from 01-security.md, includes findings list]
Architecture output: [block from 02-architecture.md]
Customer Flow:       [block from 03-customer-flow.md]
Growth:              [block from 04-growth.md]
Stack context:       [from Phase 0]
```

## Top-3 ranking criteria (in this order)

1. **Money on fire** — active financial exposure (unverified webhooks,
   exposed live secrets in current HEAD, payment-flow bugs).
2. **Trust on fire** — anything that, if a user hits it, makes them
   bounce / churn / chargeback / tweet about.
3. **Time on fire** — architecture debt that will block scaling within
   the founder's stated growth horizon.
4. **Growth blockers** — acquisition leaks where the cost is in
   missing users they're never going to see anyway.

A CRITICAL security finding always outranks any HIGH/MEDIUM elsewhere.
A HIGH security finding usually outranks a MEDIUM architecture finding
unless the architecture one has a near-term hard deadline.

## Output format (target)

The briefing paragraph + the top-3 list. The parent skill renders
them in separate output sections (FOUNDER BRIEFING + TOP-3 PRIORITIES).

```
[FOUNDER_BRIEFING]
[2-3 paragraphs naming the founder's situation, what's working,
ordering what to fix. Voice: Technical Simon Cowell. No bullets.]

[TOP_3]
1. [SEVERITY] <path>:<line>
   [Description with concrete impact in dollars/users/time]
   Fix: [one-line action — actual code change, not "add validation"]

2. [SEVERITY] <path>:<line>
   [Description with concrete impact]
   Fix: [one-line action]

3. [SEVERITY] <path>:<line>
   [Description with concrete impact]
   Fix: [one-line action]
```

## Hard rules

1. **Pick 3, not 5.** "Three things to fix this week" is the entire
   value of this module. Discipline beats coverage.
2. **Order by impact, not severity.** A HIGH that costs $200/yr in
   exposure ranks below a MEDIUM that costs 20% activation. Severity
   is one input; impact is the output.
3. **Every priority must cite path:line.** If you can't cite, it
   means you're recommending something the audit didn't actually find.
   Reject the temptation.
4. **The briefing is observation, not motivation.** "You're a 1-2
   person team shipping fast" is observation. "You've got this!"
   is motivation. We don't do motivation.

## TODO for v0.2

- Port full methodology from `lib/review/prompts/founderPrompt.ts`
- Add the 90-day roadmap synthesis (kept paid-tier for now per
  the /skill page's "what it doesn't do" promise — confirm with
  Jake whether the free skill should keep stopping at top-3)
- Add inter-module deduplication (if Roast paragraph already named
  the Stripe webhook issue, the top-3 mentions it once not twice)

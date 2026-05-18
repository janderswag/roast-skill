# Module: Customer flow from source

> **Status:** scaffold — methodology TODO. The placeholder below sets
> scope, output format, and scoring so the parent skill can dispatch
> this module today. Full methodology to be ported from
> R&R's `lib/review/prompts/customerFlowPrompt.ts`.

Traces signup, checkout, onboarding paths through the actual routes
and components. Surfaces friction the LLM can see in source.

## What this module does (sketch)

- Maps the signup route(s) — `/signup`, `/register`, `/auth/login`,
  magic-link flow.
- Counts clicks from landing → activated. A "click" = a meaningful
  user action (form submit, button press, page nav).
- Reads onboarding components for friction signals: long forms,
  too many dropdown options, required fields that should be optional,
  email verification gates before first value, etc.
- Reads the empty state on the post-signup dashboard — is the
  first-use experience a blank screen or a seeded example?
- Reads the upgrade flow — if there's a paid tier, how does a
  free user discover it? In-product prompts, or only the pricing
  page in the nav?

## Scoring rubric (0-10)

- **10** — 1-3 clicks to value. Empty states are seeded with
  examples. Upgrade prompts contextual. Activation > 60% benchmark.
- **6-7** — 3-5 clicks. Empty states adequate. Upgrade path exists
  but isn't surfaced in-product.
- **3-5** — 5-8 clicks. Empty states are literal blank pages.
  No upgrade surfacing.
- **0-2** — User has to talk to sales, or onboarding requires
  things the user wouldn't have at signup time.

## Output format (target)

```
CUSTOMER FLOW (N/10)

[Verdict: signup → first value click count, named friction points]

[Specific friction findings with path:line citations. Each finding
names the file, what's wrong, and the fix.]

[Optional: upgrade-path friction section if relevant.]
```

## TODO for v0.2

- Port full methodology from `lib/review/prompts/customerFlowPrompt.ts`
- Add framework-specific signup-route detection patterns
- Add heuristics for common onboarding anti-patterns (CRO research)

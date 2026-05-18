# Module: Growth readiness (code-derived)

> **Status:** scaffold — methodology TODO. The placeholder below sets
> scope, output format, and scoring so the parent skill can dispatch
> this module today. Full methodology to be ported from
> R&R's `lib/review/prompts/growthPrompt.ts`.

What the repo says about the founder's acquisition surface — sitemap,
structured data, analytics wiring, share metadata, SEO basics. Does
NOT do live URL audits (that's the paid version).

## What this module does (sketch)

- Checks for `sitemap.xml` (or `app/sitemap.ts` / Next-generated).
- Checks for `robots.txt` (or `app/robots.ts`).
- Checks for OG / Twitter card meta tags on the landing route
  AND on key sub-routes (pricing, features, docs).
- Checks for JSON-LD structured data (FAQ, Product, BreadcrumbList).
- Checks for any analytics integration: PostHog, Plausible, GA4,
  Mixpanel. Zero analytics = zero feedback loop = can't fix funnel.
- Checks for placeholder content (Lorem ipsum, "TODO: real content")
  that would index publicly.
- Checks for `llms.txt` if the project would benefit from GEO
  (Generative Engine Optimization).

## Scoring rubric (0-10)

- **10** — Sitemap, robots, OG/Twitter on all key pages, JSON-LD,
  analytics wired, no placeholder content, llms.txt for AI search.
- **6-7** — Sitemap + meta basics covered. Missing JSON-LD or
  analytics, but no acquisition leaks.
- **3-5** — Missing sitemap OR analytics OR meta on key routes.
  Multiple gaps that compound.
- **0-2** — No sitemap, no robots, no analytics, no OG cards.
  Placeholder content publicly indexed.

## Output format (target)

```
GROWTH (N/10)

[Verdict: what's the acquisition surface look like, what's leaking]

[Specific findings with citations. Each names what's missing/wrong
and where to fix.]
```

## TODO for v0.2

- Port full methodology from `lib/review/prompts/growthPrompt.ts`
- Add framework-specific sitemap / robots detection
- Add common analytics SDK detection patterns (PostHog, Plausible, etc.)

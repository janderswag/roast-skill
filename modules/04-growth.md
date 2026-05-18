# Module: Growth readiness (code-derived)

The acquisition-surface module. What the repo says about the founder's
ability to grow. Sitemap, structured data, analytics wiring, share
metadata, SEO. Does NOT do live URL audits — that's the paid version.

## Voice

Growth advisor who's helped 50+ early-stage SaaS go from 0 to first
1k customers. Looking at the product through the lens of: will this
actually grow? What's missing that will make distribution impossible
or expensive?

## What to read (in order)

1. **Metadata + SEO config.**
   - Next.js App Router: `metadata` exports in `app/page.tsx` + per-route
     `page.tsx`, `generateMetadata` functions, `app/robots.ts`,
     `app/sitemap.ts`
   - Pages Router: `pages/_document.tsx`, `pages/_app.tsx`
   - Other frameworks: `index.html` head, framework-specific meta
   - OG image conventions: `app/<route>/opengraph-image.{tsx,ts,jpg,png}`

2. **Analytics SDK presence.**
   - Imports of `posthog-js`, `mixpanel-browser`, `@vercel/analytics`,
     `@vercel/speed-insights`, `react-ga4`, `@segment/analytics-next`,
     `plausible-tracker`, `gtag`
   - Snippets in root layout (`app/layout.tsx`, `pages/_document.tsx`)
   - Server-side event capture (PostHog Node SDK, Segment server-side)

3. **JSON-LD structured data.**
   - Search for `application/ld+json` script tags
   - Schema.org types: FAQ, Product, BreadcrumbList, Organization,
     WebSite, SoftwareApplication

4. **Email capture / waitlist.**
   - Imports of Resend, Loops, ConvertKit, Mailchimp
   - Components named `Newsletter*`, `Subscribe*`, `Waitlist*`
   - Route handlers: `/api/subscribe`, `/api/newsletter`, `/api/waitlist`

5. **Payment + pricing surface.**
   - Stripe / Paddle / Lemon Squeezy imports
   - `/api/stripe/*`, `/api/payments/*` route handlers
   - Pricing page (`/pricing`, `/plans`, `/billing`)
   - Free → paid conversion paths in-product (not just nav link)

6. **Referral / viral mechanics.**
   - `/api/invite`, `/api/refer`, an `invites` or `referrals` table in
     the schema
   - Rewardful, FirstPromoter, PartnerStack, Tolt imports
   - Referral code generation logic

7. **Content surface.**
   - `/blog`, `/docs`, `/guides` routes
   - MDX or markdown content directories
   - Placeholder text (Lorem ipsum, "TODO: real content")

8. **GEO / LLM discoverability.**
   - `app/llms.txt`, `public/llms.txt` (Generative Engine Optimization)
   - Structured data optimized for LLM citation

## Hard rules

1. **Metadata and config often hide growth primitives.** Just because
   the extracted text doesn't mention something doesn't mean it's
   missing. Always check file tree, dependencies, and route conventions
   before flagging absence.

2. **Common false-positive patterns — verify before flagging HIGH:**
   - **"No analytics"** → check root layout, `pages/_document.tsx`,
     imports of analytics SDKs. Snippets live in the root, not in
     extracted hero copy.
   - **"No SEO"** → check `metadata` exports, `generateMetadata`,
     `app/robots.ts`, `app/sitemap.ts`. The extract sees rendered
     `<title>` but may miss whether it's statically optimized.
   - **"No social sharing / OG"** → check `metadata.openGraph` and
     `opengraph-image.{tsx,ts,jpg,png}` conventions. OG images don't
     appear in regular HTML extraction.
   - **"No email capture"** → check Resend / ConvertKit / Mailchimp
     imports, components named `Newsletter*` / `Subscribe*`, route
     handlers `/api/subscribe` / `/api/newsletter`.
   - **"No payment integration"** → check `stripe` /
     `@stripe/react-stripe-js` / `@lemonsqueezy/lemonsqueezy.js` in
     deps AND a `/api/stripe/*` or `/api/payments/*` route.
   - **"No referral"** → check `/api/invite`, `/api/refer`, `invites`
     table, rewardful / firstpromoter imports. Often gated behind paid
     features.
   - **"No retention"** → check for transactional email imports in
     webhook handlers, drip-campaign references.

3. **Severity discipline:**
   - **CRITICAL**: almost never appropriate for a growth finding.
     (Critical growth issue = a broken signup, which belongs in
     Customer Flow, not here.)
   - **HIGH**: significant growth ceiling — zero analytics on a paid
     product means founders can't iterate on conversion at all.
   - **MEDIUM**: real gap, not blocking. Most growth findings land here.
   - **LOW**: nice-to-have polish.
   - **INFO**: observation only.

4. **If you detect a feature in the file tree but can't assess quality
   from source**, mark MEDIUM with note "feature exists; quality not
   assessable from code alone — recommend live URL audit." Don't claim
   absence when you only have absence-of-evidence.

5. **Cite file:line on every concrete finding** (sitemap missing,
   placeholder text in `/docs/getting-started.mdx:14`, etc.).

## When this module does not apply

If the project has **no public-facing acquisition surface** — it's a
CLI, a library, an internal tool, a render pipeline, or an unhosted
prototype — this module should NOT run. There's no surface to grow.

Detect "no acquisition surface" if ANY of the following are true:
- The Phase 0.5 classifier shape is `cli`, `library`, `render-pipeline`,
  or `infra`
- No HTML page rendering AT ALL (no `app/page.*`, `pages/index.*`,
  `src/routes/+page.*`, `index.html`, `index.html.erb`)
- The README explicitly says "internal tool" or "not for public
  consumption"

Return format for the no-acquisition-surface case:

```
GROWTH (N/A — no public surface)

This codebase has no public-facing pages or acquisition surface. The
Growth module audits discoverability, analytics, sharing, and SEO —
all of which assume a user lands on a URL. This project doesn't have
URLs. Re-run /roast on the public-facing app (if any) instead.
```

Do not score 0-10 in this case.

## Scoring rubric (0-10) — when a public surface exists

- **10** — Sitemap, robots, OG/Twitter cards on all key routes, JSON-LD
  Product/FAQ/Org, analytics wired both client + server, no placeholder
  content, `llms.txt` for GEO, referral mechanic present.
- **8-9** — Sitemap + meta basics on all routes. Analytics wired.
  Missing one of: JSON-LD, referral, GEO.
- **6-7** — Sitemap + meta on landing only. Analytics partial. Missing
  JSON-LD entirely. No referral.
- **4-5** — Missing sitemap OR analytics OR meta on key routes.
  Multiple gaps that compound.
- **2-3** — Missing 3+ of (sitemap, robots, analytics, OG, payments
  integration). Placeholder content publicly indexed.
- **0-1** — No sitemap, no robots, no analytics, no OG, no payments
  surface. Repo would launch to zero discoverability.

## Output format

```
GROWTH (N/10)

[Verdict: what's the acquisition surface look like, what's leaking.
One paragraph.]

[Specific findings, each with citation. Group by category:
  - Discoverability (sitemap, robots, JSON-LD)
  - Analytics
  - Share metadata
  - Email capture / waitlist
  - Referral / viral
  - Content surface
  - GEO (LLM-search optimization)
Mention only the categories where findings exist; don't list empty
categories.]
```

## What this module DOES NOT do

- Doesn't fetch the live URL to verify rendered output.
- Doesn't measure actual SEO traffic or rankings.
- Doesn't run Lighthouse SEO score (that's paid-tier).
- Doesn't audit marketing copy quality (that's The Roast's job).
- Doesn't validate sitemap.xml structure (just checks existence).

## Return value

The GROWTH output block, ready for the parent skill.

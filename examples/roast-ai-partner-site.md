```
$ /roast

[detecting stack...]
✓ Node / TypeScript / JavaScript
✓ Next.js (next.config.ts — v0.2 regex now catches .ts)
✓ React 19.0.0 + Next 16.2.4
✓ Tailwind v4 (PostCSS plugin)
✓ Git repo (2a52a44 — 9 commits on main)
✓ No README in repo root
✓ 23 source files, ~1,948 LOC total
✓ No backend: 0 API routes, 0 DB, 0 auth deps, 0 payment deps
✓ Single client-side form (AuditDialog) → console.log → Cal.com iframe handoff

Mental model: marketing brochure for "Hawkify" — AI implementation consultancy for
SMBs (20–100 employees). Single landing page, 7 sections, free-audit lead form
opens a modal and hands off to a Cal.com booking iframe. Static. Trust surface
near-zero. Domain target: hawkify.ai.

[project shape: marketing-site]
✓ web-app shape (Next App Router + app/page.tsx)
✓ NO auth deps (no next-auth/clerk/lucia/passport/supabase-auth/iron-session in package.json)
✓ NO payment deps (no stripe / lemonsqueezy)
✓ NO API routes (app/api/ does not exist)
→ classified as marketing-site
✓ Dispatching: Roast, Security, Architecture, Customer Flow, Growth, Founder Briefing
✓ Security flagged as "minimal-surface" (no trust surface — only client-side form)
✓ Customer Flow flagged as "minimal-surface" (single lead form, no signup/dashboard)

[semgrep running...]
✓ 0 findings (semgrep ran clean — pattern-level scan found nothing)

[6 modules executing inline — 1,948 LOC + marketing-site shape favors single-pass...]

✓ Roast                    done
✓ Security                 score 9/10 (minimal-surface)
✓ Architecture             score 9/10
✓ Customer Flow            score 5/10 (minimal-surface)
✓ Growth                   score 3/10
✓ Founder Briefing         done

Total: ~14s wall-clock. No extra charge on Claude Pro/Max.

────────────────────────────────────────────────────
THE ROAST

Your H1 says "Practical AI systems for companies that have outgrown manual work"
(lib/content.ts:11-14). "Practical" is what every consultancy whose deck got
rejected for being too vague added to their hero in 2025 — it's a hedge dressed
as a value prop. The eyebrow says "An AI Implementation Partner · Est. 2024"
(lib/content.ts:10); the footer says "© 2026 Hawkify, LLC" and "Built in the
United States" (Footer.tsx:17,48). A two-year-old company that hasn't shipped
its own Privacy or Terms — both Footer links go to "#" (Footer.tsx:50,53) —
selling "documentation your team can keep running" (lib/content.ts:292) is
asking a procurement team to ignore the irony. Your proof section names exactly
one customer (Meethomies, lib/content.ts:128-130) and the four results stats
are unsourced round numbers — "20+", "< 5 min", "100%", "1 dashboard"
(lib/content.ts:155-159) — which is a testimonial in a trench coat, not proof.
The actual punch: your free-audit form, the only conversion mechanic on this
site, console.logs the submission before handing off to Cal.com
(AuditDialog.tsx:61-65). You built a 1,948-LOC brochure to capture leads you
are explicitly choosing not to capture. The TODO on line 61 admits it. Fix
that one branch and half the rest of this audit becomes optional.

────────────────────────────────────────────────────
SECURITY (9/10 — minimal-surface)

No auth, no payments, no DB, no API routes. Semgrep ran clean across
p/security-audit + p/owasp-top-ten + p/secrets. The only trust-adjacent
code path is the AuditDialog form, and the form does not POST anywhere —
it console.logs and hands off to a Cal.com iframe. There is nothing here
for an attacker to attack today. Two hygiene flags worth noting before the
backend gets wired in.

• [INFO] Form data logged to browser console
  components/forms/AuditDialog.tsx:63-65
  Every submission gets window.console.log'd with the full payload (name,
  email, company, team size, role, phone, workflow). On a brochure site
  this is informational. The moment you wire a real POST to /api/audit,
  strip this line — otherwise prospect PII ends up in any third-party
  browser extension, Sentry/Datadog client SDK, or screenshare recording
  the prospect happens to have running.
  Fix: delete the console.log block before adding the fetch.

• [INFO] .gitignore covers .env*.local but not bare .env
  .gitignore:4 — ".env*.local"
  If you ever add a production .env (not .env.local), git will track it.
  The pattern is one keystroke from being safe.
  Fix: change `.env*.local` to `.env*` and add `!.env.example`.

Nothing else moves the needle on a static brochure. Re-run /roast once
the audit form starts POSTing real data — the threat model changes the
moment a server-side route accepts user input.

────────────────────────────────────────────────────
ARCHITECTURE (9/10)

Static Next 16 site rendered to HTML, deployed on Vercel. There is no
scale wall in the conventional sense — Vercel will serve this to a million
unique visitors before anything cracks. The architecture is appropriate
for the job. No DB to outgrow, no API to throttle, no background worker
to queue. Two small smells, neither blocking.

• Single source-of-truth content file is 335 lines (lib/content.ts) and
  carries eight distinct concerns: brand, hero, automate, customerProof,
  partner, value, faq, audit, finalCta. Fine for one landing page. The
  moment a second route exists (/case-studies, /blog, /privacy, /terms),
  this becomes the file two collaborators conflict on every PR. Split
  by route — co-locate content with the route that consumes it.

• React pinned to "19.0.0" (no caret) while Next is "^16.2.4"
  (package.json:12-14). A future `npm install` could pull a Next patch
  that expects React 19.x where x > 0. Either pin both or float both —
  don't mix.

SCALE CEILING

First wall: lead capture breaks at submission #1.
  Why: AuditDialog.tsx:61-65 is the only data-emission code path and it
       targets window.console, not a server. The Cal.com iframe handoff
       (line 119) only fires IF audit.calComUrl is set in lib/content.ts:317
       (currently "https://cal.com/hawkify/45"). Prospects who fill the
       form and bounce before completing Cal booking leave zero record —
       no email, no name, no retargetable signal.
  Fix: add app/api/audit/route.ts that POSTs to Resend (email Jake) +
       Airtable/Sheet/Notion for persistent record. Call it from
       handleSubmit BEFORE the setStep transition. 2 hours.

Second wall: content velocity at ~5 marketing pages.
  Why: lib/content.ts is a 335-line monolith covering eight homepage
       concerns. Adding /case-studies + /privacy + /terms in the same
       sprint will produce merge conflicts on every PR by week two.
  Fix: split by route now (app/<route>/content.ts) or migrate to MDX
       before the second page ships.

────────────────────────────────────────────────────
CUSTOMER FLOW (5/10 — minimal-surface)

There is no signup, no dashboard, no first-run experience to trace —
this is a marketing site, the "customer flow" here is just the single
lead-capture path. With that framing: landing → click "Free Workflow
Audit" → fill 7-field form (4 required: name, email, company, team
size; 3 optional: role, phone, workflow) → submit → either Cal.com
iframe (current state) or a polite lie that "we'll email a scheduling
link" (the no-Cal branch). Three real findings.

• [CRITICAL] Form submissions go nowhere
  components/forms/AuditDialog.tsx:61-65
  ```
  // TODO (production): replace with fetch('/api/audit', ...) to email submission.
  if (typeof window !== "undefined") {
    console.log("[audit submission]", data);
  }
  ```
  The one mechanic this entire site exists to serve doesn't actually serve
  it. If a prospect fills the form, closes the modal before completing the
  Cal.com booking, you have nothing — not the name, not the email, no
  retargetable record. The TODO comment on line 61 admits the gap. At even
  modest inbound (10 visits/day × 5% form-start × 30% Cal-abandon) that's
  ~5 lost qualified leads per week.
  Fix: ship app/api/audit/route.ts → POST payload to Resend + Airtable,
       call it from handleSubmit. Two hours.

• [HIGH] 7-field intake sits BEFORE Cal.com which re-asks name + email
  components/forms/AuditDialog.tsx:110-127
  Modern free-consult booking flows (Cal, Savvycal, SuperSaaS) put the
  calendar first and capture details on the booking page itself. You're
  gating Cal behind a 7-field form, then dropping users into Cal which
  asks for name/email again (the SchedulingStep prefills via query string
  per line 274-277, but the user doesn't know that — it reads as a
  double-ask). On a page whose pitch is "we eliminate manual work," the
  double form reads as bureaucratic theater.
  Fix: kill Step 1 entirely, move name+email+company+team-size into Cal's
       own intake questions, drop users straight to the calendar.

• [MEDIUM] "Success" message claims an email that doesn't get sent
  components/forms/AuditDialog.tsx:318-321
  In the no-Cal branch (audit.calComUrl empty), SuccessStep tells the
  user "We'll email a scheduling link to {email} within 1 business hour."
  No email-sending code exists anywhere in the repo. If you ever clear
  calComUrl (Cal outage, account migration, A/B test), the form silently
  lies to every prospect — and they will notice when the email never
  arrives.
  Fix: either ship the email send pipeline OR hide SuccessStep until it
       does something real.

────────────────────────────────────────────────────
GROWTH (3/10)

The weakest module by a wide margin — and the one that matters most for
a brand-new domain with no organic gravity. The site has decent metadata
on the root layout (app/layout.tsx:5-24 — title, description, openGraph,
twitter card, metadataBase pointing at hawkify.ai) and ships a real
opengraph-image.png + twitter-image.png + favicons in app/. That is the
entire growth surface. Everything below is missing.

Discoverability
• [HIGH] No sitemap, no robots
  Missing app/sitemap.ts and app/robots.ts. Single-page sites still need
  these — without robots.txt Google's crawler infers permissions from
  defaults, and without a sitemap the canonical URL never explicitly
  registers. For a brand-new domain (hawkify.ai, Est. 2024 per copy),
  this delays first indexation by weeks.
  Fix: add app/sitemap.ts + app/robots.ts. 15 minutes.

• [MEDIUM] Zero JSON-LD structured data
  No `application/ld+json` script tags anywhere — verified via grep across
  app/, components/, lib/. The site is a textbook case for Organization
  + FAQPage schema; the FAQ section (lib/content.ts:282-306) is already
  structured Q/A pairs Google will happily turn into rich results if
  marked up.
  Fix: emit FAQPage schema from FAQ.tsx, Organization schema from layout.
       30 minutes.

Analytics
• [HIGH] Zero analytics wired
  No imports of posthog-js, @vercel/analytics, plausible-tracker, gtag,
  segment, mixpanel anywhere — verified via grep. The product this site
  sells is "AI that gives you measurable ROI." The site itself can
  measure nothing. You don't know which CTA gets clicked, how far
  prospects scroll, where the form gets abandoned, or which referral
  drove a booking. A consultancy that doesn't instrument its own funnel
  has a credibility tax on every prospect call.
  Fix: add @vercel/analytics + PostHog in app/layout.tsx. 20 minutes.

GEO / LLM discoverability
• [MEDIUM] No llms.txt
  No public/llms.txt or app/llms.txt. For a consultancy whose audience
  is increasingly searching via ChatGPT/Claude/Perplexity, this is a
  zero-effort win — list the six service categories already in
  lib/content.ts:27-105, link the FAQ.
  Fix: create public/llms.txt — services + FAQ + contact. 10 minutes.

Content surface
• [MEDIUM] Footer dead links + no Privacy/Terms
  components/layout/Footer.tsx:50,53 ship Privacy + Terms pointing at "#".
  Either the pages exist and the hrefs are stale (they don't — verified),
  or a two-year-old consultancy is publicly missing legal pages every
  SMB procurement will block on. Either way: fix this sprint.
  Fix: ship /privacy + /terms as MDX. One hour with a generator.

Email capture / referral
• [INFO] No newsletter, no waitlist, no referral
  Single CTA path: audit form → Cal. There is no way for a "not ready
  yet" prospect to stay in your orbit. For a long-sales-cycle SMB
  consulting product, "not ready yet" is the dominant prospect state.
  A quarterly "SMB AI report" capture would salvage those visits.

────────────────────────────────────────────────────
FOUNDER BRIEFING

You're a solo or two-person operator launching a B2B AI consultancy on
a fresh domain. Nine commits on main, one named customer, no README in
the repo, no analytics, no sitemap, ~1,948 lines of clean Next.js, and
exactly one form — which doesn't post anywhere. The positioning
("Practical AI systems for companies that have outgrown manual work")
is generic enough that it could be swapped onto any competitor's homepage
without breaking the page. The front-end craft is genuinely good though:
the type system, the content separation, the AuditDialog focus-trap, the
metadata config, the OG image, the Cal.com handoff flow. It's the
back-of-the-funnel infrastructure that's absent in a way that makes the
whole brochure leak prospects.

What's working: the architecture is right for the job (9/10) and the
security surface is near-empty by intent (9/10, minimal-surface). For a
marketing site whose only job is to drive a single CTA, those are the
two scores that earn the right to ship before the rest is solved. The
visual and information design — the alternating value blocks, the FAQ
structure, the 30-day partner journey, the platform badge row — does
the storytelling work a free-tier brochure should do.

The order matters more than the scope. Fix the form submission first —
every day it stays a console.log is a day of unrecorded inbound on a
domain that has no other funnel. Once the form posts somewhere, the
analytics + sitemap work becomes testable; you can see in 48 hours
whether the change moved conversion. The growth surface (sitemap, robots,
JSON-LD, analytics, llms.txt, privacy/terms) is half a day of work and
triples the value of every paid acquisition dollar you'll ever spend
on this domain. Everything else is downstream of those two unlocks.

────────────────────────────────────────────────────
TOP-3 PRIORITIES (ordered by what costs you most)

1. [CRITICAL] components/forms/AuditDialog.tsx:61-65
   The free-audit form — the singular conversion mechanic on this site —
   console.logs the submission and does nothing else. Every prospect who
   fills it out and bounces before completing the Cal.com booking is a
   permanently lost lead with no email, no name, no retargetable record.
   At 10 visits/day × 5% form-start × 30% Cal-abandon that's ~5 lost
   qualified leads per week. The TODO on line 61 already acknowledges
   the gap.
   Fix: ship app/api/audit/route.ts → POST to Resend (email Jake) +
        Airtable/Sheet (persistent record); call from handleSubmit
        BEFORE the setStep transition. Two hours.

2. [HIGH] Missing app/sitemap.ts + app/robots.ts + zero analytics
   No sitemap, no robots, no posthog/vercel-analytics/gtag imports
   anywhere. Brand-new domain (hawkify.ai, Est. 2024) has zero
   organic-discoverability scaffolding and zero way to measure what's
   working once it does. A consultancy that can't instrument its own
   funnel while selling instrumentation to SMBs is a credibility tax
   on every prospect call.
   Fix: ship app/sitemap.ts + app/robots.ts + @vercel/analytics +
        PostHog in one sprint. Half a day.

3. [HIGH] components/forms/AuditDialog.tsx:110-127
   The 7-field intake gate (4 required) sits in front of a Cal.com
   iframe that re-asks name + email. Double-asking burns ~30 seconds
   per booking on a flow whose entire pitch is "we eliminate
   bureaucracy." Modern free-consult booking flows put the calendar
   first.
   Fix: kill Step 1 entirely; move name+email+company+team-size into
        Cal.com intake questions; send users straight to the calendar.

────────────────────────────────────────────────────

Want this on your live URL with screenshots, Lighthouse, axe-core,
competitor teardown, and the 90-day founder roadmap?
→ https://roastrebuild.com/review — $19
```

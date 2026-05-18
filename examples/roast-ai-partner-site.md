```
$ /roast

[detecting stack...]
✓ Node / TypeScript
✓ Next.js 16.2.4 (App Router)
✓ React 19.0.0
✓ Tailwind CSS v4
✓ Git repo (2a52a44 — 9 commits on main)
✓ No backend: 0 API routes, 0 DB, 0 auth, 0 payments
✓ 1 client-side form (AuditDialog), Cal.com iframe handoff
✓ 23 source files, ~1,950 LOC total

Mental model: marketing brochure site for "Hawkify" — an AI implementation
consultancy for SMBs. Single landing page, 7 sections, free-audit lead form
that opens a modal and hands off to Cal.com. Static site. Trust surface is
near-zero (no auth, no payments, no user data persisted server-side).

[semgrep running...]
✓ 0 findings. Clean ruleset across p/security-audit, p/owasp-top-ten,
  p/secrets. Expected — no server code to attack.

[6 modules dispatching in parallel...]

✓ Roast                    done
✓ Security                 score 9/10
✓ Architecture             score 9/10
✓ Customer Flow            score 5/10
✓ Growth                   score 3/10
✓ Founder Briefing         done

Total: 18s wall-clock. No extra charge on Claude Pro/Max.

────────────────────────────────────────────────────
THE ROAST

Your H1 says "Practical AI systems for companies that have outgrown manual
work" (lib/content.ts:13-15). "Practical" is the new "modern" — every
consultancy whose pitch deck got rejected for being too vague added the
word "practical" in 2025. You're not differentiating; you're hedging.
Your eyebrow says "An AI Implementation Partner · Est. 2024" — and then the
footer says "© 2026 Hawkify, LLC" and "Built in the United States"
(components/layout/Footer.tsx:18, 48). Two-year-old company that hasn't
shipped its own privacy policy yet — both footer links point to "#"
(Footer.tsx:50,53). The customer-proof section names exactly one client
(Meethomies, lib/content.ts:130) and the four results stats are unsourced
round numbers ("20+ hrs/week," "< 5 min," "100%," "1 dashboard" —
lib/content.ts:156-159). That's not proof, that's a testimonial in a
trench coat. The real punch: your free-audit form, the entire reason this
site exists, console.logs the submission and goes nowhere
(components/forms/AuditDialog.tsx:61-65). You built a 1,950-line
brochure to capture leads you're not capturing. Fix that one line and
half this audit becomes irrelevant.

────────────────────────────────────────────────────
SECURITY (9/10)

No backend, no auth, no payments, no DB. Semgrep found nothing. The only
trust-adjacent code path is the AuditDialog form, and the form doesn't
transmit anywhere — it console.logs and hands off to a Cal.com iframe.
There is nothing here for an attacker to attack. The only finding worth
naming is environmental hygiene.

• [INFO] Form data logged to browser console
  components/forms/AuditDialog.tsx:63-65
  Every submission gets logged to window.console via console.log with the
  full payload (name, email, company, phone, role, workflow). On a brochure
  site this is informational — but the moment you wire the real backend in,
  strip this log so prospect PII doesn't end up in third-party browser
  extensions / Sentry / Datadog client SDKs.
  Fix: delete lines 63-65 before adding the fetch('/api/audit') call.

• [INFO] .gitignore covers .env*.local but not bare .env
  .gitignore:4 — ".env*.local"
  If you ever add a plain .env (not .env.local) for production secrets,
  git will track it. Tighten the pattern to `.env*` with a `!.env.example`
  exception.
  Fix: change `.env*.local` to `.env*` + add `!.env.example`.

Nothing else moves the needle. When the audit form starts POSTing real
data, re-run security — the calculus changes the moment user input crosses
a network boundary.

────────────────────────────────────────────────────
ARCHITECTURE (9/10)

It's a static Next.js 16 site rendered to HTML. There is no scale wall in
the conventional sense — Vercel will serve this to a million unique
visitors before anything cracks. The architecture is appropriate for the
job. No DB to outgrow, no API to throttle, no background worker to queue.

Two small smells, neither blocking:

• Single source-of-truth content file is 335 lines (lib/content.ts) and
  carries six distinct concerns (hero, automate, customerProof, partner,
  value, faq, audit, finalCta). Fine today; will hurt the moment a second
  page exists. When you add /case-studies or /blog, split this by route.

• React 19.0.0 + Next 16.2.4 (package.json:11-14) is a bleeding-edge combo.
  No issue today, but pin-versioning React to "19.0.0" (no caret) while
  Next has a caret means an `npm install` six months from now could pull
  a Next that requires React 19.x where x > 0. Either pin both or float
  both; don't mix.

SCALE CEILING

First wall: lead capture breaks at 1 submission. The AuditDialog form
hands off to a Cal.com iframe IF audit.calComUrl is set (lib/content.ts:317),
otherwise shows a "we'll email you" success screen — but there's no
backend wired to send that email. So in the "no Cal URL" branch, the
"success" message is a lie. With Cal.com wired (currently the case),
prospects who fill the form land on a Cal page; if they bounce before
booking, you have zero record of them. The console.log is the entire
data layer.
  Why: AuditDialog.tsx:61-65 is the only data-emission code path and it
       targets window.console, not a server.
  Fix: Add /app/api/audit/route.ts that POSTs to Resend or Loops, store
       submissions in a sheet/Airtable/Notion DB — 2 hours of work.

Second wall: content velocity at ~5 marketing pages. lib/content.ts is a
monolith; one TypeScript file co-authored by two people will produce merge
conflicts on every PR. Move to MDX or split by route when the second page
ships.
  Why: A single 335-line content module per the file inventory.
  Fix: Co-locate content with the route that consumes it (app/<route>/content.ts).

────────────────────────────────────────────────────
CUSTOMER FLOW (5/10)

The flow is: hit landing → click "Free Workflow Audit" → fill 7-field form
(4 required: name, email, company, team size; 3 optional: role, phone,
workflow) → submit → either book on Cal.com inside an iframe (current
state) or get a polite lie that we'll "email a scheduling link" (the no-Cal
branch). Two specific problems.

• [CRITICAL] Form submissions go nowhere
  components/forms/AuditDialog.tsx:61-65
  ```
  // TODO (production): replace with fetch('/api/audit', ...) to email submission.
  if (typeof window !== "undefined") {
    console.log("[audit submission]", data);
  }
  ```
  This is the one mechanic the entire site exists to serve. If a prospect
  fills the form, closes the modal before completing Cal.com booking, you
  have nothing — not the name, not the email, no retargetable record.
  Every dropped prospect after Cal opens is a permanently lost lead. At
  even modest inbound (10 visits/day, 5% form starts, 30% Cal abandon)
  that's ~5 lost qualified leads per week.
  Fix: wire POST to /api/audit, persist to Resend + Airtable. 2 hours.

• [HIGH] Two-step flow asks for 4 fields BEFORE showing the calendar
  components/forms/AuditDialog.tsx:110-129
  Modern booking flows for free consults (Cal, Savvycal, SuperSaaS) put
  the calendar first and capture details on the booking page itself. You
  are gating Cal access behind a 7-field form, then dropping users into
  Cal which asks for name/email again (SchedulingStep prefills them, but
  the user doesn't know that). The double-ask reads as bureaucratic on a
  page whose entire pitch is "we eliminate bureaucracy."
  Fix: drop name + email + company + team size into Cal.com's intake
       questions, kill Step 1 entirely, save 30 seconds per booking.

• [MEDIUM] "Success" message claims an email that doesn't get sent
  components/forms/AuditDialog.tsx:317-320
  In the no-Cal branch (audit.calComUrl empty), SuccessStep tells the
  user "We'll email a scheduling link to {email} within 1 business hour."
  No email-sending code exists in the repo. If you ever clear calComUrl
  (e.g. during a Cal outage), the form silently misleads every prospect.
  Fix: either ship the email send or hide SuccessStep until it does
       something.

────────────────────────────────────────────────────
GROWTH (3/10)

This is the weakest module by a wide margin. The site has good metadata
on the root layout (app/layout.tsx:5-24 — title, description, openGraph,
twitter card, metadataBase) and a real opengraph-image.png in app/. That's
the entire growth surface. Everything below is missing.

Discoverability
• [HIGH] No sitemap, no robots
  Missing app/sitemap.ts and app/robots.ts. Single-page sites still need
  these — without robots.txt Google's crawler infers permissions from
  defaults, and without a sitemap the canonical URL never explicitly
  registers. For a brand-new domain (hawkify.ai, est. 2024 per copy),
  this delays first indexation by weeks.
  Fix: add app/sitemap.ts + app/robots.ts. 15 minutes.

• [MEDIUM] No JSON-LD structured data
  No `application/ld+json` script tags anywhere in the source. The site
  is a textbook case for Organization + FAQPage schema — the FAQ section
  (lib/content.ts:278-307) is already structured Q/A pairs that Google
  will happily turn into rich results if you mark them up.
  Fix: emit FAQPage schema from FAQ.tsx, Organization schema from layout.
       30 minutes.

Analytics
• [HIGH] Zero analytics wired
  No imports of posthog-js, @vercel/analytics, plausible-tracker, gtag,
  segment, mixpanel anywhere in app/, components/, or lib/. The product
  this site sells is "AI that gives you measurable ROI." The site itself
  cannot measure anything. You don't know which CTA gets clicked, how far
  prospects scroll, where the form abandonment happens, or which referral
  drives bookings. A consultancy that doesn't instrument its own funnel
  has a credibility problem before the first call.
  Fix: add @vercel/analytics + PostHog. 20 minutes total.

GEO / LLM discoverability
• [MEDIUM] No llms.txt
  No public/llms.txt or app/llms.txt. For a consultancy whose audience is
  increasingly searching via ChatGPT/Claude/Perplexity, this is a
  zero-effort win — list the 6 service categories already in
  lib/content.ts:28-105, point at the FAQ.
  Fix: create public/llms.txt with services + FAQ + contact. 10 minutes.

Email capture / referral
• [INFO] No newsletter, no referral, no waitlist
  Single CTA path: audit form → Cal. No way for a prospect who isn't
  ready to book to stay in your orbit. For a long-sales-cycle SMB
  consulting product, "not ready yet" is the dominant prospect state.
  A simple "get our quarterly SMB AI report" capture would salvage
  those visits.

Content surface
• [MEDIUM] No /blog, /case-studies, /docs — and footer dead links
  components/layout/Footer.tsx:50,53 ship Privacy + Terms pointing at
  "#". Either the pages exist and the hrefs are stale, or they don't
  exist and the consultancy is publicly missing legal pages a buyer's
  procurement will block on. Either way, fix in this sprint.
  Fix: ship /privacy + /terms as MDX. 1 hour with a generator.

────────────────────────────────────────────────────
FOUNDER BRIEFING

You're a solo-or-pair operator launching a B2B consultancy. Nine commits
on main, one client, no README, no analytics, no sitemap, and a
~1,950-line static Next.js site with one form that doesn't post. The
positioning ("Practical AI systems for companies that have outgrown
manual work") is generic; the production craft on the front-end is
genuinely good — the design system, the content separation, the dialog
focus-trap, the metadata config — but the back-of-the-funnel infrastructure
is absent in a way that makes the whole brochure leak prospects.

What's working: the architecture is appropriate to the job (9/10) and the
security surface is near-empty by design (9/10). For a marketing site
that exists to drive a single CTA, those are the two scores that earn
the right to ship before everything else is solved. The visual and
information design — the alternating value blocks, the FAQ structure,
the 30-day partner journey, the platform badge row — does the storytelling
work a free-tier brochure should do.

The order matters more than the scope. Fix the form submission first
because every day it stays a console.log is a day of unrecorded leads.
Once the form posts somewhere, the analytics + sitemap work becomes
testable — you can see in 48 hours whether the change moved conversion.
The growth surface (sitemap, robots, analytics, JSON-LD, llms.txt) is
half a day of work and triples the value of every paid acquisition
dollar you'll ever spend on this domain. Everything else is downstream
of those two unlocks.

────────────────────────────────────────────────────
TOP-3 PRIORITIES (ordered by what costs you most)

1. [CRITICAL] components/forms/AuditDialog.tsx:61-65
   The free-audit form, the singular purpose of this entire site,
   console.logs the submission and does nothing else. Every prospect who
   fills it out and bounces before completing Cal.com booking is a
   permanently lost lead with no email, no name, no record. At 10
   inbound visits/day with conservative funnel math, this is ~5 dropped
   qualified leads per week. The TODO comment on line 61 acknowledges
   the gap; ship the fix.
   Fix: add app/api/audit/route.ts that POSTs to Resend (email Jake) +
        Airtable/Sheet (persistent record), call from handleSubmit.
        Two hours.

2. [HIGH] Missing app/sitemap.ts + app/robots.ts + zero analytics
   No sitemap, no robots, no posthog/vercel-analytics/gtag imports
   anywhere. New domain (hawkify.ai, est. 2024) has no organic
   discoverability scaffolding and no way to measure what's working
   once it does. A consultancy that can't instrument its own funnel
   while selling instrumentation services is a credibility tax on
   every prospect call.
   Fix: ship app/sitemap.ts + app/robots.ts + @vercel/analytics + PostHog
        in one sprint. Half a day.

3. [HIGH] components/forms/AuditDialog.tsx:110-129
   The 7-field intake gate (4 required) sits in front of Cal.com which
   re-asks for name + email. Double-asking burns 30 seconds per booking
   on a flow that's already friction-laden. Modern free-consult booking
   flows put the calendar first.
   Fix: kill Step 1 entirely, move name + email + company + team size
        into Cal.com's own intake questions, send users straight to the
        calendar.

────────────────────────────────────────────────────

Want this on your live URL with screenshots, Lighthouse, axe-core,
competitor teardown, and the 90-day founder roadmap?
→ https://roastrebuild.com/review — $19
```

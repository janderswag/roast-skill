# /roast — stress test against `roastrebuild-remotion`

**Target:** `/Users/janderswag/Desktop/roastrebuild-remotion` — a Remotion
video-rendering project (not a web app, not a SaaS, no user-facing surface).

**Purpose of this run:** stress test the skill methodology against a
codebase it was not designed for. Where the methodology breaks, that's
the finding.

---

```
[detecting stack...]
✓ Node / TypeScript (package.json + tsconfig.json)
✓ Remotion 4.x (no Next.js, no Vite, no SvelteKit)
✓ React 18.3 (used only as Remotion's component runtime)
✓ No git repo. No README.md. No .env. No .gitignore.
✓ 8 source files, 428 LOC total (src/*.tsx + src/data/storyboard.ts)
✓ Deploy target: local CLI render only (npm run render:*). No server,
  no API surface, no auth, no DB, no payments, no users.

[semgrep running...]
✓ 0 findings. 13 files scanned in 0.27s against p/security-audit,
  p/owasp-top-ten, p/secrets. Clean — and unsurprising, because the
  code surface is "5 React components that lay out images and overlay
  text inside a video frame."

[6 modules dispatching...]

✓ Roast                    done
✓ Security                 score 9/10 — but read the caveat
✓ Architecture             score 6/10 — narrow scope, real smells
✓ Customer Flow            N/A — no customers in scope
✓ Growth                   N/A — no growth surface in scope
✓ Founder Briefing         done

Total wall-clock: ~25s. The methodology is built for ~5min audits of
~50k-LOC SaaS apps. This repo is 428 LOC. The audit padded itself
down honestly rather than padding up.
```

---

## THE ROAST

You don't have a README. Your `package.json` description reads
"RoastRebuild animated marketing video assembly (Remotion)" — which is
accurate, which is the problem, because that's the only sentence anyone
walking up to this repo gets. The CTA card in `src/components/CTACard.tsx:49-60`
literally yells "Roast your startup before it burns down" — clear, on-brand,
the kind of line your other repo (the actual SaaS) is too polite to write
on its own landing page. Meanwhile 13 of 15 shots in
`src/data/storyboard.ts:29-94` have `mjFrameUrl: null` and `runwayClipUrl: null`,
which means this "3-Act short" currently renders as 14 placeholder frames of
the same burning-server-room PNG with one real Runway clip slotted into S2.1.
You're not shipping a video yet; you're shipping a Remotion harness waiting
for Midjourney to finish its job. That's fine — name it. Don't run
`npm run render:full` and expect a finished video, because the storyboard
data layer is honestly telling you it isn't one.

---

## SECURITY (9/10)

There is almost no security surface to audit. No auth, no API routes,
no user input, no DB, no webhook handlers, no outbound HTTP from the
runtime (only Remotion's own asset fetches for `<Img>` and `<Video>`).
Semgrep returned 0 findings across `p/security-audit`, `p/owasp-top-ten`,
and `p/secrets`. The 9 (not a 10) is because there are two real things
worth naming:

- **[INFO] No `.gitignore`, no git repo at all** — `roastrebuild-remotion/`
  is not under version control. `ls -la` shows no `.git` directory. This
  isn't a vulnerability in the audited-app sense, but if a `.env` is ever
  added later, nothing's stopping it from getting committed when this
  finally becomes a repo. Fix: `git init && echo "node_modules/\nout/\n.env*" > .gitignore`.

- **[INFO] Public Runway pre-signed URL embedded as source data**
  `src/data/storyboard.ts:46` contains a CloudFront URL with a JWT
  `_jwt=...` query parameter. This is a **public asset signature**, not
  a credential — Runway issues these for CDN access and they expire on a
  fixed schedule (this one decodes to expiry around 2026-09-15). It is
  not exposing your account. Worth knowing: when the JWT expires, the
  `<Video>` tag will silently 403 and the shot will render as a black
  frame because `ShotSequence.tsx:22-26` has no error path. Fix: when
  Runway clips land, mirror them into your own S3/R2 bucket with no
  expiry, or accept the expiry and document the re-export schedule.

**Methodology note:** the security module assumes a trust surface
(auth, payments, user data). This repo has none. The 9/10 reflects
"nothing exploitable" rather than "well-hardened" — and that's the
right answer, but the rubric in `modules/01-security.md` doesn't have
a band for "audit doesn't apply." It defaults to a high score by
absence, which slightly misrepresents posture.

---

## ARCHITECTURE (6/10)

Remotion is a React-renders-to-video framework. The architecture
question for this repo is not "will it scale to 10k users" (there are
no users) but "will it scale to 50 shots, multiple compositions, and
an asset pipeline that doesn't break when Midjourney URLs rotate."
Against that question, the design is reasonable for v1 and has three
real smells:

- **`src/data/storyboard.ts` is hard-coded as the single source of
  truth, and you say so in the comment at line 1.** That's correct
  for 15 shots; it stops being correct around shot 30, when you'll
  want a Notion-driven or JSON-driven feed (the project memory at
  `~/.claude/projects/.../project_roastrebuild_cartoon_universe.md`
  says the storyboard already mirrors a Notion DB — so the manual
  copy here is drift bait). Fix: a `scripts/sync-storyboard.ts` that
  pulls from Notion API and writes `src/data/storyboard.generated.ts`,
  with the generated file gitignored.

- **`ShotSequence.tsx:18` falls back to `PLACEHOLDER_URL` silently when
  `mjFrameUrl` is null.** Right now 13 of 15 shots fall back. Renders
  will look like they "worked" but produce the same image 13 times.
  No warning, no shot ID logged. Fix: at minimum, when in non-final
  render mode, render the shot-ID badge and the string "PLACEHOLDER"
  over fallback frames so a quick scrub of the output mp4 reveals
  what's done and what isn't.

- **No error path on `<Video src=...>` in `ShotSequence.tsx:22-26`.**
  When the Runway pre-signed URL expires, or when the CDN returns
  anything non-200, Remotion will render a black frame and the render
  job will silently succeed. Fix: wrap with an `<ErrorBoundary>`
  or add a fallback `<Img>` rendered behind the `<Video>` so any
  fetch failure surfaces as the still frame, not as black.

**Other smells:**

- `src/BurningServerRoom.tsx` and `src/BurningServerRoomFull.tsx` both
  hard-code the same `PLACEHOLDER_URL` / `SCENE_IMG` string in their
  own files (`BurningServerRoom.tsx:4`, `storyboard.ts:27`). Two copies
  of the same constant; one will drift. Move it to a `src/constants.ts`
  or have `BurningServerRoom.tsx` import from `data/storyboard.ts`.

- `src/components/CTACard.tsx` and `src/components/DialogueOverlay.tsx`
  duplicate the same `"Inter, system-ui, -apple-system, sans-serif"`
  font stack across multiple style blocks. Small thing; pull into a
  shared `FONT_STACK` constant once you add a 16th shot.

```
SCALE CEILING

First wall: the storyboard data file at ~30 shots.
  Why: src/data/storyboard.ts is hand-edited. At 30+ shots the
       Notion-source ↔ TS-mirror drift becomes a real bug surface
       (wrong durations, wrong dialogue, stale URLs).
  Fix: codegen the storyboard from Notion. 1-2 days of work, ships
       once and pays back forever.

Second wall: render time + asset availability when all 15 Runway clips
land.
  Why: `remotion render` is CPU-bound and downloads every <Video>
       and <Img> URL per render. 15 cloud-hosted clips × N renders =
       minutes per build and depends on Runway's CDN being up.
  Fix: a `scripts/prefetch-assets.ts` that downloads all clips to
       `assets/` once and rewrites URLs to `staticFile("assets/...")`.
       Also fixes the JWT-expiry problem above.
```

---

## CUSTOMER FLOW (N/A)

This module does not apply. There are no customers. There is no signup,
no auth route, no onboarding form, no dashboard, no empty state, no
welcome email, no upgrade path. The skill's customer-flow methodology
in `modules/03-customer-flow.md` is built entirely around web-app
activation patterns (NextAuth / Clerk / Supabase / Stripe checkout).

Scoring this 0-10 would be dishonest in either direction: a 0 implies
broken flow, but there is no flow at all; a 10 implies frictionless
activation, but nothing's being activated. The methodology has no
"not applicable" band, so the right answer is to skip the score and
say so explicitly. **The skill needs an N/A path.**

---

## GROWTH (N/A)

Also does not apply. There is no landing page, no sitemap, no robots.txt,
no analytics SDK, no OG image config, no email capture, no `/blog`,
no `llms.txt`, no payment integration, no referral mechanic — because
none of those things make sense in a video-rendering project that
outputs `out/burning-server-room-full.mp4`.

The only growth-adjacent observation is: the *output* of this repo
(the rendered video itself) is a growth artifact for the actual
SaaS — and the CTA card at `src/components/CTACard.tsx:49-72` is the
growth surface. It works. "Roast your startup before it burns down."
+ "RoastRebuild.com" in the brand cyan (#2EC4B6). That's the entire
growth review, and it lives in a single React component.

Same as Customer Flow: the methodology in `modules/04-growth.md`
assumes a deployed web product. The right answer here is N/A, not
a low score against a rubric the repo was never trying to satisfy.

---

## FOUNDER BRIEFING

This isn't a SaaS audit. It's a 428-LOC Remotion project that exists
to render one 15-shot vertical short whose purpose is to drive traffic
to your actual SaaS. Two of the six audit modules genuinely apply
(Architecture and a thin Security pass). The Roast applies because
positioning is universal. Customer Flow and Growth apply zero —
there are no customers and no growth surface inside this repo, only
the *output* video which serves growth for the parent project.

What's working: the abstraction at `src/data/storyboard.ts` is the
right call — separating shot data from render code means when MJ
frames and Runway clips land, the only edits are in one file. The
CTACard is on-brand and ready. The Sequence-based composition in
`BurningServerRoomFull.tsx` is the idiomatic Remotion pattern and
sets you up to scale to 30+ shots without rewriting the orchestrator.

The order matters more than the count: ship the storyboard-from-Notion
sync before you cross 20 shots, because the manual mirror will start
costing you debugging time the moment the Notion DB and the TS file
disagree. Asset prefetching unblocks reliable rendering. Everything
else is polish.

────────────────────────────────────────────────────

## TOP-3 PRIORITIES (ordered by what costs you most)

1. **[MEDIUM] `src/data/storyboard.ts:1-99` — manual mirror of the Notion
   storyboard DB.** Project memory says this file mirrors Notion; nothing
   in the code enforces that. As you cross ~20 shots, the cost of "which
   one is right, the TS or the Notion?" becomes the dominant debugging
   cost on this repo. You'll catch it when a render uses a stale dialogue
   line that was edited in Notion three days ago.
   Fix: `scripts/sync-storyboard.ts` pulling from Notion API into a
   `storyboard.generated.ts`, with the source file gitignored. Run on
   pre-build.

2. **[MEDIUM] `src/components/ShotSequence.tsx:18-34` — silent placeholder
   fallback + no `<Video>` error path.** 13 of 15 shots currently fall
   back to the same PNG with no visual indicator. The render output will
   *look* like a successful video, masking how much of the storyboard is
   still unimplemented. When the Runway JWT in `storyboard.ts:46`
   expires, the same silent-success failure mode hits S2.1.
   Fix: render a "PLACEHOLDER" badge over fallback frames in preview
   mode; add an `onError` fallback `<Img>` underneath every `<Video>`
   so CDN failures degrade gracefully.

3. **[INFO] Repo root: no `git init`, no `README.md`, no `.gitignore`.**
   This isn't a vulnerability today, but it's the lowest-effort highest-
   ROI fix on the list. Anyone (including future-you) walking up to this
   directory has to read the source to understand what it does. And the
   moment an `.env` gets added — for a Notion API key, for an R2 token,
   for anything — there's no `.gitignore` to catch it.
   Fix: `git init && echo "node_modules/\nout/\n.env*\nsrc/data/storyboard.generated.ts" > .gitignore`
   and write a 6-line README pointing at `npm run render:full-preview`.

---

## Stress-test verdict (meta — what this run tells us about the skill)

Running this skill against this repo surfaced four methodology gaps:

1. **No project-shape detection.** Phase 0 detects *stack* (Node, React,
   Remotion) but not *project type* (web app vs CLI vs library vs render
   pipeline). The 6 modules implicitly assume "web app with users."
   When that assumption is wrong, 2-3 modules try to score a void.

2. **No N/A scoring path.** Every module's rubric forces a 0-10. There
   is no honest answer to "score a video-rendering project on customer
   flow" inside the current rubric. Either the module needs an N/A
   verdict, or the parent skill needs to skip irrelevant modules at
   dispatch time.

3. **Phase 1 (semgrep) and Phase 2 dispatch don't degrade gracefully
   on tiny repos.** 8 source files do not need 6 parallel sub-agents.
   The methodology implicitly assumes the audit is worth its own
   process budget. For repos under ~500 LOC, an inline single-agent
   pass is the honest call.

4. **The Roast module is the most portable.** Positioning, README
   quality, CTA copy — these apply to any repo with a human-readable
   surface. It worked here without modification. That's the canary:
   the more universal a module's premise, the less it needs special-
   casing.

**Recommendation:** add a Phase 0.5 — "project shape" — that classifies
into `{web-app, cli, library, render-pipeline, mobile, infra}` and
dispatches only the applicable modules. Default to all 6 when
ambiguous. Surface the skipped modules at the top of the output ("3
modules skipped: this repo is a render-pipeline, not a web app") so
the user knows the skill noticed, rather than fading them out without
explanation.

# /roast v0.2 — validation re-test against `roastrebuild-remotion`

**Target:** `/Users/janderswag/Desktop/roastrebuild-remotion` — same Remotion
video-rendering project that produced the v0.1 stress-test transcript
(`examples/roast-remotion.md`).

**Purpose of this run:** verify that the v0.2 methodology fixes
(Phase 0.5 shape classifier, N/A return contracts, inline-dispatch for
small repos, fast-exit, clean-zero semgrep template) actually produce
cleaner output than the v0.1 baseline. Same repo, new methodology.

---

```
[detecting stack...]
✓ Node / TypeScript (package.json + tsconfig.json)
✓ Remotion 4.x (@remotion/bundler, @remotion/cli, remotion in deps)
✓ React 18.3 (Remotion's component runtime — no DOM root)
✓ No git repo (no .git directory). No README. No .gitignore. No .env*.
✓ 8 source files, 431 LOC total
  (src/*.tsx + src/components/*.tsx + src/data/storyboard.ts +
   remotion.config.ts)
✓ Deploy target: local CLI render only — npm run render:* writes mp4s
  to out/. No server, no API, no auth, no DB, no payments, no users.

[project shape: render-pipeline]
✓ Detection: `remotion`, `@remotion/bundler`, `@remotion/cli` in
  dependencies. No auth deps. No payment deps. No public-facing routes.
  Matches the Phase 0.5 `render-pipeline` row exactly.
✓ Dispatching: Roast + Architecture (2 modules)
✓ Skipping:
  - Security — no trust surface (no auth, payments, secrets, API)
  - Customer Flow — no users to activate
  - Growth — no public-facing acquisition surface

[dispatch strategy: inline single-pass]
✓ 431 LOC < 1000 LOC threshold AND only 2 real modules selected.
  Six parallel sub-agents reading the same 8 files is overhead
  theatre on a repo this small. Running inline.

[semgrep running...]
✓ 0 findings (semgrep ran clean — pattern-level scan found nothing).
  13 files scanned in ~0.23s against p/security-audit, p/owasp-top-ten,
  p/secrets. Clean — no padding.

[2 modules running inline...]

✓ Roast                    done
✓ Architecture             score 6/10
✓ Security                 N/A — skipped (no trust surface)
✓ Customer Flow            N/A — skipped (no user flow to trace)
✓ Growth                   N/A — skipped (no public surface)
✓ Founder Briefing         done

Total: ~22s wall-clock. Fast-exit case — short audit on small repo is
the correct output, not a failure.
```

---

## THE ROAST

You don't have a README. Your `package.json` description reads
"RoastRebuild animated marketing video assembly (Remotion)" — which is
accurate, which is the problem, because that's the only sentence anyone
walking up to this repo gets. The CTA card in
`src/components/CTACard.tsx:49-60` yells "Roast your startup before it
burns down" — clear, on-brand, the kind of line your other repo (the
actual SaaS) is too polite to write on its own landing page. Meanwhile
13 of 15 shots in `src/data/storyboard.ts:31-94` ship with
`mjFrameUrl: null` and `runwayClipUrl: null`, which means this "3-Act
short" currently renders as 14 placeholder frames of the same
burning-server-room PNG with one real Runway clip slotted into S2.1.
You're not shipping a video yet; you're shipping a Remotion harness
waiting for Midjourney to finish its job. Name that. Don't run
`npm run render:full` and expect a finished video — the storyboard data
layer is honestly telling you it isn't one.

---

## SECURITY (N/A)

Skipped — no trust surface in this codebase. The Security module audits
auth flows, payment handlers, exposed secrets, SSRF, and CORS posture;
this project has none of those concerns. No auth deps in
`package.json`. No payment integration. No `.env*` file. No API routes.
No DB. No outbound HTTP from runtime (only Remotion's own asset fetches
for `<Img>` and `<Video>`). Semgrep ran clean on all three rulesets.

Re-run `/roast` after auth, payments, or a server surface lands.

(Two one-line observations the scan surfaced but that are NOT
vulnerabilities: no `.gitignore` exists yet — worth adding before any
`.env` ever does, and `src/data/storyboard.ts:46` embeds a Runway
pre-signed CloudFront JWT URL that will silently 403 when its expiry
hits in late 2026. Both are operational gotchas, not security findings.
Logged here only so you see them; they don't move the N/A verdict.)

---

## ARCHITECTURE (6/10)

Remotion is a React-renders-to-video framework. The architecture
question for this repo is not "will it scale to 10k users" (there are
no users) but "will it scale to 50 shots, multiple compositions, and
an asset pipeline that doesn't break when Midjourney URLs rotate."
Against that question, the design is reasonable for v1 and has three
real smells:

- **`src/data/storyboard.ts:1-3` declares itself a manual mirror of
  the Notion Storyboard DB.** That's correct for 15 shots; it stops
  being correct around shot 30, when the manual TS-vs-Notion drift
  becomes a real bug surface (wrong durations, wrong dialogue, stale
  URLs). Project memory confirms a Notion DB already exists upstream.
  Fix: a `scripts/sync-storyboard.ts` that pulls from the Notion API
  and writes `src/data/storyboard.generated.ts`, with the generated
  file gitignored. 1–2 days of work, pays back forever.

- **`src/components/ShotSequence.tsx:18` falls back to `PLACEHOLDER_URL`
  silently when `mjFrameUrl` is null.** Right now 13 of 15 shots fall
  back. Renders will look like they "worked" but produce the same image
  13 times. No warning, no shot ID logged on stderr.
  Fix: when `mjFrameUrl === null` AND `showShotId` is true, render a
  "PLACEHOLDER" badge over the frame so a quick scrub of the preview
  mp4 reveals what's done vs what isn't. The `ShotIdBadge` at
  `ShotSequence.tsx:43-61` is already the right place to extend.

- **No error path on `<Video src=...>` in `ShotSequence.tsx:22-26`.**
  When the Runway pre-signed URL at `storyboard.ts:46` expires (the
  JWT decodes to mid-2026 expiry), or when the CDN returns anything
  non-200, Remotion will render a black frame and the render job will
  silently succeed. Fix: render the still `<Img>` as a layer behind
  every `<Video>` so any fetch failure degrades gracefully to the
  still frame rather than to black.

**Other smells:**

- `src/BurningServerRoom.tsx:4` hard-codes the same MJ scene URL as
  `src/data/storyboard.ts:27`'s `PLACEHOLDER_URL`. Two copies of the
  same constant; one will drift. Move to a shared `src/constants.ts`
  or have `BurningServerRoom.tsx` import `PLACEHOLDER_URL` from
  `data/storyboard.ts`.

- `src/components/CTACard.tsx:22`, `DialogueOverlay.tsx:28`, and
  `BurningServerRoom.tsx:38` each declare their own
  `"Inter, ... sans-serif"` font stack inline. Three copies. Pull
  into a `FONT_STACK` constant once you add a 16th component.

SCALE CEILING

First wall: the storyboard data file at ~30 shots.
  Why: src/data/storyboard.ts is hand-edited. At 30+ shots the
       Notion-source ↔ TS-mirror drift becomes the dominant debugging
       cost on this repo (wrong dialogue line shipped because Notion
       was edited three days ago and the TS file wasn't).
  Fix: codegen the storyboard from Notion. `scripts/sync-storyboard.ts`
       pulling from Notion API → `storyboard.generated.ts`. 1–2 days.

Second wall: render time + asset availability when all 15 Runway clips land.
  Why: `remotion render` is CPU-bound and re-downloads every <Video>
       and <Img> URL per render. 15 cloud-hosted clips × N renders =
       minutes per build and depends on Runway's CDN being up. The JWT
       at storyboard.ts:46 will also silently expire mid-2026.
  Fix: a `scripts/prefetch-assets.ts` that downloads all clips to
       `public/assets/` once and rewrites URLs to
       `staticFile("assets/...")`. Also fixes the JWT-expiry problem.

---

## CUSTOMER FLOW (N/A)

Skipped — no auth or signup surface in this codebase. The Customer Flow
module audits SaaS activation paths (landing → signup → first value);
this project type doesn't have one. No `User`/`Session`/`Account`
concept exists in the source. The audited artifact is a 15-shot video
composition, not a user-facing product.

Re-run `/roast` on the public-facing app if you want a customer-flow
audit of the parent project.

---

## GROWTH (N/A)

Skipped — no public-facing acquisition surface. The Growth module
audits discoverability, analytics, sharing, and SEO, all of which
assume a user lands on a URL. This project doesn't have URLs — it
renders mp4 files to `out/`.

The one growth-adjacent observation worth naming: the *output* of this
repo (the rendered video) IS a growth artifact for the parent SaaS,
and the CTA at `src/components/CTACard.tsx:49-72` is on-brand
("Roast your startup before it burns down" + "RoastRebuild.com" in
the brand cyan #2EC4B6). That's the entire growth surface, and it's
already correct. No audit needed.

---

## FOUNDER BRIEFING

This isn't a SaaS — it's a 431-LOC Remotion harness whose job is to
render one 15-shot vertical short that drives traffic to your actual
product. The v0.2 shape classifier correctly flagged it as a
render-pipeline and skipped four modules that would have measured a
void. Two modules genuinely apply: Architecture (real, real smells,
6/10), and The Roast (positioning is universal — the README gap is
the real finding, not the code).

What's working: the abstraction at `src/data/storyboard.ts` is the
right call — separating shot data from render code means when MJ
frames and Runway clips land, the only edits are in one file. The
Sequence-based composition in `BurningServerRoomFull.tsx:14-41` is
the idiomatic Remotion pattern and sets you up to scale to 30+ shots
without rewriting the orchestrator. The CTACard is on-brand and
ready to drop in.

The order matters more than the count: ship the
storyboard-from-Notion sync before you cross 20 shots, because the
manual mirror starts costing you debugging time the moment the Notion
DB and the TS file disagree. Asset prefetching unblocks reliable
rendering AND solves the JWT-expiry trap. A README and `git init`
land in 10 minutes and bring this from "found on disk" to "shippable
artifact."

────────────────────────────────────────────────────

## TOP-3 PRIORITIES (ordered by what costs you most)

1. **[MEDIUM] `src/data/storyboard.ts:1-3` — manual mirror of the
   Notion storyboard DB.** The header comment says this file mirrors
   Notion; nothing in the code enforces that. As you cross ~20 shots,
   "which one is right, the TS or the Notion?" becomes the dominant
   debugging cost on this repo. You'll catch it the day a render uses
   a stale dialogue line that was edited in Notion three days ago.
   Fix: `scripts/sync-storyboard.ts` pulling from Notion API into a
   `src/data/storyboard.generated.ts`, source file gitignored, run on
   pre-build.

2. **[MEDIUM] `src/components/ShotSequence.tsx:18-34` — silent
   placeholder fallback + no `<Video>` error path.** 13 of 15 shots
   currently render the same placeholder PNG with no visual indicator.
   Preview output *looks* like a working video, hiding how much of
   the storyboard is still unimplemented. When the Runway JWT at
   `storyboard.ts:46` expires, the same silent-success failure mode
   hits S2.1.
   Fix: render a "PLACEHOLDER" badge over fallback frames when
   `showShotId` is true; layer the still `<Img>` underneath every
   `<Video>` so CDN failures degrade to a still rather than black.

3. **[INFO] Repo root: no `git init`, no `README.md`, no `.gitignore`.**
   Not a vulnerability today, but the lowest-effort highest-ROI fix on
   the list. Anyone (including future-you) walking up to this directory
   has to read source to understand what it does, and the moment a
   Notion API key or R2 token gets stuffed in `.env`, there's no
   gitignore to catch it.
   Fix: `git init && printf "node_modules/\nout/\n.env*\nsrc/data/storyboard.generated.ts\n" > .gitignore`
   and a 6-line README pointing at `npm run render:full-preview`.

---

Want this on your live URL with screenshots, Lighthouse, axe-core,
competitor teardown, and the 90-day founder roadmap?
→ https://roastrebuild.com/review — $19

---

## v0.2 validation notes (meta — for the skill author)

This run is the AFTER for the v0.1→v0.2 comparison. The BEFORE is
`examples/roast-remotion.md` in the parent directory. Side-by-side:

| Aspect | v0.1 (before) | v0.2 (after) |
|---|---|---|
| Project-shape detection | absent — all 6 modules dispatched | Phase 0.5 picked `render-pipeline` from Remotion deps, dispatched 2 |
| Security on no-trust-surface | forced 9/10 with a "methodology note" caveat explaining why the score is wrong | N/A header, one short paragraph, no score |
| Customer Flow on no-users | text said "N/A" but the checklist still listed it as a module that ran | N/A header from Phase 0.5, explicit "skipped" on checklist line |
| Growth on no-public-surface | same — informal N/A in prose, formal score absent without rubric support | N/A header, formal skip path |
| Dispatch strategy | 6 parallel sub-agents implied | inline single-pass for 431 LOC + 2 real modules |
| Wall-clock | ~25s (with parallel overhead) | ~22s (inline, no agent spin-up tax) |
| Padding | none in v0.1 either — the human grader pre-cleaned | none — but now structural, not editorial |
| Stress-test verdict section | yes — explicit "4 methodology gaps" written into the artifact | absent — gaps are closed, no meta-section needed |

The v0.1 transcript ended with a "Recommendation: add Phase 0.5"
section. v0.2 closes that loop. The same recommendation does not need
to be written again.

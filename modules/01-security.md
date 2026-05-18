# Module: Security + exposed-key scan

The trust-critical module. Combines semgrep ground-truth findings
(deterministic AST matches) with LLM analysis for issues semgrep
can't model — auth flow logic, business-rule access control,
SSRF in URL-handling code, secret-rotation hygiene.

## Inputs you have

- Semgrep findings from Phase 1 of the parent skill (passed in your
  prompt). Each finding includes `rule_id`, `path`, `line`, `severity`,
  `message`. These are **ground truth** — semgrep matched its rule
  against the actual code. Adopt them. Don't second-guess unless
  you can verify the matched code is genuinely a false positive.
- Stack context from Phase 0 — tells you which auth library is in
  use (passport, NextAuth, Lucia, Clerk, Supabase, etc.), what the
  DB is, what the deployment target is.

## What to audit (in priority order)

1. **Semgrep findings — adopt and explain.** For each semgrep finding,
   read the surrounding code via `Read`, confirm the match is real,
   and translate the rule_id into plain English. State the concrete
   impact ("anyone who knows your endpoint URL can submit fake events
   and your DB will provision paid features").

2. **Authentication — read the auth code path.** Find the login route,
   the session-management code, the middleware that protects authed
   routes. Look for:
   - Hardcoded secrets / fallback values (`JWT_SECRET || "dev-secret"`)
   - Missing CSRF protection on state-changing routes
   - Session cookie missing `httpOnly`, `secure`, `SameSite`
   - No rate limit on `/api/login` or password reset
   - Password regex weaker than NIST 800-63B (allow long passwords,
     not arbitrary complexity rules)

3. **Payment handlers — Stripe / Paddle / Lemon Squeezy.** Find any
   webhook handler. The single most common production bug in
   AI-generated payment code: **no signature verification on the
   webhook body.** Confirm `constructEvent()` or equivalent runs
   before any DB write.

4. **API routes that accept URLs from users — SSRF.** If any route
   takes a URL parameter and fetches it, look for:
   - No allowlist or denylist of hostnames
   - No check for private IP ranges (RFC1918, 169.254, ::1, etc.)
   - No timeout on the outbound fetch
   - No redirect-chain validation (attacker can return 302 to
     internal services)

5. **Exposed secrets.** Search via `Grep` (NOT `Bash cat`) for:
   - `sk_live_`, `sk_test_` (Stripe)
   - `AKIA[A-Z0-9]{16}` (AWS access keys)
   - `ghp_`, `github_pat_` (GitHub PATs)
   - `xoxb-`, `xoxp-` (Slack)
   - `sk-ant-` (Anthropic)
   - `re_` (Resend)
   - `pk_live_` outside of designated public client config
   Verify `.gitignore` excludes `.env*` (except `.env.example`).
   Check `git log -p --all -S "sk_live_"` if git history is short
   enough to scan in reasonable time.

6. **CORS / CSP / Security headers.** Look at the framework config
   (`next.config.mjs`, `vercel.json`, `nginx.conf`, middleware files).
   Flag wildcard CORS with credentials. Flag missing CSP entirely
   (don't nitpick weak CSP — that's not the free skill's job).

## Hard rules

1. **Adopt every HIGH-severity semgrep finding** unless you can read
   the code and confirm it's genuinely a false positive (test fixture,
   intentionally insecure example for docs, etc.). When you adopt,
   cite the rule_id in your finding.

2. **Never read `.env*` files.** You may verify their presence and
   their `.gitignore` coverage. You may NOT read their contents.

3. **Cite `path:line` on every finding.** Use `Read` or `Grep -n` to
   get exact line numbers. "Somewhere in lib/auth.ts" is not a
   finding.

4. **Severity tagging:** CRITICAL = active exploit possible right now.
   HIGH = exploit possible with one extra step (knowing an endpoint,
   guessing an ID). MEDIUM = best-practice gap with real attack value.
   INFO = hardening recommendation, not a vulnerability.

5. **Don't pad.** A 3-finding security section that's all real is
   better than a 12-finding one with 9 "consider adding HSTS" filler.
   The user has a deterministic semgrep section above; your value-add
   is the logic-level findings semgrep can't see.

6. **DoS / rate-limiting findings are MEDIUM max** unless the rate
   limit absence directly enables a CRITICAL (e.g. no rate limit on
   `/api/login` = credential-stuffing surface = HIGH).

## False-positive rules

Don't flag these (carryover from R&R's main /cso methodology):

- React/Vue/Svelte XSS unless via `dangerouslySetInnerHTML`,
  `v-html`, `{@html ...}`, or `innerHTML` — these frameworks
  escape by default.
- User content in the user-message position of an LLM call is NOT
  prompt injection. Only flag when user content lands in the system
  prompt or tool schema.
- Insecure randomness in non-security contexts (UI element IDs,
  cache-buster query params).
- Missing audit logs are not a vulnerability — absence of logging
  is hardening, not a CVE.
- Test files (`*.test.*`, `*.spec.*`, `__tests__/`, `tests/`) are
  out of scope unless they're imported from non-test code.

## Output format

```
SECURITY (N/10)

[2-3 sentence overall verdict — what's the security posture in
plain English. Lead with the worst thing.]

• [SEVERITY] <one-line title>
  <path>:<line>
  <2-3 sentence explanation: what's wrong, what's the concrete
  exploit path, what's the impact in dollars/users/data>
  Fix: <one-line action — the actual code change, not "add validation">

• [SEVERITY] <one-line title>
  ...

[Optional: "N MEDIUM findings worth a sprint:" followed by a brief
bullet list of medium-severity findings without the full explanation.
Use when there are 4+ mediums to keep the section readable.]
```

## Scoring rubric (0-10)

- **10** — Nothing actionable found. Webhooks verified, auth bulletproof,
  no exposed secrets, CSP/CORS tight. (Rare. If you give a 10, double-
  check.)
- **8-9** — Solid. 1-2 MEDIUM findings tops. No HIGHs.
- **6-7** — Real gaps but no immediate critical exposure. 1 HIGH at
  most, several MEDIUMs.
- **4-5** — 2+ HIGHs OR a CRITICAL. Founder needs to fix this week.
- **2-3** — Multiple CRITICALs OR an active credential exposure in git
  history.
- **0-1** — Active live exploit (e.g. plaintext production credentials
  visible in current HEAD). Stop normal output and lead with the
  emergency action.

## What this module DOES NOT do

- Doesn't run a network scan (we promised local-only).
- Doesn't recommend specific WAF / SOC vendors.
- Doesn't audit infra/cloud config beyond what's in the repo
  (no AWS API calls, no GCP introspection).
- Doesn't run dependency CVE checks beyond what semgrep covers
  (no `npm audit` invocation — the user can run that themselves;
  noisy output adds little signal).

## Return value

The output block above, ready for the parent skill to paste into
the final audit transcript.

import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import type { Finding, Severity } from '../types.js';
import type { Verifier, VerifierContext } from '../verifier.js';
import { errored, ok, skipped } from '../verifier.js';
import { ensurePlaywrightInstalled } from '../live-install.js';
import type {
  PwChromiumModule,
  PwBrowser,
  PwPage,
  PwResponseLike,
  PwRequest,
} from '../playwright-types.js';

const PAGE_LOAD_TIMEOUT_MS = 45_000;
const VIEWPORT = { width: 1280, height: 800 } as const;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 roast-runner/0.5';
const MAX_AXE_VIOLATIONS_REPORTED = 15;
const MAX_CONSOLE_ERRORS_REPORTED = 10;
const MAX_FAILED_REQUESTS_REPORTED = 10;

const AxeNode = z.object({ target: z.array(z.string()).optional(), html: z.string().optional() }).passthrough();
const AxeViolation = z
  .object({
    id: z.string(),
    impact: z.enum(['critical', 'serious', 'moderate', 'minor']).nullable().optional(),
    help: z.string().optional(),
    description: z.string().optional(),
    helpUrl: z.string().optional(),
    nodes: z.array(AxeNode).optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();
const AxeResult = z.object({ violations: z.array(AxeViolation) }).passthrough();

export const liveBrowserVerifier: Verifier = {
  name: 'live-browser',

  async isAvailable(ctx: VerifierContext) {
    if (ctx.url === undefined) {
      return { available: false, reason: '--url not provided' };
    }
    return { available: true };
  },

  async run(ctx: VerifierContext) {
    const started = performance.now();
    if (ctx.url === undefined) {
      return skipped('live-browser', '--url not provided', 0);
    }

    const install = await ensurePlaywrightInstalled({
      cacheDir: ctx.cacheDir,
      signal: ctx.signal,
      onProgress: (msg) => process.stderr.write(`${msg}\n`),
    });
    if (!install.ready) {
      return skipped('live-browser', install.reason ?? 'playwright install incomplete', Math.round(performance.now() - started));
    }

    let browser: PwBrowser | undefined;
    try {
      process.env['PLAYWRIGHT_BROWSERS_PATH'] = install.browsersDir;
      const pwIndex = join(install.playwrightPkgDir, 'index.js');
      if (!existsSync(pwIndex)) {
        return errored('live-browser', `playwright-chromium entrypoint missing at ${pwIndex}`, Math.round(performance.now() - started));
      }
      const mod = await import(pathToFileURL(pwIndex).href);
      const pw = ((mod as { default?: PwChromiumModule }).default ?? mod) as PwChromiumModule;

      browser = await pw.chromium.launch({ headless: true, timeout: 30_000 });
      const browserCtx = await browser.newContext({ viewport: VIEWPORT, userAgent: USER_AGENT });
      const page = await browserCtx.newPage();

      const consoleErrors: { type: string; text: string; url: string; line: number }[] = [];
      const pageErrors: { name: string; message: string }[] = [];
      const failedRequests: { url: string; method: string; reason: string; resourceType: string }[] = [];
      let mainResponse: PwResponseLike | null = null;

      page.on('console', (msg) => {
        const t = msg.type();
        if (t === 'error' || t === 'warning') {
          const loc = msg.location();
          consoleErrors.push({ type: t, text: msg.text().slice(0, 500), url: loc.url, line: loc.lineNumber });
        }
      });
      page.on('pageerror', (err) => {
        pageErrors.push({ name: err.name, message: err.message.slice(0, 500) });
      });
      page.on('requestfailed', (req: PwRequest) => {
        const fail = req.failure();
        if (!fail) return;
        if (req.resourceType() === 'image' && req.url().includes('favicon')) return; // noisy + low-value
        failedRequests.push({
          url: req.url().slice(0, 400),
          method: req.method(),
          reason: fail.errorText.slice(0, 200),
          resourceType: req.resourceType(),
        });
      });
      page.on('response', (res: PwResponseLike) => {
        if (mainResponse === null) mainResponse = res;
      });

      const response = await page.goto(ctx.url, { waitUntil: 'networkidle', timeout: PAGE_LOAD_TIMEOUT_MS }).catch(
        (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`page.goto failed: ${msg}`);
        },
      );
      // Prefer the main navigation response over arbitrary first response.
      const finalResponse = response ?? mainResponse;

      const axeViolations = await runAxe(page).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[live-browser] axe injection/run failed: ${msg}\n`);
        return [] as z.infer<typeof AxeViolation>[];
      });

      const screenshotDir = await captureScreenshots(page, ctx.url).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[live-browser] screenshot failed: ${msg}\n`);
        return undefined;
      });

      const findings: Finding[] = [];
      const pagePath = pathFromUrl(ctx.url);

      pushNavigationFinding(findings, pagePath, finalResponse, ctx.url);
      pushSecurityHeaderFindings(findings, pagePath, finalResponse);
      pushPageErrorFindings(findings, pagePath, pageErrors);
      pushConsoleErrorFindings(findings, pagePath, consoleErrors);
      pushFailedRequestFindings(findings, pagePath, failedRequests);
      pushAxeFindings(findings, pagePath, axeViolations);

      if (screenshotDir !== undefined) {
        process.stderr.write(`[live-browser] screenshots saved: ${screenshotDir}\n`);
      }

      return ok('live-browser', findings, Math.round(performance.now() - started));
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      const msg = err instanceof Error ? err.message : String(err);
      return errored('live-browser', msg, elapsed);
    } finally {
      await browser?.close().catch(() => undefined);
    }
  },
};

async function runAxe(page: PwPage): Promise<readonly z.infer<typeof AxeViolation>[]> {
  const axePath = join(__dirname, 'axe.min.js');
  const axeSource = await readFile(axePath, 'utf8');
  await page.addScriptTag({ content: axeSource });
  const raw = await page.evaluate(`(async () => {
    if (typeof window.axe === 'undefined') return { violations: [] };
    const r = await window.axe.run({ resultTypes: ['violations'], runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } });
    return { violations: r.violations };
  })()`);
  const parsed = AxeResult.safeParse(raw);
  return parsed.success ? parsed.data.violations : [];
}

async function captureScreenshots(page: PwPage, url: string): Promise<string> {
  const slug = url.replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
  const dir = join(tmpdir(), `roast-${Date.now()}-${slug}`);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, 'viewport.png'), fullPage: false, type: 'png' });
  await page.screenshot({ path: join(dir, 'fullpage.png'), fullPage: true, type: 'png' });
  return dir;
}

function pathFromUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return u;
  }
}

function pushNavigationFinding(out: Finding[], path: string, response: PwResponseLike | null, url: string): void {
  if (response === null) {
    out.push({
      verifier: 'live-browser',
      ruleId: 'navigation/no-response',
      severity: 'critical',
      path,
      message: `no HTTP response received for ${url}`,
    });
    return;
  }
  const status = response.status();
  if (status >= 500) {
    out.push({
      verifier: 'live-browser',
      ruleId: `navigation/http-${status}`,
      severity: 'critical',
      path,
      message: `server error on main document: HTTP ${status}`,
    });
  } else if (status >= 400) {
    out.push({
      verifier: 'live-browser',
      ruleId: `navigation/http-${status}`,
      severity: 'high',
      path,
      message: `main document returned HTTP ${status}`,
    });
  }
}

interface SecurityHeaderCheck {
  readonly header: string;
  readonly severity: Severity;
  readonly fix: string;
}

const SECURITY_HEADER_CHECKS: ReadonlyArray<SecurityHeaderCheck> = [
  { header: 'content-security-policy', severity: 'high', fix: 'set a CSP header (start with `Content-Security-Policy: default-src \'self\'`) to mitigate XSS and data exfiltration' },
  { header: 'strict-transport-security', severity: 'medium', fix: 'add HSTS: `Strict-Transport-Security: max-age=31536000; includeSubDomains`' },
  { header: 'x-content-type-options', severity: 'low', fix: 'add `X-Content-Type-Options: nosniff` to block MIME-type sniffing' },
  { header: 'referrer-policy', severity: 'low', fix: 'set `Referrer-Policy: strict-origin-when-cross-origin` to limit referer leakage' },
  { header: 'x-frame-options', severity: 'medium', fix: 'add `X-Frame-Options: DENY` or CSP `frame-ancestors` to prevent clickjacking' },
];

function pushSecurityHeaderFindings(out: Finding[], path: string, response: PwResponseLike | null): void {
  if (response === null) return;
  const headers = response.headers();
  const lowered: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lowered[k.toLowerCase()] = v;

  for (const check of SECURITY_HEADER_CHECKS) {
    if (!(check.header in lowered)) {
      out.push({
        verifier: 'live-browser',
        ruleId: `security-header/missing/${check.header}`,
        severity: check.severity,
        path,
        message: `missing security header \`${check.header}\` on main document`,
        fix: check.fix,
      });
    }
  }
}

function pushPageErrorFindings(out: Finding[], path: string, errors: ReadonlyArray<{ name: string; message: string }>): void {
  for (const e of errors.slice(0, MAX_CONSOLE_ERRORS_REPORTED)) {
    out.push({
      verifier: 'live-browser',
      ruleId: 'js/uncaught-exception',
      severity: 'high',
      path,
      message: `uncaught ${e.name}: ${e.message}`,
    });
  }
}

function pushConsoleErrorFindings(out: Finding[], path: string, errors: ReadonlyArray<{ type: string; text: string; url: string; line: number }>): void {
  const onlyErrors = errors.filter((e) => e.type === 'error');
  for (const e of onlyErrors.slice(0, MAX_CONSOLE_ERRORS_REPORTED)) {
    out.push({
      verifier: 'live-browser',
      ruleId: 'console/error',
      severity: 'medium',
      path: e.url || path,
      line: e.line > 0 ? e.line : undefined,
      message: `console error: ${e.text}`,
    } as Finding);
  }
}

function pushFailedRequestFindings(out: Finding[], path: string, failed: ReadonlyArray<{ url: string; method: string; reason: string; resourceType: string }>): void {
  for (const f of failed.slice(0, MAX_FAILED_REQUESTS_REPORTED)) {
    out.push({
      verifier: 'live-browser',
      ruleId: `network/failed/${f.resourceType}`,
      severity: f.resourceType === 'script' || f.resourceType === 'stylesheet' ? 'high' : 'medium',
      path,
      message: `${f.method} ${f.url} failed: ${f.reason} (${f.resourceType})`,
    });
  }
}

function pushAxeFindings(out: Finding[], path: string, violations: ReadonlyArray<z.infer<typeof AxeViolation>>): void {
  const sorted = [...violations].sort((a, b) => axeImpactRank(b.impact) - axeImpactRank(a.impact));
  for (const v of sorted.slice(0, MAX_AXE_VIOLATIONS_REPORTED)) {
    const impactSev = axeImpactToSeverity(v.impact);
    const nodes = v.nodes ?? [];
    const target = nodes[0]?.target?.[0];
    const evidence = nodes[0]?.html?.slice(0, 200);
    out.push({
      verifier: 'live-browser',
      ruleId: `axe/${v.id}`,
      severity: impactSev,
      path: target ? `${path} ${target}` : path,
      message: `a11y: ${v.help ?? v.id}${nodes.length > 1 ? ` (${nodes.length} occurrences)` : ''}`,
      evidence,
      fix: v.helpUrl,
    } as Finding);
  }
}

function axeImpactRank(impact: 'critical' | 'serious' | 'moderate' | 'minor' | null | undefined): number {
  switch (impact) {
    case 'critical': return 4;
    case 'serious': return 3;
    case 'moderate': return 2;
    case 'minor': return 1;
    default: return 0;
  }
}

function axeImpactToSeverity(impact: 'critical' | 'serious' | 'moderate' | 'minor' | null | undefined): Severity {
  switch (impact) {
    case 'critical': return 'high';
    case 'serious': return 'high';
    case 'moderate': return 'medium';
    case 'minor': return 'low';
    default: return 'low';
  }
}

// Browser type declaration for the page.evaluate context. Not used at runtime
// in Node — only for TypeScript in the evaluate() string body if we used a
// function literal. Kept here as documentation.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace globalThis {
    interface Window {
      axe?: {
        run(opts?: unknown): Promise<{ violations: unknown[] }>;
      };
    }
  }
}

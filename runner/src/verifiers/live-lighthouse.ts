import { z } from 'zod';
import type { Finding, Severity } from '../types.js';
import type { Verifier, VerifierContext } from '../verifier.js';
import { errored, ok, skipped } from '../verifier.js';

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

const Audit = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    score: z.number().nullable().optional(),
    displayValue: z.string().optional(),
    numericValue: z.number().optional(),
    numericUnit: z.string().optional(),
  })
  .passthrough();

const Category = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    score: z.number().nullable().optional(),
  })
  .passthrough();

const PsiResponse = z
  .object({
    lighthouseResult: z
      .object({
        finalDisplayedUrl: z.string().optional(),
        categories: z
          .object({
            performance: Category.optional(),
            accessibility: Category.optional(),
            'best-practices': Category.optional(),
            seo: Category.optional(),
          })
          .passthrough(),
        audits: z.record(Audit),
      })
      .passthrough(),
  })
  .passthrough();

export const liveLighthouseVerifier: Verifier = {
  name: 'live-lighthouse',

  async isAvailable(ctx: VerifierContext) {
    if (ctx.url === undefined) {
      return { available: false, reason: '--url not provided' };
    }
    return { available: true };
  },

  async run(ctx: VerifierContext) {
    const started = performance.now();
    if (ctx.url === undefined) {
      return skipped('live-lighthouse', '--url not provided', 0);
    }

    try {
      const psiUrl = buildPsiUrl(ctx.url, process.env['ROAST_PSI_API_KEY']);
      const response = await fetch(psiUrl, {
        signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(ctx.timeoutMs)]),
        headers: { 'User-Agent': 'roast-runner/0.5.0' },
      });

      if (!response.ok) {
        const bodySnippet = (await response.text().catch(() => '')).slice(0, 500);
        return errored(
          'live-lighthouse',
          `PSI returned HTTP ${response.status}${bodySnippet ? `: ${bodySnippet}` : ''}`,
          Math.round(performance.now() - started),
        );
      }

      const raw: unknown = await response.json();
      const findings = parsePsiResponse(raw, ctx.url);
      return ok('live-lighthouse', findings, Math.round(performance.now() - started));
    } catch (err) {
      const elapsed = Math.round(performance.now() - started);
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        return errored('live-lighthouse', `aborted or timed out after ${ctx.timeoutMs}ms`, elapsed);
      }
      const msg = err instanceof Error ? err.message : String(err);
      return errored('live-lighthouse', msg, elapsed);
    }
  },
};

function buildPsiUrl(targetUrl: string, apiKey: string | undefined): string {
  const u = new URL(PSI_ENDPOINT);
  u.searchParams.set('url', targetUrl);
  u.searchParams.set('strategy', 'mobile');
  for (const c of ['performance', 'accessibility', 'best-practices', 'seo']) {
    u.searchParams.append('category', c);
  }
  if (apiKey && apiKey.length > 0) u.searchParams.set('key', apiKey);
  return u.toString();
}

export function parsePsiResponse(raw: unknown, targetUrl: string): readonly Finding[] {
  const parsed = PsiResponse.safeParse(raw);
  if (!parsed.success) return [];

  const lr = parsed.data.lighthouseResult;
  const path = pathFromUrl(targetUrl);
  const findings: Finding[] = [];

  pushCategoryFinding(findings, path, 'performance', lr.categories.performance?.score, ['performance']);
  pushCategoryFinding(findings, path, 'accessibility', lr.categories.accessibility?.score, ['accessibility']);
  pushCategoryFinding(findings, path, 'best-practices', lr.categories['best-practices']?.score, ['best-practices']);
  pushCategoryFinding(findings, path, 'seo', lr.categories.seo?.score, ['seo']);

  pushWebVital(findings, path, 'largest-contentful-paint', lr.audits['largest-contentful-paint'], 2500, 4000);
  pushWebVital(findings, path, 'cumulative-layout-shift', lr.audits['cumulative-layout-shift'], 0.1, 0.25);
  pushWebVital(findings, path, 'total-blocking-time', lr.audits['total-blocking-time'], 200, 600);
  pushWebVital(findings, path, 'first-contentful-paint', lr.audits['first-contentful-paint'], 1800, 3000);

  return findings;
}

function pathFromUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return u;
  }
}

function pushCategoryFinding(
  out: Finding[],
  path: string,
  category: string,
  score: number | null | undefined,
  _tags: readonly string[],
): void {
  if (score === null || score === undefined) return;
  const pct = Math.round(score * 100);
  const severity = scoreSeverity(pct);
  if (severity === null) return;

  out.push({
    verifier: 'live-lighthouse',
    ruleId: `lighthouse/category/${category}`,
    severity,
    path,
    message: `Lighthouse ${category} score: ${pct}/100 (${severityLabel(severity)})`,
    fix: `target ≥90 ${category} score; see roastrebuild.com/review for prioritized fixes`,
  });
}

function pushWebVital(
  out: Finding[],
  path: string,
  auditId: string,
  audit: z.infer<typeof Audit> | undefined,
  goodMax: number,
  poorMin: number,
): void {
  if (!audit || audit.numericValue === undefined) return;
  const value = audit.numericValue;
  let severity: Severity;
  let label: string;
  if (value <= goodMax) {
    return; // good — no finding
  } else if (value >= poorMin) {
    severity = 'high';
    label = 'poor';
  } else {
    severity = 'medium';
    label = 'needs improvement';
  }

  const displayValue = audit.displayValue ?? formatNumeric(value, audit.numericUnit);
  const goodLabel = formatNumeric(goodMax, audit.numericUnit);

  out.push({
    verifier: 'live-lighthouse',
    ruleId: `lighthouse/${auditId}`,
    severity,
    path,
    message: `${audit.title ?? auditId}: ${displayValue} (${label} — Web Vitals threshold for "good" is ${goodLabel})`,
  });
}

function scoreSeverity(pct: number): Severity | null {
  if (pct >= 90) return null;
  if (pct >= 75) return 'low';
  if (pct >= 50) return 'medium';
  return 'high';
}

function severityLabel(s: Severity): string {
  return s === 'high' ? 'poor' : s === 'medium' ? 'needs improvement' : 'below target';
}

function formatNumeric(value: number, unit: string | undefined): string {
  if (unit === 'millisecond') {
    return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`;
  }
  if (unit === 'unitless') return value.toFixed(3);
  return `${value}${unit ? ` ${unit}` : ''}`;
}

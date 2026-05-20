import { SEVERITY_RANK, type Finding, type Severity } from './types.js';

/**
 * Per-finding diff entry. Carries the current and (when relevant)
 * previous severity for regression detection.
 */
export interface DeltaEntry {
  readonly finding: Finding;
  readonly previousSeverity?: Severity;
}

/**
 * Result of comparing the current audit run to the previous one.
 *
 * Categories:
 *   - `new`        — appeared this run (signature not in previous)
 *   - `persisted`  — same finding, same severity in both runs
 *   - `regressed`  — same finding, severity escalated (e.g., medium → high)
 *   - `improved`   — same finding, severity de-escalated (e.g., high → medium)
 *   - `fixed`      — was in previous, missing now (assumed resolved)
 *
 * `fixed` findings carry the PREVIOUS finding payload (since they're not
 * in the current report). UI typically renders these with a strikethrough
 * + "fixed" badge, then drops them on the next run.
 */
export interface Delta {
  readonly new: readonly DeltaEntry[];
  readonly persisted: readonly DeltaEntry[];
  readonly regressed: readonly DeltaEntry[];
  readonly improved: readonly DeltaEntry[];
  readonly fixed: readonly DeltaEntry[];
}

export interface DeltaSummary {
  readonly new: number;
  readonly persisted: number;
  readonly regressed: number;
  readonly improved: number;
  readonly fixed: number;
}

/**
 * Compute the delta between a current and previous set of findings.
 *
 * Findings without signatures (legacy data from v0.6.0 or earlier) are
 * treated as never-matching — they always show up in `new` for current
 * and `fixed` for previous. This is conservative but safe: the worst
 * case is over-reporting "new" findings on the first run after upgrading.
 *
 * Matching is by signature (deterministic hash). Severity comparison
 * uses {@link SEVERITY_RANK} (critical=4, info=0).
 */
export function computeDelta(
  current: readonly Finding[],
  previous: readonly Finding[],
): Delta {
  const previousBySig = new Map<string, Finding>();
  for (const f of previous) {
    if (f.signature !== undefined) previousBySig.set(f.signature, f);
  }

  const newOnes: DeltaEntry[] = [];
  const persisted: DeltaEntry[] = [];
  const regressed: DeltaEntry[] = [];
  const improved: DeltaEntry[] = [];

  const seenSigs = new Set<string>();
  for (const f of current) {
    if (f.signature === undefined) {
      newOnes.push({ finding: f });
      continue;
    }
    seenSigs.add(f.signature);
    const prev = previousBySig.get(f.signature);
    if (prev === undefined) {
      newOnes.push({ finding: f });
      continue;
    }
    const prevRank = SEVERITY_RANK[prev.severity];
    const currRank = SEVERITY_RANK[f.severity];
    if (currRank > prevRank) {
      regressed.push({ finding: f, previousSeverity: prev.severity });
    } else if (currRank < prevRank) {
      improved.push({ finding: f, previousSeverity: prev.severity });
    } else {
      persisted.push({ finding: f, previousSeverity: prev.severity });
    }
  }

  const fixed: DeltaEntry[] = [];
  for (const [sig, f] of previousBySig) {
    if (!seenSigs.has(sig)) {
      fixed.push({ finding: f });
    }
  }

  return { new: newOnes, persisted, regressed, improved, fixed };
}

/**
 * Reduce a Delta to its counts (for stderr summary / dashboards).
 */
export function summarizeDelta(delta: Delta): DeltaSummary {
  return {
    new: delta.new.length,
    persisted: delta.persisted.length,
    regressed: delta.regressed.length,
    improved: delta.improved.length,
    fixed: delta.fixed.length,
  };
}

/**
 * Human-readable one-liner for stderr. Example output:
 *
 *   Δ vs previous run: 3 new · 12 persisted · 2 regressed · 1 improved · 4 fixed
 *
 * Zero-count categories are omitted to keep the line tight on real audits.
 */
export function formatDeltaLine(delta: Delta): string {
  const s = summarizeDelta(delta);
  const parts: string[] = [];
  if (s.new > 0) parts.push(`${s.new} new`);
  if (s.persisted > 0) parts.push(`${s.persisted} persisted`);
  if (s.regressed > 0) parts.push(`${s.regressed} regressed`);
  if (s.improved > 0) parts.push(`${s.improved} improved`);
  if (s.fixed > 0) parts.push(`${s.fixed} fixed`);
  if (parts.length === 0) return 'Δ vs previous run: no changes';
  return `Δ vs previous run: ${parts.join(' · ')}`;
}

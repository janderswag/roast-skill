# Module: Architecture + scale-ceiling review

> **Status:** scaffold — methodology TODO. The placeholder below sets
> scope, output format, and scoring so the parent skill can dispatch
> this module today. Full methodology to be ported from
> R&R's `lib/review/prompts/architecturePrompt.ts`.

Audits code paths, identifies bottlenecks, flags the moment the
platform breaks at higher load. Returns a migration path.

## What this module does (sketch)

- Reads the data layer: ORM choice, DB driver, connection pooling
  (or lack thereof), query patterns.
- Reads the API surface: serverless function topology, function-
  per-route vs handler-per-file, edge runtime usage.
- Reads any background-job / queue infrastructure (or absence).
- Reads the deploy target (Vercel, Fly, Render, Railway, self-hosted)
  for runtime ceilings.
- Identifies the FIRST scale wall — the specific load level + the
  specific component that breaks first. Names it.

## Scoring rubric (0-10)

- **10** — Architecture matches the stated user base + 10x headroom.
  Clean separation, real queues, pooling, observability.
- **6-7** — Works fine today, has one known scale wall at 10-100x
  current load. Migration path is clear, not painful.
- **3-5** — Will hit walls at 2-5x current load. Migration is
  meaningful work (weeks).
- **0-2** — Already on fire. Single-process SQLite serving production
  traffic. No backups. No retry logic.

## Output format (target)

```
ARCHITECTURE (N/10)

[1-2 sentence overall verdict — where does it break first, at what
scale]

[Detailed paragraph: the scale wall, the choke point, the migration
path. Cite specific files / config / patterns.]

[Optional: "Other smells:" followed by 2-4 bullets on code-level
debt that doesn't fit the scale-wall narrative.]
```

## TODO for v0.2

- Port full methodology from `lib/review/prompts/architecturePrompt.ts`
- Add stack-specific heuristics (Vercel timeout, Postgres connection
  caps, SQLite write throughput, Cloudflare Worker memory limits)
- Add concrete examples for each scoring band

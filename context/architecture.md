# Architecture Context

## What SYPI is

A **system-engineering reasoning layer**, not an architecture-diagram generator.

The thesis: the gap between senior engineers and everyone else is not diagram
drawing — it is the discipline of establishing what is being built, what follows
from that, and what must never be true, *before* choosing technology. SYPI
performs that discipline and hands the result to whoever builds: an AI coding
agent, or a person.

The chain it runs, in order:

```
intent → requirements → capabilities → domain model → invariants
      → implications → architecture → review → validation → hand-off
```

Technology is the LAST step, never the first. "Users upload 2GB videos" does not
imply S3; it implies resumable upload, async processing, job state, progress and
recovery — and *those* imply object storage and a queue.

## The Universal System Specification (USS)

The USS is the canonical semantic representation. The canvas, the markdown spec,
the System Kit and the agent bundle are all **renderers of it**.

It is a **typed entity graph**, not a document with sections:

- `entities` — a discriminated union on `kind` (`requirement`, `capability`,
  `component`, `invariant`, `implication`, `finding`, …)
- `relations` — typed edges (`satisfies`, `requires`, `implies`, `governs`,
  `causedBy`, …), each with its own provenance
- Sections (`product`, `architecture`, `invariants`) are **views computed over the
  graph** (`lib/uss/views.ts`), never stored shapes

That shape is why each unit has been additive: introducing a new concept extends
one union and one id-prefix map, and touches no storage, no migration and no
existing view.

**Provenance is on every entity and every relation.** `KNOWN` / `INFERRED` /
`ASSUMPTION` / `UNKNOWN`, with confidence and evidence. `KNOWN` with no evidence
is downgraded at write time, so a model cannot assert its way to certainty.

### Where the reasoning lives

| Module | Responsibility |
| --- | --- |
| `lib/uss/schema.ts` | The graph contract. Never handed to a model. |
| `lib/uss/graph.ts` | Entity/relation operations, id allocation, traversal |
| `lib/uss/views.ts` | Sections as computed views |
| `lib/uss/store.ts` | Head + version log, optimistic concurrency, provenance enforcement |
| `lib/uss/gaps.ts` | Gap rules, integrity checks, tier-weighted completeness |
| `lib/uss/reasoning.ts` | The implication rulebook — deterministic |
| `lib/uss/domain.ts` | Invariant catalogue and domain integrity — deterministic |
| `lib/uss/scenarios.ts` | Failure-scenario validation — deterministic |
| `lib/uss/council.ts` | Discipline selection — deterministic |
| `lib/uss/render.ts` | Narrow prompt slices; empty sections never rendered |
| `lib/uss/reconcile.ts` / `project.ts` | Canvas ⇄ USS |
| `lib/capabilities/` | Capability taxonomy + the ambiguity question bank |
| `lib/ai/uss.ts` | The extraction passes (the only model-facing part) |

**The deterministic/probabilistic split is the core design decision.** Rules find
what a model forgets: the baseline measured a 26-component marketplace that
omitted payment idempotency and an order state machine. A rule never forgets, is
free, and is reproducible. Models are used only for judgement — extraction and
review — never for bookkeeping.

## Stack

| Layer           | Technology                | Role                                                    |
| --------------- | ------------------------- | ------------------------------------------------------- |
| Framework       | Next.js 16 + TypeScript   | Full-stack React framework, server components, API routes |
| UI              | Tailwind CSS 4 + shadcn/ui | Utility-first styling with accessible component primitives |
| Animation       | Framer Motion             | Micro-interactions and canvas transition animations       |
| Auth            | Clerk                     | Authentication, user management, session handling         |
| Database        | PostgreSQL + Prisma ORM   | Relational data — users, projects, metadata               |
| Real-time       | Liveblocks                | Collaborative canvas state, presence, cursors             |
| AI              | Vercel AI SDK v6          | Gemini (platform) + BYOK Anthropic / OpenAI / Google / NVIDIA |
| Storage         | Vercel Blob               | Generated spec files, project thumbnails                  |
| Deployment      | Vercel                    | Hosting, serverless functions, edge network               |

## System Boundaries

- `app/` — Next.js routes, layouts, pages, and API route handlers
- `app/api/` — Server-side API endpoints (project CRUD, AI triggers, spec export)
- `app/(auth)/` — Authentication pages (sign-in, sign-up) via Clerk
- `app/(root)/` — Authenticated app shell (dashboard, workspace)
- `components/` — Shared React components used across pages
- `components/ui/` — shadcn/ui primitives (do not edit directly)
- `components/canvas/` — Canvas-specific components (nodes, connections, toolbar)
- `lib/` — Shared utilities, API clients, helpers, Prisma client
- `lib/actions/` — Server actions for mutations
- `prisma/` — Database schema and migrations
- `lib/uss/` — the Universal System Specification: graph, store, rules, renderers
- `lib/capabilities/` — capability taxonomy and the ambiguity question bank
- `evals/` — the benchmark harness: 10 canonical briefs, scorers, baselines
- `context/` — Project context files (this system — not deployed)
- `public/` — Static assets (favicon, images)

## Storage Model

- **Database (PostgreSQL via Prisma)**: User records (synced from Clerk), project metadata (name, owner, timestamps, collaborators), project references
- **Liveblocks Storage**: Canvas state (nodes, connections, positions, labels) — this is the real-time source of truth for the canvas
- **Vercel Blob**: Generated Markdown spec files, project thumbnail images

## Auth and Access Model

- Every user authenticates via Clerk (OAuth or email)
- Clerk webhook syncs user data to the PostgreSQL database
- Every project has a single owner (the user who created it)
- Projects can have collaborators added by the owner
- Only the owner or a collaborator can view or mutate a project's canvas
- API routes and server actions enforce ownership/collaborator checks before any mutation
- Liveblocks room access is gated by project membership

## AI Model

**Trigger.dev was removed in Unit 4.** Every AI path now runs inline in a route and
streams NDJSON. That was not only simplification: a queued job with no worker
running never completed and never reported why, which was the documented source of
"stuck on analyzing". Inline + streaming makes progress visible and failure loud.

- Generation (`/api/ai/generate`) runs the understanding chain, then designs, then
  self-critiques and repairs once. Streams stage events.
- Review (`/api/ai/review`) runs the Engineering Council: reviewers selected
  deterministically, one call each, streamed per discipline.
- Chat (`/api/ai/chat`) is the conversational front door; heavy work goes through
  agent tools that wrap the same pipelines.
- `lib/ai/limits.ts` is the single choke point for every AI call: per-kind burst,
  durable daily quota, BYOK-aware caps, and kill switches.
- Deep reasoning is BYOK-gated via `daily: 0` on the `deepspec` kind. The platform
  free tier cannot sustain it — measured, not assumed.

## Invariants

1. **Technology is derived, never chosen first.** Every component must trace back
   through `satisfies` to a requirement. An orphan component is a finding.
2. **Nothing becomes a fact without evidence.** `KNOWN` with no evidence is
   downgraded at write time. Models may not assert their way to certainty.
3. **If a rule can compute it, a model must not.** Gap detection, integrity,
   implications, invariants, scenarios, budgets, completeness and council selection
   are all deterministic.
4. **A prompt never receives the whole USS, and an empty section is never
   rendered.** Empty headings make models hallucinate to fill them.
5. **The complexity budget is code-derived and non-negotiable.** A model classifies
   the tier; `deriveBudget` sets what that tier permits, and overwrites whatever the
   model proposed.
6. **Referential integrity is a parse error, not a finding.** A relation pointing at
   a missing entity is rejected at write time.
7. **"Unknown" is a valid answer and is never scored as a failure.** Reporting a gap
   the spec is merely silent about is manufactured certainty.
8. Auth is enforced at every mutation boundary — no route or server action mutates
   without verifying ownership or collaborator access.
9. Canvas state lives in Liveblocks; the USS owns semantics and the canvas owns
   layout. The database stores metadata and the spec.
10. All UI colors use design tokens — no hardcoded hex in components.
11. Server components are the default — `"use client"` only where interactivity needs it.
12. Prisma schema is the single source of truth — no raw SQL outside migrations.
13. Generated shadcn/ui components in `components/ui/` are not manually edited.

## Measurement

`npm run eval` scores the pipeline against 10 canonical client briefs
(`evals/`). `npm run uss:test` asserts the foundation's invariants.

Two rules keep the numbers honest:

- A dimension that cannot yet be computed reports `null`, **never 0**, and
  `--compare` labels a first score as "first measurement — not a gain over 0".
- A baseline containing any failure is **refused**, because one bad baseline
  poisons every later comparison.

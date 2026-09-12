# SYPI evaluation harness

Measures the **quality of SYPI's reasoning** against ten canonical client briefs, so that
"is SYPI good enough for real client work?" is a number instead of an opinion.

```bash
npm run eval                      # all 10 briefs, writes evals/reports/<timestamp>.json
npm run eval -- --baseline        # also writes evals/baselines/<date>-baseline.json
npm run eval -- --briefs=01,04    # just those (prefix/substring match)
npm run eval -- --no-judge        # deterministic scorers only — no LLM judge calls
npm run eval -- --no-critique     # skip the self-critique pass (raw generation)
npm run eval -- --runs=3          # median of 3 runs per brief, to damp variance
```

## How it works

The runner calls the **same functions `app/api/ai/generate/route.ts` calls** — the same
`GENERATION_SYSTEM_PROMPT`, the same `ArchitectureOutputSchema`, and the same
self-critique-and-repair loop — but in-process. No HTTP, no Clerk, no quota, no deployment.
We are measuring reasoning, not transport.

It does not touch the database.

## Which model — and why the platform key is not enough

By default the harness uses the platform Gemini key (`GOOGLE_AI_API_KEY`). **This does not
work for a full run.** Measured on 2026-09-12: the free tier rejected requests after roughly
20 calls with `generate_content_free_tier_requests, limit: 20`, and the allowance had not
recovered after 95 seconds — it is a daily budget, not a per-minute one. A full 10-brief run
needs 30–40 calls.

Run on your own key instead:

```bash
EVAL_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-...  npm run eval -- --baseline
EVAL_PROVIDER=anthropic EVAL_MODEL=claude-sonnet-4-6  npm run eval
EVAL_PROVIDER=openai    OPENAI_API_KEY=sk-...         npm run eval
```

Only models whitelisted in `lib/ai/providers.ts` are accepted — the same constraint the
product enforces for BYOK. `--delay=<ms>` (default 4000) paces calls between requests.

This is also the empirical basis for gating the deep reasoning pipeline behind BYOK: the
platform free tier cannot sustain even a benchmark run, let alone a 6–7 call reasoning
pipeline per user.

## The briefs

Each brief in `briefs/` is written the way a client actually talks: vague, incomplete, and
silent on the things that matter most. Each declares **expected engineering properties, never
one expected architecture** — there are many correct designs for a marketplace, and a benchmark
that demands one specific shape measures conformance rather than quality.

| id | what it stresses |
|---|---|
| `01-crud-internal-tool` | the over-engineering trap — a good answer here is boring |
| `02-multi-tenant-saas` | tenant isolation, the most common catastrophic SaaS bug |
| `03-marketplace` | inventory consistency, order lifecycle, settlement |
| `04-payment-system` | webhook idempotency, dunning, PCI scope, an auditable ledger |
| `05-ai-saas` | confidentiality, async analysis, human-in-the-loop |
| `06-rag-app` | permission-aware retrieval, citations, freshness |
| `07-ai-video-pipeline` | long jobs, large uploads, provider failure, cost control |
| `08-automation-workflow` | idempotency and error paths in an n8n-shaped system |
| `09-content-platform` | server-side paywall, payouts, bulk email |
| `10-reverse-engineer` | evidence vs inference from a live URL |

## Scoring

**Deterministic** (`scorers.ts`) — pure functions, no LLM:

- `requirements-completeness` — how many of the question areas a senior engineer would raise
  does the output address at all
- `expected-properties` — weighted by severity (critical 3 / important 2 / nice 1)
- `simplicity` — component count vs the brief's budget; **going over is penalised steeply**,
  because over-engineering is the failure mode this benchmark exists to catch
- `over-engineering` — presence of patterns unjustified at this brief's tier (Kafka in an
  8-user internal tool)
- `connectivity` — orphan components, and edges pointing at components that do not exist
- `edge-labelling` — do connections say what actually flows

**Judge** (`judge.ts`) — one LLM call per brief, temperature 0:

- `business-correctness` — would building exactly this serve the client's business
- `implementability` — could an AI coding agent build it without inventing decisions

## The `measurable` flag — read this before comparing runs

Several dimensions **cannot be computed at all** from an `ArchitectureOutput`, because it has no
evidence, status, assumption or open-decision fields:

`traceability` · `hallucination-rate` · `unsupported-assumptions` · `unresolved-decisions` ·
`domain-correctness` · `data-correctness`

These report `score: null, measurable: false` — **never `0`**. Scoring them zero today would
manufacture a fake improvement the moment the USS lands, making Unit 1 look like a miracle when
all it did was start measuring something new. Averages skip unmeasurable dimensions. When the USS
arrives these flip to `measurable: true` and get a *first* score, which is a new measurement and
must be reported as such — not as a gain over zero.

## Using it as a regression gate

From Unit 1 onward, no prompt, schema or model change merges without a run showing **no dimension
regressed by more than 5%** against the stored baseline. Compare like with like: the same
`--runs`, the same `--critique` setting, and the same model. Every report records `model`,
`judgeModel`, `runs`, `gitCommit` and the raw output, so a regression can be diffed rather than
guessed at.

`evals/baselines/` is committed. `evals/reports/` is not — it is per-run working output.

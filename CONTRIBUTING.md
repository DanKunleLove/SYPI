# Contributing to SYPI

Thanks for helping. SYPI turns a plain-English brief into a reasoned system
specification — requirements, architecture, domain rules, open questions and an
ordered task list — then hands it to whatever builds it. Most of the interesting
code is deterministic and testable without an API key.

## Get it running

Follow [docs/self-hosting.md](docs/self-hosting.md). The short version:

```bash
npm install
docker compose up -d          # local Postgres
cp .env.example .env.local    # fill in the keys it asks for
npx prisma migrate deploy
npm run dev
```

## Where things live

| Path | What it is |
| --- | --- |
| `lib/uss/` | The Universal System Specification — the typed entity graph and every deterministic check over it. **Start here.** |
| `lib/uss/selftest.ts` | The test suite. One script, no framework. `npm run uss:test` |
| `lib/uss/targets.ts` | Hand-off targets (Claude Code, Codex, Lovable, n8n, Spec Kit, human team). Adding a target = adding a renderer. |
| `lib/ai/` | Model calls: extraction passes, the pipeline steps, prompts, provider resolution. |
| `app/api/mcp/` | The MCP server that lets coding agents read a SYPI spec. |
| `app/api/ai/` | AI routes. Each does one bounded unit of work — see "60-second rule" below. |
| `components/` | UI: canvas (React Flow), workspace panels, settings. |
| `evals/` | The benchmark harness: 10 briefs scored on engineering properties. |
| `context/` | Living design docs. `context/architecture.md` explains the why. |

## Ground rules

1. **Deterministic first.** If a check can be a graph query, it must not be a model
   call. Gap detection, integrity checks, scenarios, requirement linting and the
   task breakdown all run with zero LLM calls. That is what makes them free,
   reproducible and testable — keep it that way.
2. **Nothing becomes a fact without evidence.** Every entity carries a status
   (`KNOWN` / `INFERRED` / `ASSUMPTION` / `UNKNOWN`). Do not write code that
   upgrades a model's guess to `KNOWN`.
3. **The 60-second rule.** Every AI route must finish inside 60 seconds (the
   Vercel Hobby ceiling). Long work is split into steps the client orchestrates —
   see `app/api/ai/pipeline` and the Kit/hand-off routes.
4. **Add a test with the behaviour.** New rules go in `lib/uss/selftest.ts` with at
   least one case that fires and one that must not. A test that cannot fail is
   worse than none.
5. **Match the surrounding code.** TypeScript, Zod at boundaries, Tailwind for
   styling. Comments explain *why*, not what.

## Before you open a pull request

```bash
npx tsc --noEmit
npm run uss:test
npm run build        # needs a filled-in .env.local
```

CI runs the first two on every pull request.

- Keep PRs focused — one behaviour per PR.
- Describe what changed and how you verified it.
- If you change the architecture or conventions, update the matching file in `context/`.

## Good first contributions

- A new **gap rule** in `lib/uss/gaps.ts` — a question a senior engineer would ask
  that SYPI does not yet.
- A new **execution target** in `lib/uss/targets.ts` for a tool you use.
- A new **scenario** in `lib/uss/scenarios.ts` ("what happens when…").
- A new **eval brief** in `evals/briefs/`.

## License

SYPI is licensed under [AGPL-3.0](LICENSE). By contributing you agree your
contribution is licensed under the same terms. If you run a modified SYPI as a
network service, the AGPL requires you to offer your users its source.

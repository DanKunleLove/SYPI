# AI Workflow Rules

## Approach

Build this project incrementally using a spec-driven workflow. Context files define what to build, how to build it, and the current state of progress. Always implement against these specs — do not infer or invent behavior from scratch.

## Scoping Rules

- Work on one feature unit at a time
- Prefer small, verifiable increments over large speculative changes
- Do not combine unrelated system boundaries in a single implementation step
- Install dependencies just-in-time — only when the current unit requires them
- Do not add features, refactor code, or make improvements beyond the current spec

## When to Split Work

Split an implementation step if it combines:

- UI changes and background task / job changes
- Multiple unrelated API routes or server actions
- Database schema changes and frontend wiring in the same step
- Behavior not clearly defined in the context files

If a change cannot be verified end to end quickly, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files
- If a requirement is ambiguous, resolve it in the relevant context file before implementing
- If a requirement is missing, add it as an open question in `progress-tracker.md` before continuing
- When in doubt, ask — do not guess

## Protected Files

Do not modify the following unless explicitly instructed:

- `components/ui/*` — shadcn/ui generated components
- `prisma/migrations/*` — committed migration files (create new migrations instead)
- `node_modules/*` — package internals
- `context/*.md` — only update when implementation changes architecture, scope, or standards

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries
- Storage model decisions
- Code conventions or standards
- Feature scope or user flows
- Technology choices

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated
3. `progress-tracker.md` reflects the completed work
4. No TypeScript errors
5. No console errors in the browser
6. `npm run build` passes

# SYPI — System Project Intelligence

**Design system architectures with your AI Twin.** Describe a system in plain English — or paste a live URL — and SYPI plans, generates, reviews, and places a production-grade architecture on a real-time collaborative canvas. Then export it as a spec, a Mermaid diagram, or an agent bundle your coding AI can implement directly.

Live: **[sypi-dev.vercel.app](https://sypi-dev.vercel.app)**

Built by [Adelusi Dan Kunle](https://github.com/DanKunleLove) — AI Engineer, LLM Specialist, Automation Architect (Lagos).

---

## What it does

- **Plan-then-execute generation** — the AI Twin drafts a human-readable plan you discuss and refine as a conversation, then generates the full architecture from the agreed plan.
- **Real URL grounding** — paste any URL into a prompt. SYPI fetches the live site (framework fingerprints, headers, page content), researches the stack, and reverse-engineers an architecture from evidence — not guesses.
- **Self-critique loop** — every generation is reviewed for critical design flaws and auto-repaired before it reaches your canvas. Revert/restore any generation with one click.
- **Live collaboration** — multiplayer canvas with cursors, presence, comments, and @mention email notifications (Liveblocks).
- **AI design review** — one-click critique: SPOFs, missing layers, security gaps, grouped by severity, with click-to-focus and "fix all with AI Twin."
- **BYOK multi-model** — bring your own Anthropic / OpenAI / Google key (AES-256-GCM encrypted at rest) and pick your default model. Custom instructions teach the AI Twin how you work.
- **Export & hand-off** — Markdown spec, PNG, Mermaid, Lovable/v0 prompts, and an Agent Bundle ZIP (CLAUDE.md + schema + tasks) any coding agent can build from.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, RSC) · React 19 · TypeScript |
| Styling | Tailwind CSS 4 · shadcn/ui · Framer Motion |
| Canvas | React Flow (@xyflow/react) |
| Realtime | Liveblocks (storage, presence, comments) |
| AI | Vercel AI SDK v6 · Gemini (platform) · BYOK Claude/GPT/Gemini |
| Auth | Clerk |
| Database | Neon PostgreSQL · Prisma 7 |
| Storage | Vercel Blob (canvas snapshots, thumbnails) |
| Background jobs | Trigger.dev v4 (critique/refine workers) |
| Email | Resend (mention/reply notifications) |

## Getting started

```bash
npm install
cp .env.example .env   # fill in the required keys
npx prisma migrate deploy
npm run dev
```

See `.env.example` for the full list of environment variables and `DEPLOY.md` for the production deployment guide.

## Project structure

```
app/            Next.js routes (workspace, API, auth, share viewer)
components/     UI — canvas, workspace, editor, settings, help
lib/            Shared logic — AI prompts/schemas, crypto, spec/export, rate limiting
hooks/          Client hooks — generation, chat, autosave, shortcuts
trigger/        Trigger.dev background tasks
prisma/         Schema + migrations
context/        Living project docs — architecture, standards, progress tracker
docs/           Product guides (Mintlify)
```

## License

Copyright © 2026 Adelusi Dan Kunle. All rights reserved.

# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- P1 complete — ready for P2.1 (Canvas Node Types)

## Current Goal

- Next: P2.1 Canvas Node Types + P2.2 Canvas Interactions

## Spec Roadmap

### Completed (Foundation)

| Spec | Name | Status |
|------|------|--------|
| 01 | Design System | DONE |
| 02 | Editor Chrome | DONE |
| 03 | Auth (Clerk) | DONE |
| 03.1 | Editor Home, Dialogs & Sidebar Actions | DONE |
| 03.2 | Prisma Models + Client + Migration | DONE |
| 03.3 | Project API Routes | DONE |
| 03.4 | Wire Editor Home to API | DONE |
| 03.5 | Editor Workspace Shell | DONE |
| 03.6 | Share Dialog | DONE |
| 03.7 | Liveblocks Setup | DONE |
| 03.8 | Base Canvas (React Flow + Liveblocks) | DONE |

### New Phased Roadmap

| Phase | Spec | Name | Status | Dependencies |
|-------|------|------|--------|--------------|
| P0 | P0 | Bug Fixes & Codebase Audit | DONE | — |
| P1 | P1.1 | Database Hardening | DONE | P0 |
| P1 | P1.2 | Dashboard | DONE | P1.1 |
| P2 | P2.1 | Canvas Node Types | TODO | P0 |
| P2 | P2.2 | Canvas Interactions | TODO | P2.1 |
| P3 | P3.1 | AI Engine (Vercel AI SDK + Trigger.dev) | TODO | P1.1, P2.1 |
| P3 | P3.2 | Prompt to Canvas | TODO | P3.1, P2.2 |
| P4 | P4.1 | AI Design Critique | TODO | P3.1 |
| P4 | P4.2 | Iterative Refinement | TODO | P3.2 |
| P4 | P4.3 | Smart Suggestions | TODO | P3.1, P4.1 |
| P5 | P5.1 | System Templates | TODO | P2.1, P2.2 |
| P5 | P5.2 | Spec Export (Markdown) | TODO | P2.1, P3.1 |
| P5 | P5.3 | Auto Layout (Dagre) | TODO | P2.1, P2.2 |
| P5 | P5.4 | Connection Animations | TODO | P2.2 |
| P6 | P6 | Deployment (Vercel) | TODO | All |

### Build Order (recommended sequence)

```
P0 -> P1.1 -> P1.2 -> P2.1 -> P2.2 -> P3.1 -> P3.2 -> P4.1 -> P4.2 -> P4.3 -> P5.1 -> P5.2 -> P5.3 -> P5.4 -> P6
```

Note: P2.x (canvas) can run in parallel with P1.x (database/dashboard) since they touch different parts of the codebase.

## Completed Work Summary

- Project scaffolded with Next.js 16 + React 19 + Tailwind CSS 4
- Design system: shadcn/ui, CSS design tokens, dark-only theme, Geist fonts
- Editor chrome: collapsible sidebar, toolbar, canvas area, prompt bar shell
- Auth: Clerk with dark theme, protected routes, auth pages
- Editor home: project grid, create/rename/delete dialogs, sidebar projects list
- Database: Prisma + Neon PostgreSQL, User/Project/Collaborator models
- API routes: full project CRUD with auth checks
- Workspace shell: project-aware navbar, canvas, AI sidebar placeholders, status bar
- Share dialog: invite by email, collaborator list, copy link
- Liveblocks: room auth, presence, cursor colors, connection status
- Base canvas: React Flow + Liveblocks, dot grid, minimap, snap-to-grid
- P0 bug fixes: B1 layout overlap, B3/B4 coming-soon toasts, B5 AI sidebar copy
- P1.1 Database Hardening: User model with Clerk webhook sync (Svix verified), Collaborator with Role enum (OWNER/EDITOR/VIEWER), AIGeneration model, cascade deletes, proper indexes, seed script
- P1.2 Dashboard: `/dashboard` page with project grid, "My Projects" / "Shared with Me" tabs, search filter, create/rename/duplicate/delete actions via server actions, empty states, loading skeletons, root redirect for signed-in users

## Open Questions

- Liveblocks API key — Dan needs to add `LIVEBLOCKS_SECRET_KEY` to `.env.local`
- Clerk webhook — Dan needs to configure webhook endpoint in Clerk dashboard and add `CLERK_WEBHOOK_SECRET` to `.env.local`
- Trigger.dev project setup and API keys (needed for P3.1)
- Anthropic API key for Claude (needed for P3.1)
- Database migration — run `npx prisma migrate dev` to apply new schema (User, Collaborator with roles, AIGeneration)

## Architecture Decisions

- Dark-only theme — no light mode toggle
- Canvas state lives in Liveblocks, not in the database
- AI: Vercel AI SDK for streaming/interactive, Trigger.dev for heavy background jobs
- Claude (Anthropic) as the LLM provider
- Feature specs follow phased micro-spec approach (P0-P6)
- Old tutorial-style specs (04-17) replaced with production-focused specs
- Dashboard uses server actions (read-heavy SSR), editor keeps API routes (client-side fetches)
- User model synced from Clerk via webhook — API routes resolve internal DB user via clerkId
- Dropped ProjectStatus enum (unused), kept canvasJsonPath (for Vercel Blob)

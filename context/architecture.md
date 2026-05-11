# Architecture Context

## Stack

| Layer           | Technology                | Role                                                    |
| --------------- | ------------------------- | ------------------------------------------------------- |
| Framework       | Next.js 16 + TypeScript   | Full-stack React framework, server components, API routes |
| UI              | Tailwind CSS 4 + shadcn/ui | Utility-first styling with accessible component primitives |
| Animation       | Framer Motion             | Micro-interactions and canvas transition animations       |
| Auth            | Clerk                     | Authentication, user management, session handling         |
| Database        | PostgreSQL + Prisma ORM   | Relational data — users, projects, metadata               |
| Real-time       | Liveblocks                | Collaborative canvas state, presence, cursors             |
| Background Jobs | Trigger.dev               | Long-running AI agent tasks (canvas generation, critique) |
| AI              | Claude API (Anthropic)    | System design generation, critique, suggestions           |
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
- `trigger/` — Trigger.dev job definitions (AI generation, critique)
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

## AI and Background Task Model

- User prompts are sent to an API route, which triggers a Trigger.dev background job
- The background job calls the Claude API to generate or refine the system design
- The job writes results back to Liveblocks storage (canvas nodes and connections)
- AI critique runs as a separate background job, reading canvas state and returning suggestions
- Smart suggestions are computed on-demand when the user requests them
- No AI work runs inside Next.js request handlers — all long-running AI tasks go through Trigger.dev

## Invariants

1. Request handlers do not run long-lived AI work — all AI processing goes through Trigger.dev background jobs
2. Auth is enforced at every mutation boundary — no server action or API route mutates data without verifying ownership or collaborator access
3. Canvas state lives in Liveblocks, not in the database — the database stores metadata, Liveblocks stores the canvas
4. All UI colors use design tokens from CSS custom properties — no hardcoded hex values in components
5. Server components are the default — `"use client"` is only added when browser interactivity requires it
6. Prisma schema is the single source of truth for the database — no raw SQL outside of migrations
7. Generated shadcn/ui components in `components/ui/` are not manually edited

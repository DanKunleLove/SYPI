# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Core infrastructure

## Current Goal

- Set up authentication and database layer (Units 03-04)

## Completed

- Project scaffolded with Next.js 16 + React 19 + Tailwind CSS 4
- Boilerplate cleaned (globals.css stripped, SVGs removed, page.tsx replaced)
- All 6 context files populated with spi AI specifications
- AGENTS.md configured as entry point to context system
- Unit 01: Design system — shadcn/ui initialized, 9 components added, CSS design tokens defined, dark-only theme enforced, lucide-react installed, cn() utility ready
- Unit 02: Editor chrome — editor navbar (inline project name, zoom controls, breadcrumb), project sidebar (search, recent projects, Framer Motion slide-in, backdrop overlay), canvas placeholder (dot grid, empty state), prompt bar shell (disabled), editor layout page at /editor. Inspired by n8n/make.com. Framer Motion installed.

## In Progress

- None.

## Next Up

- Unit 03: Auth setup (Clerk installation, sign-in/sign-up pages, auth middleware)
- Unit 04: Database setup (Prisma + PostgreSQL schema, Clerk webhook sync)
- Unit 05: Dashboard (project CRUD, project cards, layout)
- Unit 06: Canvas integration (Liveblocks, nodes, connections)

## Open Questions

- Clerk project credentials (Dan needs to create a Clerk app and get API keys)
- PostgreSQL provider choice (Vercel Postgres, Supabase, Neon, or other)
- Liveblocks plan and API keys
- Trigger.dev project setup and API keys
- Claude API key for AI generation features

## Architecture Decisions

- Dark-only theme — no light mode toggle
- Canvas state lives in Liveblocks, not in the database
- All AI processing goes through Trigger.dev background jobs, never in request handlers
- spi AI differentiators vs Ghost AI: AI design critique, iterative refinement, smart suggestions, auto-layout, connection animations, richer template library

## Session Notes

- Dan is following the JavaScript Mastery Ghost AI tutorial step-by-step
- Building the same core product but branded as "spi AI" with UI and AI upgrades
- Currently at the point in the video where context files are set up and building begins
- Next session: create the build plan and start Unit 01

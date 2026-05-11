# Code Standards

## General

- Keep modules small and single-purpose
- Fix root causes, do not layer workarounds
- Do not mix unrelated concerns in one component or route
- Prefer editing existing files over creating new ones
- No console.log left in committed code — use structured error handling

## TypeScript

- Strict mode is required throughout the project
- Avoid `any` — use explicit interfaces or narrowly scoped types
- Define shared types in `lib/types/` and import from there
- Validate unknown external input at system boundaries using Zod
- Prefer `interface` for object shapes, `type` for unions and utilities

## Next.js

- Default to server components — add `"use client"` only when browser interactivity requires it
- Use the App Router exclusively — no pages directory
- Keep route handlers focused on a single responsibility
- Use server actions in `lib/actions/` for mutations
- API routes in `app/api/` are for webhook receivers and external integrations only
- Do not use middleware for auth — use Clerk's server-side helpers in route handlers and server actions

## Styling

- Use Tailwind CSS utility classes for all styling
- Use CSS custom property tokens from `ui-context.md` for colors — no hardcoded hex values in components
- Follow the border radius scale defined in `ui-context.md`
- Use `cn()` utility (from `lib/utils.ts`) for conditional class merging
- Framer Motion for animations — no CSS keyframe animations

## API Routes

- Validate and parse request input with Zod before any logic runs
- Enforce auth and ownership checks before any mutation
- Return consistent response shapes: `{ success: true, data }` or `{ success: false, error }`
- Use proper HTTP status codes

## Data and Storage

- Project metadata belongs in PostgreSQL (via Prisma)
- Canvas state (nodes, connections, positions) belongs in Liveblocks storage
- Generated files and thumbnails belong in Vercel Blob
- Do not store large content blobs directly in the database

## File Organization

- `app/` — Routes and layouts only. Minimal logic.
- `components/` — All React components. Subdirectories by domain (canvas/, dashboard/, shared/).
- `components/ui/` — shadcn/ui generated components. Do not edit.
- `lib/` — Utilities, API clients, Prisma client, Zod schemas, type definitions.
- `lib/actions/` — Server actions for data mutations.
- `lib/types/` — Shared TypeScript interfaces and types.
- `prisma/` — Schema and migrations.
- `trigger/` — Trigger.dev background job definitions.

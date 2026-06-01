# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- P4.3 complete — AI stack fully implemented (P3.1 through P4.3)
- 2026-05-31 audit: fixed AI SDK v6 migration + build passes clean + DB migration baselined (see below)
- 2026-05-31 generation fix + AI surface consolidation (see below)
- 2026-05-31 model quota fix: gemini-2.5-pro is limit-0 on the free tier. `getModel("pro")` now falls back to gemini-2.5-flash (env override `GEMINI_PRO_MODEL` for when billing is enabled). Also fixed design-agent URL-research call (was hardcoded gemini-2.5-pro). Affects design-agent/critique/refine.
- 2026-05-31 generation VERIFIED WORKING by Dan (14-node e-commerce architecture generated; chat explains flow).
- 2026-05-31 NEW: plan-then-execute generation (see below).

### Plan-then-execute generation (P4.4 — agentic planning)

Per Dan's north-star ([[spi-ai-product-direction]]): generation is no longer one-shot. In the AI Twin panel's **Generate** mode the flow is now plan → approve → execute:
- `PLANNING_SYSTEM_PROMPT` (lib/ai/prompts.ts) — produces a short human-readable Markdown plan (overview, components w/ categories, key flows, decisions), not JSON.
- `app/api/ai/plan/route.ts` — streams the plan via `streamText(...).toTextStreamResponse()` (Gemini flash). Auth via getDbUser.
- `ai-panel.tsx` ChatTab — `requestPlan()` streams the plan into a "Proposed plan" card (manual `ReadableStream` reader, no SDK hook dep); user gets **Approve & Generate** / **Refine**. Approve composes `"{goal}\n\nUse this approved plan:\n{plan}"` and calls the existing `useGeneration.generate(..., "generate")`; Refine restores the goal to the input to edit/re-plan.
- Chat and URL modes unchanged. tsc passes.

### Editable edge labels (P4.5)

`CustomEdge` (components/canvas/custom-edge.tsx) previously ignored `data.label` — AI-generated connection labels never rendered. Now:
- Renders the label as a pill at the edge midpoint.
- Double-click an edge (or its label) to edit inline; Enter/blur commits via `reactFlow.updateEdgeData` (syncs through Liveblocks), Escape cancels. Empty edges show a "+ label" affordance on hover/select. Canvas Delete shortcut is already guarded against INPUT focus (use-canvas-shortcuts.ts:15).
- Delete button moved to sit just above the label.
- `ArchitectureEdgeSchema.label` is now REQUIRED (was optional) so every AI-generated edge carries an action/data label (Dan: "every edge link... an action taking place").

### Pre-push review + UX polish (2026-06-01)

Code-review (high) of the pre-push diff: authz is solid (all AI mutation routes check getProjectWithAccess; token route checks ownership; no IDOR/injection/secret leaks). Fixes applied:
- **Fonts (bug)**: `globals.css` had `--font-sans: var(--font-sans)` (self-referential) so Geist never applied — site fell back to system font. Now maps `--font-sans`/`--font-heading`/`--font-mono` to the Geist next/font variables.
- **Logo unified**: new `components/brand/logo.tsx` (GitBranch glyph in accent box + "spi AI") is the single source of truth. Replaced the auth-page "S" mark, dashboard navbar bare icon, and inlined sidebar logo with `<Logo>`.
- **Rename bug**: canvas header read the project name from the server-rendered page, so sidebar renames didn't reflect there. `handleRename` now calls `router.refresh()` on success.
- **Edge label reverted to optional** in `ArchitectureEdgeSchema` (required risked failing whole generations on a single missing label; prompt still strongly requests labels).
- **chat route**: now verifies project access (getProjectWithAccess) + guards `request.json()` + validates types.

Deferred (pre-prod, noted): server-side rate limiting on AI routes; transaction/orphan-handling around design route's create+trigger sequence; HTTP status-code refinement (404/401 vs 403); project-workspace.tsx whitespace reindent (run formatter).

### Spec export (P5.2 — hybrid)

The "Spec" tab is now real (was a placeholder). Hybrid approach:
- `lib/spec.ts` `generateSpecMarkdown()` — deterministic Markdown built from the canvas graph (component table, connections with edge labels, per-component config/notes details). Instant, no AI cost.
- `app/api/ai/spec/route.ts` + `SPEC_OVERVIEW_SYSTEM_PROMPT` — optional AI-written Overview section (Gemini flash), layered on top. Auth + project-access checked.
- `ai-panel.tsx` `SpecTab` — renders the spec, **Copy** + **Download .md**, and **Enhance with AI** (fetches the overview; degrades gracefully on failure). Empty state when no nodes. `AiPanel` now takes `projectName` (passed from project-workspace).

Roadmap (Dan's stated priorities, not yet built): more export formats (Mermaid/OpenAPI/IaC); BYOK + model picker; self-critique loop; image-to-architecture; deeper research during planning; (future) autonomous follow-up agents.

### 2026-05-31 Generation hang fix + AI surface consolidation

Root cause of "stuck on Analyzing your request...": the **Trigger.dev dev worker was not running**, so the `design-agent` run sat QUEUED and EXPIRED. In local dev, generation REQUIRES `npm run dev:trigger` running. (The Trigger MCP can't start it — it runs in CI mode and aborts on the `^` version-range mismatch warning, even though all `@trigger.dev/*` are 4.4.6.)

Code fixes:
- **Live progress**: `design-agent.ts` now broadcasts `AI_STATUS_UPDATE` room events at each stage (planning/researching/generating/saving) via a `broadcastStatus()` helper — previously it only called `metadata.set()` (Trigger-internal), so the UI text was frozen on "Analyzing...". `getLiveblocks()` hoisted to top of run.
- **No more silent infinite spinner**: `use-generation.ts` `pollForCompletion` now surfaces a timeout error ("Generation timed out. Make sure the AI worker is running (npm run dev:trigger).") after 2 min instead of hanging forever.
- **Dedupe**: added `handledRef` so the Liveblocks COMPLETE event and the polling fallback can't both place nodes (was a duplicate-node risk); removed the stale `state.status` poll guard.

AI surface consolidation (user chose "AI Twin panel only"):
- Generation (prompt) + URL analysis moved INTO the right-side AI Twin panel: Chat tab now has **Generate / Chat / URL** mode pills, live progress banner, and URL field. `ai-panel.tsx` uses `useGeneration` + `useAiChat`.
- Removed the bottom-center `PromptBar`; canvas empty-state "Start from prompt" now opens the AI panel (`onOpenAiPanel` wired through `WorkspaceCanvas` ← `ProjectWorkspace`).
- Deleted dead code: `prompt-bar.tsx`, `workspace-shell.tsx`, `workspace-navbar.tsx`, `ai-sidebar.tsx` (the pre-restructure shell + its placeholder AI sidebar; none were mounted).
- tsc passes clean.

### 2026-05-31 Codebase Audit & AI SDK v6 Fixes

Production build was failing; full audit + fixes applied. `npx next build` now exits 0 (TS check passes, all 18 routes incl. 6 AI endpoints compile).

Fixed:
- **AI SDK v6 migration** (`ai` 6.0.191): `tool()` `parameters`→`inputSchema`; `maxSteps`→`stopWhen: stepCountIs(5)`; `toDataStreamResponse`→`toUIMessageStreamResponse`; `convertToModelMessages` is async (awaited) — `app/api/ai/chat/route.ts`
- **use-ai-chat.ts**: rewired to v6 `useChat` (`DefaultChatTransport`, `sendMessage`, `status`); input now local `useState`; tool parts via `isToolUIPart`; public hook API preserved
- **ai-panel.tsx**: message text from `parts`, tool parts via `isToolUIPart`/`output-available`; added dedup guard (`appliedToolCallsRef`) so tool outputs apply once, not on every render
- **Trigger tasks**: `result` cast to `Prisma.InputJsonValue` (design/critique/refine); design-agent URL research uses `googleProvider.tools.googleSearch({})` (v6 grounding) instead of removed 2-arg `{ useSearchGrounding }`
- **use-ai-status.ts**: `createdAt` is already epoch ms — removed bad `.getTime()`
- **Runtime crash fix**: `useCritique` (calls `useReactFlow`/`useEventListener`) ran outside providers — split `ProjectWorkspace` into thin provider wrapper + inner `WorkspaceContent`
- **trigger.config.ts**: installed missing `@trigger.dev/build@4.4.6`; `prismaExtension({ mode: "modern" })` for Prisma 7
- Audit false-positive ruled out: `systemNode` node-type is consistent everywhere (React Flow registry key); the `"canvasNode"` generic param is cosmetic.

### Migration baseline (RESOLVED 2026-05-31)
- Deleted obsolete migration `20260516191607_add_project_models` (described old `Project.ownerId`/`ProjectCollaborator` schema, never applied).
- Generated fresh baseline `20260531000000_init` from current schema; marked applied via `migrate resolve --applied` (DB already had most tables via prior `db push`).
- Drift check found DB was missing `TaskRun` table + `AIGeneration.type` column (the long-pending additions). Applied additive DDL via `prisma db execute` — non-destructive, existing rows defaulted `type='generation'`.
- Verified: `migrate status` = "up to date"; `migrate diff` schema↔DB = "No difference detected". History is now reproducible for deploys.
- Note: Neon free-tier auto-suspends; CLI calls may need a retry to wake it.

## Current Goal

- Next: P5.1 (System Templates) or P5.2 (Spec Export) or P6 (Deployment)

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
| UI | — | ChatGPT-Style Unified Layout | DONE | P1.2 |
| UI | — | Canvas Autosave (Vercel Blob) | DONE | P2.1 |
| P2 | P2.1 | Canvas Node Types | DONE | P0 |
| P2 | P2.2 | Canvas Interactions | DONE | P2.1 |
| P2 | — | Node Inspector Panel | DONE | P2.1 |
| P2 | — | Edge System (Arrows + Delete) | DONE | P2.2 |
| P2 | — | Presence Avatars + Custom Cursors | DONE | 03.7 |
| P2 | — | Undo/Redo (Liveblocks History) | DONE | 03.7 |
| P3 | P3.1 | AI Engine (Google Gemini + Trigger.dev) | DONE | P1.1, P2.1 |
| P3 | P3.2 | Prompt to Canvas + URL-to-Architecture | DONE | P3.1, P2.2 |
| P4 | P4.1 | AI Design Critique | DONE | P3.1 |
| P4 | P4.2 | Iterative Refinement | DONE | P3.2 |
| P4 | P4.3 | Smart Suggestions | DONE | P3.1, P4.1 |
| P5 | P5.1 | System Templates | TODO | P2.1, P2.2 |
| P5 | P5.2 | Spec Export (Markdown) | TODO | P2.1, P3.1 |
| P5 | P5.3 | Auto Layout (Dagre) | TODO | P2.1, P2.2 |
| P5 | P5.4 | Connection Animations | TODO | P2.2 |
| P6 | P6 | Deployment (Vercel) | TODO | All |

### Build Order (recommended sequence)

```
P0 -> P1.1 -> P1.2 -> UI Restructure -> P2.1 -> P2.2 -> P3.1 -> P3.2 -> P4.1 -> P4.2 -> P4.3 -> P5.1 -> P5.2 -> P5.3 -> P5.4 -> P6
```

## Completed Work Summary

### Foundation (Specs 01–03.8)
- Project scaffolded with Next.js 16 + React 19 + Tailwind CSS 4
- Design system: shadcn/ui, CSS design tokens, dark-only theme, Geist fonts
- Auth: Clerk with dark theme, protected routes, auth pages
- Database: Prisma + Neon PostgreSQL, User/Project/Collaborator/AIGeneration models
- API routes: full project CRUD with auth checks, canvas save/load
- Share dialog: invite by email, collaborator list, copy link
- Liveblocks: room auth, presence, cursor colors, connection status
- Base canvas: React Flow + Liveblocks, dot grid, snap-to-grid

### UI Restructure (ChatGPT-Style)
- Unified `(workspace)` route group — sidebar always present across dashboard and canvas
- `/` = dashboard home (project grid, tabs, search)
- `/[projectId]` = canvas workspace
- ChatGPT-style collapsible sidebar: logo, new project, recent/shared projects, search, profile
- Sidebar collapses to 56px icon rail with logo, +, and avatar
- Auto-create DB user on first Clerk auth (dev convenience, no webhook required)

### P2.1 Canvas Node Types
- 9 custom node types: Service, Database, Queue, Cache, Gateway, Client, Storage, Function, Custom
- Each with distinct icon, accent color, type badge
- Connection handles with +/− indicators (target/source)
- Double-click to edit label inline (persists to Liveblocks)
- Double-click description to add/edit (persists to Liveblocks)
- Animated entry (scale + fade via Framer Motion)
- Custom color override support

### P2.2 Canvas Interactions
- Node palette toolbar (bottom-center): click or drag to add nodes
- Keyboard shortcuts: Delete, Ctrl+A, Ctrl+D, Ctrl+C/V, Escape
- Undo/Redo: Ctrl+Z / Ctrl+Y (via Liveblocks history)
- Canvas toolbar (bottom-left): zoom in/out/fit + undo/redo buttons
- Custom edge component with delete button (× at midpoint on hover)
- Directional arrows on edges (MarkerType.ArrowClosed)
- Animated smooth-step edges
- Edge selection + deletion via keyboard
- Drag-select box for multi-select
- Empty state with "Start from prompt", "Build manually", "Use a template" options

### Node Inspector Panel
- Right panel (360px) slides in when node is clicked
- Identity section: label, description, category dropdown
- Color picker: 12-color palette with reset to default
- System config: dynamic fields per category (Technology, Port, Protocol, Scaling, DB Type, etc.)
- Connections list: shows linked nodes with direction arrows
- Notes section: free-form textarea
- Delete node button
- Mutually exclusive with AI panel (one right panel at a time)

### Collaboration Features
- Presence avatars (top-right): shows active users, expandable dropdown
- Custom cursors: small 16px SVG arrow with colored name label per user
- Real-time cursor tracking via Liveblocks
- All node/edge changes sync in real-time across collaborators

### Canvas Persistence (Vercel Blob)
- PUT /api/projects/[projectId]/canvas — saves canvas JSON to Vercel Blob
- GET /api/projects/[projectId]/canvas — loads saved canvas from Blob
- Autosave hook: debounced 3s save on any canvas change
- Manual save: Ctrl+S keyboard shortcut + save button in toolbar
- Save status indicator: toolbar icon (save/spinner/checkmark) + status bar text
- Canvas load on mount: restores from Blob if Liveblocks room is empty

### AI Panel Shell
- n8n-style right panel, triggered by Generate button
- Chat tab with input, quick prompts (E-commerce, Chat system, CI/CD)
- Suggestions tab (placeholder)
- Spec Preview tab (placeholder)
- "AI Twin" branding

### P3.1 AI Engine (Google Gemini + Trigger.dev)
- Provider: Google Gemini via @ai-sdk/google (GOOGLE_AI_API_KEY)
- Dual infrastructure: Vercel AI SDK (streaming chat) + Trigger.dev (background generation)
- Shared modules: lib/ai/ (index, prompts, schemas, canvas-context, layout)
- 5 system prompts: generation, URL analysis, chat, critique, refinement
- Zod schemas for all AI outputs: ArchitectureOutputSchema, RefinementOutputSchema, CritiqueOutputSchema
- Auto-layout algorithm: hierarchical tiers (client→gateway→service→queue/cache→database)
- Design agent task: trigger/design-agent.ts (generation + URL analysis with Google Search)
- API routes: /api/ai/design (trigger), /api/ai/design/token (public token), /api/ai/design/[generationId] (status)
- Client-side write-back: Trigger.dev → DB → Liveblocks event → client places nodes

### P3.2 Prompt to Canvas + URL-to-Architecture
- Prompt bar: full rewrite with Generate/Refine/URL modes
- Generation hook: use-generation.ts (lifecycle, staggered placement, polling fallback)
- URL analysis: paste URL → agent researches tech stack via Google Search → generates architecture
- Staggered node placement: 100ms delay between each node for visual effect
- Example prompts: 5 clickable chips + URL analysis mode toggle
- AI sidebar chat: wired with @ai-sdk/react useChat, Liveblocks Feeds persistence
- Chat tool calling: addNode, removeNode, addEdge, updateNode → modify canvas in real-time
- Status feed: Liveblocks Feeds for real-time progress updates

### P4.1 AI Design Critique
- Critique task: trigger/critique-architecture.ts with Google Search for best practices
- Critique panel: right panel with severity-grouped issues (critical/warning/suggestion)
- Issue cards: expandable with description, fix suggestion, click-to-focus nodes
- Review button in toolbar
- Uses CritiqueOutputSchema with categories: reliability, scalability, security, completeness, best-practices

### P4.2 Iterative Refinement
- Refine task: trigger/refine-architecture.ts with diff operations
- Canvas diff engine: lib/ai/canvas-diff.ts (ADD_NODE, REMOVE_NODE, UPDATE_NODE, MOVE_NODE, ADD_EDGE, REMOVE_EDGE)
- Prompt bar auto-detects Refine mode when canvas has nodes
- API route: /api/ai/refine

### P4.3 Smart Suggestions
- Rule-based engine: lib/ai/suggestions.ts (6 patterns: no cache, no gateway, client→DB, no monitoring, no redundancy, no queue)
- Suggestions hook: use-suggestions.ts (instant analysis, 3s debounce, max 5, dismiss tracking)
- Suggestion chips: floating pills near affected nodes
- Applied via refinement pipeline

## Open Questions

- Prisma migration pending: AIGeneration.type field + TaskRun model (DB was unreachable during dev)
- Clerk webhook — configure in Clerk dashboard for production (dev uses auto-create)

## Architecture Decisions

- Dark-only theme — no light mode toggle
- Canvas state lives in Liveblocks (real-time) + Vercel Blob (persistence)
- AI: Vercel AI SDK for streaming/interactive, Trigger.dev for heavy background jobs
- Google Gemini as the LLM provider (Gemini 2.5 Flash for chat, Pro for generation)
- Unified layout: ChatGPT-style sidebar always present, content area switches
- Right panel: mutually exclusive — AI panel OR node inspector, never both
- Node config fields flattened into CanvasNodeData (no nested objects) for Liveblocks compatibility
- Custom cursor via Liveblocks Cursors components prop
- Autosave debounced 3s + manual Ctrl+S save
- User auto-created on first auth (no webhook required in dev)

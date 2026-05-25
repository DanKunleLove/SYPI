# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- P2 complete — ready for P3.1 (AI Engine)

## Current Goal

- Next: P3.1 AI Engine (Vercel AI SDK + Trigger.dev) + P3.2 Prompt to Canvas

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

## Open Questions

- Trigger.dev project setup and API keys (needed for P3.1)
- Anthropic API key for Claude (needed for P3.1)
- Clerk webhook — configure in Clerk dashboard for production (dev uses auto-create)

## Architecture Decisions

- Dark-only theme — no light mode toggle
- Canvas state lives in Liveblocks (real-time) + Vercel Blob (persistence)
- AI: Vercel AI SDK for streaming/interactive, Trigger.dev for heavy background jobs
- Claude (Anthropic) as the LLM provider
- Unified layout: ChatGPT-style sidebar always present, content area switches
- Right panel: mutually exclusive — AI panel OR node inspector, never both
- Node config fields flattened into CanvasNodeData (no nested objects) for Liveblocks compatibility
- Custom cursor via Liveblocks Cursors components prop
- Autosave debounced 3s + manual Ctrl+S save
- User auto-created on first auth (no webhook required in dev)

# Unit 02 — Editor Chrome

## Goal

Build the main application shell — the layout users see when working on a project. This is the "chrome" around the canvas: a collapsible sidebar, a top toolbar, and the central canvas area.

Inspired by n8n.com and make.com: compact chrome, maximum canvas space, inline editing, visual dot grid, and clean overlay patterns. The sidebar collapses to a 48px icon rail like n8n's left nav.

## Why this matters

Every feature we build later (canvas, AI prompt, templates) lives inside this shell. Getting the layout right now means we won't have to refactor it when we add features.

## Dependencies

- Spec 01 (Design System) — DONE

## Scope

### Build

- **Sidebar** — inline collapsible left panel (240px open, 48px collapsed icon rail)
  - Logo/brand area at top ("spi AI" wordmark when open, icon when collapsed)
  - Navigation items with icons: Dashboard, Templates, Settings (placeholder links)
  - Collapse/expand toggle button with animated width transition (Framer Motion)
  - User area at bottom (placeholder avatar + name, name hidden when collapsed)
  - Tooltips on icons when sidebar is collapsed (shadcn Tooltip)
  - `localStorage` persistence for sidebar open/collapsed state
  - Auto-collapses on screens < 768px
- **Toolbar** — fixed top bar across the canvas area
  - Project name (inline-editable: click to edit, Enter to save, Escape to cancel)
  - Breadcrumb: "Projects" > project name
  - Zoom controls (zoom in, zoom out, fit-to-view) — grouped with raised background
  - Action buttons: Share (Users icon), Export (Download icon), AI Assist (Sparkles icon with `--accent-ai`) — all disabled placeholders
  - Status dot (green = saved) and avatar placeholder on the right
- **Canvas area** — remaining space, empty for now with dot grid background and centered empty state
- **Prompt bar** — fixed bottom center with glass-morphism styling, disabled shell
- **Responsive behavior** — sidebar auto-collapses on screens < 768px

### Do NOT build

- Actual navigation/routing (just visual layout)
- Canvas functionality (that's spec 06)
- Auth or user data (that's spec 03)
- Any API calls

## Files to create/modify

| File | Action |
|------|--------|
| `app/editor/layout.tsx` | Create — editor layout with sidebar + canvas slot |
| `components/editor/sidebar.tsx` | Create — collapsible sidebar component |
| `components/editor/editor-navbar.tsx` | Modify — add action buttons (Share, Export, AI Assist) |
| `components/editor/canvas-area.tsx` | Keep — already built |
| `components/editor/prompt-bar.tsx` | Keep — already built |
| `app/editor/page.tsx` | Simplify — becomes canvas + prompt bar only |
| `app/page.tsx` | Modify — add a link to /editor |

## Acceptance criteria

- [ ] `/editor` route renders the full shell (sidebar + toolbar + canvas area)
- [ ] Sidebar collapses/expands with smooth Framer Motion width animation
- [ ] Collapsed sidebar shows icon-only rail with tooltips
- [ ] Sidebar state persists in localStorage
- [ ] All sections use design tokens from spec 01
- [ ] Grid background visible in canvas area
- [ ] Action buttons visible in toolbar (disabled)
- [ ] Layout is responsive — sidebar auto-collapses on mobile
- [ ] No hydration errors, no console warnings
- [ ] `npm run build` passes clean

## Design notes

- Use `cn()` from `lib/utils` for conditional classes
- Sidebar state: `useState` with `localStorage` persistence
- Grid background: CSS `radial-gradient` dots at low opacity
- Icons: `lucide-react` (PanelLeftClose, PanelLeft, ZoomIn, ZoomOut, Maximize, Share2, Download, Sparkles, LayoutDashboard, FileText, Settings)
- Framer Motion `animate` on sidebar width transition
- Tooltip from shadcn for collapsed sidebar items

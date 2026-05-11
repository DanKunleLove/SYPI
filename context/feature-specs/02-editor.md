# Unit 02: Editor Chrome

Base chrome components that frame the editor screen — top navbar, left sidebar shell, canvas placeholder, and prompt bar shell. These are reused and extended in every chapter that follows.

Inspired by n8n.com and make.com editor UX: compact chrome, maximum canvas space, inline editing, visual dot grid, and clean overlay patterns.

---

## Editor Navbar

Create `components/editor/editor-navbar.tsx` — `"use client"`

### Requirements

- Fixed height `h-12` (48px) top navbar — compact like n8n to maximize canvas space
- Three sections: left, center, right
- **Left section:**
  - Sidebar toggle button using `PanelLeftOpen` / `PanelLeftClose` icons based on sidebar state
  - Breadcrumb: "Projects" (muted link) > separator > project name (primary text)
- **Center section:**
  - Editable project name — renders as text, click to switch to input (inline edit pattern like n8n's workflow name)
  - Uses `--text-primary` for the name, `--text-muted` for placeholder
  - On blur or Enter, saves and switches back to text display
  - For now, use local state only (no persistence)
- **Right section:**
  - Zoom controls group: zoom out (`Minus`), zoom percentage display, zoom in (`Plus`), fit-to-view (`Maximize2`) — grouped with `--bg-surface-raised` background and `rounded-lg`
  - Status indicator dot: small colored circle showing project state (green = saved, amber = unsaved changes) — decorative only for now
  - Placeholder slot for user avatar (empty `div` with `rounded-full` and border, 32px)
- Dark background `--bg-surface` with subtle bottom border `--border-default`

### Props

```ts
interface EditorNavbarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}
```

---

## Project Sidebar

Create `components/editor/project-sidebar.tsx` — `"use client"`

### Requirements

- **Overlay pattern:** Floats above the editor canvas, does NOT push content
- **Backdrop:** Semi-transparent overlay behind sidebar; clicking it closes the sidebar
- **Width:** 320px fixed
- **Slide-in animation:** Framer Motion `animate` from `x: -320` to `x: 0`, duration 0.2s, ease "easeOut"
- **Header:**
  - "Projects" title (text-lg, font-semibold)
  - Close button with `X` icon
- **Search input:**
  - Below header, full-width
  - `Search` icon prefix
  - Placeholder: "Search projects..."
  - Filters project list in real-time (local filter for now)
- **Recent projects section:**
  - Label: "Recent" (text-xs, uppercase, `--text-muted`)
  - Shows last 3-4 project items as compact cards
  - Each card: project name, "Edited 2h ago" timestamp, small status dot
  - Uses `--bg-surface-raised` on hover
- **Tabs** (shadcn `Tabs`):
  - "My Projects" / "Shared"
  - Both tabs show empty placeholder state with icon and message
- **Footer:**
  - Full-width "New Project" button with `Plus` icon
  - Uses primary accent color

### Props

```ts
interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}
```

---

## Canvas Placeholder

Create `components/editor/canvas-area.tsx` — `"use client"`

### Requirements

- Takes full remaining viewport space (flex-1)
- **Dot grid background pattern:**
  - CSS radial-gradient dots on `--bg-base` background
  - Dot color: `--border-default` at ~40% opacity
  - Dot size: 1px, spacing: 24px
  - Gives immediate visual identity matching n8n/make.com
- **Empty state** (centered when no project loaded):
  - Large icon (`Workflow` or `GitBranch`, `h-12 w-12`, `--text-muted`)
  - Heading: "Describe your system architecture"
  - Subtitle: "Type a prompt below to generate your first diagram" (`--text-secondary`)
  - Subtle fade-in animation with Framer Motion
- This component is a placeholder — the real canvas (Liveblocks) replaces it later

---

## Prompt Bar Shell

Create `components/editor/prompt-bar.tsx` — `"use client"`

### Requirements

- Fixed to bottom center of the canvas area, `bottom-6`
- Max-width `max-w-2xl` (672px), centered with `mx-auto`
- **Container styling:**
  - `--bg-surface` background with `border` using `--border-subtle`
  - `rounded-2xl` border radius
  - Subtle shadow: `shadow-lg shadow-black/20`
  - `backdrop-blur-sm` for glass effect
- **Input area:**
  - Textarea (single row, auto-expand disabled for now)
  - Placeholder: "Describe your system architecture..."
  - `--text-primary` for input text, `--text-muted` for placeholder
- **Send button:**
  - Right side of input, `SendHorizonal` icon
  - Uses `--accent-primary` background, disabled state for now
  - `rounded-xl`
- **Keyboard hint:**
  - Small text below input: "Press Ctrl+Enter to send" (`--text-muted`, text-xs)
- Currently non-functional — wired up when AI integration is built

---

## Dialog Pattern

No new dialog components in this unit. Confirm the existing shadcn `Dialog` in `components/ui/dialog.tsx` works with our design tokens:

- Overlay uses `backdrop-blur-sm`
- Content uses `--bg-surface`, `rounded-2xl`, `--border-default`
- Supports title, description, footer actions
- Escape key closes

---

## Editor Layout Page

Create `app/editor/page.tsx`

### Requirements

- Full viewport height layout (`h-screen`, `flex flex-col`, `overflow-hidden`)
- Renders `EditorNavbar` at top
- Main area is `flex-1 relative` containing:
  - `ProjectSidebar` (overlay)
  - `CanvasArea` (fills space)
  - `PromptBar` (fixed bottom)
- Sidebar open/close state managed with `useState` in this page
- `"use client"` since it manages interactive state

---

## Checklist

- [ ] All new components import and render without errors
- [ ] No lint errors
- [ ] Sidebar opens/closes with animation
- [ ] Clicking backdrop closes sidebar
- [ ] Project name is inline-editable in navbar
- [ ] Dot grid is visible on canvas
- [ ] Prompt bar is positioned and styled correctly
- [ ] Dialog pattern confirmed working with design tokens
- [ ] Build succeeds (`next build` or `npm run build`)

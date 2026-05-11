# UI Context

## Theme

Dark only. No light mode. The design language is a sleek, technical workspace — deep dark backgrounds, layered surfaces with subtle elevation, and vivid accent colors for interactive and AI-driven elements. The feel is premium developer tooling, not generic SaaS.

## Colors

All components must use these CSS custom property tokens. No hardcoded hex values.

| Role              | CSS Variable          | Value     | Usage                                    |
| ----------------- | --------------------- | --------- | ---------------------------------------- |
| Page background   | `--bg-base`           | `#09090b` | Root background (zinc-950)               |
| Surface           | `--bg-surface`        | `#18181b` | Cards, panels, sidebars (zinc-900)       |
| Surface raised    | `--bg-surface-raised` | `#27272a` | Hover states, elevated elements (zinc-800) |
| Primary text      | `--text-primary`      | `#fafafa` | Headings, primary content (zinc-50)      |
| Secondary text    | `--text-secondary`    | `#a1a1aa` | Descriptions, labels (zinc-400)          |
| Muted text        | `--text-muted`        | `#71717a` | Placeholders, disabled (zinc-500)        |
| Primary accent    | `--accent-primary`    | `#6366f1` | Buttons, links, active states (indigo-500) |
| Accent hover      | `--accent-hover`      | `#818cf8` | Hover on accent elements (indigo-400)    |
| AI accent         | `--accent-ai`         | `#a78bfa` | AI-generated elements, AI indicators (violet-400) |
| AI accent glow    | `--accent-ai-glow`    | `#7c3aed` | AI pulse/glow effects (violet-600)       |
| Border default    | `--border-default`    | `#27272a` | Dividers, card borders (zinc-800)        |
| Border subtle     | `--border-subtle`     | `#3f3f46` | Hover borders, focus rings (zinc-700)    |
| Error             | `--state-error`       | `#ef4444` | Destructive actions, validation (red-500) |
| Success           | `--state-success`     | `#22c55e` | Confirmations, connected states (green-500) |
| Warning           | `--state-warning`     | `#eab308` | Caution indicators (yellow-500)          |

## Typography

| Role       | Font       | Variable        | Usage                      |
| ---------- | ---------- | --------------- | -------------------------- |
| UI text    | Geist Sans | `--font-sans`   | All interface text         |
| Code/mono  | Geist Mono | `--font-mono`   | Code blocks, node labels, specs |

## Border Radius

| Context            | Class         |
| ------------------ | ------------- |
| Inline / small UI  | `rounded-md`  |
| Buttons            | `rounded-lg`  |
| Cards / panels     | `rounded-xl`  |
| Modals / overlays  | `rounded-2xl` |
| Canvas nodes       | `rounded-lg`  |

## Component Library

shadcn/ui on top of Tailwind CSS 4. Components live in `components/ui/`. Use the shadcn CLI to add new components — do not write UI primitives from scratch. Customize via Tailwind classes and CSS variables, not by editing the generated files.

## Layout Patterns

- **Dashboard**: Full-viewport with top navbar and content area below. Project grid with cards.
- **Workspace/Editor**: Full-viewport with collapsible left sidebar (project info, templates), center canvas (takes remaining space), and collapsible right sidebar (AI chat, suggestions, spec preview).
- **Sidebars**: Fixed width (280px default), collapsible, with border separator on the canvas-facing edge.
- **Canvas**: Takes full remaining viewport space. Dark background with subtle dot grid pattern. Zoom and pan enabled.
- **Modals**: Centered overlay with backdrop blur. Max-width constraint. Rounded-2xl.
- **Navbar**: Top bar with bottom border. Logo left, navigation center, user avatar right. Height 56px.
- **Prompt bar**: Fixed to bottom of canvas area. Centered, max-width, with input field and send button. Elevated with subtle shadow.

## Icons

Lucide React. Stroke-based icons only. Consistent sizing:
- `h-4 w-4` — Inline, small UI, button icons
- `h-5 w-5` — Standalone buttons, navigation items
- `h-6 w-6` — Empty states, feature highlights

## Motion

Framer Motion for all animations. Keep transitions subtle and fast:
- Page transitions: `duration: 0.2s, ease: "easeOut"`
- Hover effects: `duration: 0.15s`
- AI node appearance: `duration: 0.3s` with a subtle scale-up and fade-in
- Canvas node connections: animated dashed stroke for data flow direction
- AI processing indicator: pulsing glow using `--accent-ai-glow`

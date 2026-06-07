# UI Context

## Theme

**Light + dark, with a toggle.** Default follows the OS preference (`next-themes`, `attribute="class"`).
The palette is built on three brand colors — **ice white, powder blue, royal blue** — with neutral
slate text/borders. Light reads as a clean, restrained professional product; dark is a navy-black
(blue undertone) technical workspace. AI elements use royal/powder blue — **no violet/purple**.

Theme is set by the `dark` class on `<html>` (managed by next-themes). `:root` holds the light
token set; `.dark` overrides only the spi AI tokens. The shadcn mappings reference the spi tokens,
so they re-resolve automatically — never duplicate them per theme.

## Colors

All components must use these CSS custom property tokens. **No hardcoded hex values.** Each token
has a light value (`:root`) and a dark value (`.dark`) in `app/globals.css`.

| Role            | CSS Variable          | Light       | Dark        | Usage                                  |
| --------------- | --------------------- | ----------- | ----------- | -------------------------------------- |
| Page background | `--bg-base`           | `#f6f8fb`   | `#0a0f1a`   | Root background (ice white / navy-black) |
| Surface         | `--bg-surface`        | `#ffffff`   | `#111827`   | Cards, panels, sidebars                |
| Surface raised  | `--bg-surface-raised` | `#eef3f9`   | `#1c2740`   | Hover states, elevated elements        |
| Primary text    | `--text-primary`      | `#0b1b33`   | `#f1f5f9`   | Headings, primary content              |
| Secondary text  | `--text-secondary`    | `#475569`   | `#94a3b8`   | Descriptions, labels                   |
| Muted text      | `--text-muted`        | `#8794a6`   | `#64748b`   | Placeholders, disabled                 |
| Primary accent  | `--accent-primary`    | `#1d4ed8`   | `#3b82f6`   | Buttons, links, active states (royal blue) |
| Accent hover    | `--accent-hover`      | `#1e40af`   | `#60a5fa`   | Hover on accent elements               |
| AI accent       | `--accent-ai`         | `#2563eb`   | `#60a5fa`   | AI-generated elements / indicators (blue) |
| AI accent glow  | `--accent-ai-glow`    | `#93c5fd`   | `#2563eb`   | AI pulse/glow effects (powder blue)    |
| Powder          | `--powder`            | `#bfdbfe`   | `#1e3a5f`   | Powder-blue accent surfaces, badges    |
| Border default  | `--border-default`    | `#e2e8f0`   | `#1e293b`   | Dividers, card borders                 |
| Border subtle   | `--border-subtle`     | `#cbd5e1`   | `#334155`   | Hover borders, focus rings             |
| Error           | `--state-error`       | `#dc2626`   | `#ef4444`   | Destructive actions, validation        |
| Success         | `--state-success`     | `#16a34a`   | `#22c55e`   | Confirmations, connected states        |
| Warning         | `--state-warning`     | `#d97706`   | `#eab308`   | Caution indicators                     |

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

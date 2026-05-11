Read `AGENTS.md` before starting.

# Unit 01: Design System and UI Primitives

## Goal

Install and configure shadcn/ui with a dark-only theme, add CSS design tokens from `context/ui-context.md`, install core UI primitive components, and set up shared utilities. Every component must render in dark mode with no light-mode leakage.

## Design

- Dark-only theme — `dark` class on `<html>`, no toggle
- All colors via CSS custom properties defined in `globals.css`
- Color tokens sourced from `context/ui-context.md`
- Geist Sans for UI text, Geist Mono for code — mapped to `--font-sans` and `--font-mono`

## Implementation

### 1. CSS Design Tokens

Add all color tokens from `ui-context.md` to `app/globals.css` as CSS custom properties inside a `.dark` selector (shadcn convention). Set base background and foreground.

### 2. Root Layout

- Add `class="dark"` to `<html>` tag to enforce dark mode
- Update metadata from "Create Next App" to "spi AI"
- Apply dark background and text colors to `<body>`

### 3. shadcn/ui Init

Run `npx shadcn@latest init` with:
- Style: New York
- Base color: Zinc
- CSS variables: enabled

This creates `components.json` and `lib/utils.ts` (with the `cn()` helper).

### 4. shadcn Components

Add these components via the shadcn CLI:
- Button
- Input
- Dialog
- Card
- Tabs
- Textarea
- ScrollArea
- Tooltip
- Separator

Do not modify the generated `components/ui/*` files after installation.

### 5. Icons

Install `lucide-react` for the icon library.

## Dependencies

- `shadcn` (CLI — dev tool, not a runtime dependency)
- `lucide-react`
- `clsx` + `tailwind-merge` (installed automatically by shadcn init)

## Verify when done

- [ ] All 9 shadcn components import without errors
- [ ] `cn()` helper works and is exported from `lib/utils.ts`
- [ ] No default light styling appears — entire app renders dark
- [ ] CSS custom property tokens are defined in `globals.css`
- [ ] Layout metadata says "spi AI"
- [ ] `npm run build` passes

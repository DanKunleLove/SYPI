# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

**2026-06-07: DEPLOYED — Live at https://spi-ai-dev.vercel.app**

### 2026-07-13 — Global command palette (Ctrl/⌘+K)

Linear-style palette, mounted in `(workspace)/layout.tsx` so it works on dashboard, canvas,
settings, team. New `components/command-palette.tsx` (cmdk@1.1.1).

- Groups: **This canvas** (AI Twin, System Kit/export, review, comments, share, save —
  shown only inside a project), **Go to** (new project, dashboard, AI settings, team),
  **Projects** (fuzzy search, top 30, jump to canvas), **Help & app** (help panel,
  feedback widget, theme toggle).
- Canvas-scoped actions dispatch a `spi:workspace-command` window event; `WorkspaceContent`
  (project-workspace.tsx) listens and drives `setRightPanel`/critique/share/save. Keeps the
  palette global without threading workspace state up the tree.
- Every selection records a `palette_used` UsageEvent (action id) for the activation funnel.
- tsc + `next build` exit 0 (41 routes).

### 2026-07-12 (final) — Admin dashboard: feedback loop + activation metrics (commit 87290b1)

First admin surface. `/admin` page (server-rendered, `force-dynamic`), gated by
`lib/admin.ts` `getAdminUser()` — `ADMIN_EMAILS` env (comma-separated, case-insensitive);
non-admins get 404. Sidebar Admin link shown via `GET /api/admin/me`.

- **MetricsPanel** (`lib/metrics.ts` `getPlatformMetrics()`): total users, all-time
  activation rate (first completed generation within 7d of signup), median TTV, generations,
  kits by domain, exports, 👍/👎, open feedback, 8-week signup cohorts (activation % +
  week-2 return %). Computed in JS over bounded queries — move to SQL aggregates at scale.
- **FeedbackBoard**: in-app feedback widget (`components/feedback/feedback-widget.tsx`,
  `POST /api/feedback`) → `Feedback` model (type/message/path/status/adminNote); admin
  triages via `PATCH /api/admin/feedback`.
- **ComplaintRadar**: 25 most recent 👎-rated generations with prompt + project + owner.
- **UsageEvent** model + `lib/events.ts` `recordEvent()` + `POST /api/events` (fire-and-
  forget client tracking: kit_generated, exports, palette_used…). Migration
  `20260712070125_feedback_usage_events` applied.

### 2026-07-12 (later) — System Kit v3: DOMAIN PACKS (Phase 3 shipped, expanded scope)

Dan approved building Phase 3 immediately (ungated) and expanding past the named fields.
The kit now serves 8 domains via a pack registry (`KIT_DOMAINS` in `lib/ai/kit.ts`):
**Software, Automation (n8n/agents), Video, Image, Music, Writing, Marketing, Business.**

- Each domain = `KitDomain { id, label, hint, role, files, codeProfiles }`. Per-domain file
  sets (5–7 files) follow the same skeleton — overview, structure-from-canvas, consistency
  system, AI workflow rules, progress tracker — with domain-expert guidance grounded in
  2026 research: video (reference-anchor consistency, shot-based iteration, first/last
  frames), image (style refs/seeds, prompt library, one-variable iteration), music
  (~10 focused descriptors, stems→DAW handoff, rights via human elements), writing
  (content bible/continuity record, fact discipline, voice passes), marketing (funnel
  architecture, claim rules, review gates), business (SOPs, decision rights, data
  discipline), automation (idempotency, error paths, credential rules).
- `kitSystemPrompt(domain)` frames the generator role per domain (engineer / art
  director / producer / editor / strategist / ops consultant).
- `kitEntryFile(projectName, domain)` — entry read-order list is now built dynamically
  from the domain's file specs (each spec gained a `summary`).
- Route `POST /api/ai/kit` accepts `domain` (validated against registry, 400 on unknown,
  falls back to software when absent) and iterates `domain.files`.
- Zip layout: code domains (software/automation) keep the platform-profile overlays;
  creative/business domains always ship root `KNOWLEDGE.md` (paste into ChatGPT/Claude/
  Gemini/Lovable persistent context; excludes tracker/env/tool-setup) + `PROMPTING-GUIDE.md`.
  `lovableKnowledgeFile`/`lovablePromptingGuide` generalized → `kitKnowledgeFile(domain)`/
  `kitPromptingGuide`.
- UI: "What are you building?" domain pills (single-select, `spi-kit-domain` localStorage)
  above the platform pills (shown only for code domains). Checklist renders the domain's
  files. Help panel copy updated.
- Cost note: kits are 5–7 LLM calls depending on domain (unchanged ceiling math).

### 2026-07-12 — System Kit v2: platform profiles + .env template

The kit is now a multi-platform system generator (research brief same date: AGENTS.md is
the Linux Foundation cross-tool standard, 28+ tools; competitors like rule-porter/RepoRules
only convert/analyze existing repos — SYPI generates the system from the designed
architecture before code exists).

- `lib/ai/kit.ts`: 7th AI-generated file `env.example` (raw dotenv, per-component vars with
  where-to-get-it comments); `KIT_PROFILES` (claude-code / cursor / copilot / windsurf /
  lovable); `cursorRuleFile()` (.mdc frontmatter wrapper), `lovableKnowledgeFile()`
  (paste-ready Knowledge doc concatenating 5 kit files), `lovablePromptingGuide()` (static
  4-part prompt structure guide). Entry file now uses `context/` paths + .env instructions.
- `lib/export.ts` `downloadSystemKit(..., profiles)`: always ships AGENTS.md + context/×6 +
  `.env.example` (fence-stripped) + spi-schema.json; overlays per profile — CLAUDE.md,
  `.cursor/rules/sypi-system.mdc`, `.github/copilot-instructions.md`,
  `.windsurf/rules/sypi-system.md`, `lovable/KNOWLEDGE.md` + `lovable/PROMPTING-GUIDE.md`.
- Spec tab kit card: "Where will you build?" toggle pills (persisted in
  `spi-kit-profiles` localStorage, default claude-code). Help panel copy updated.
- API route unchanged except it now streams 7 files (iterates KIT_FILES); still 3/10min
  rate limit. No extra profile cost — overlays are deterministic client-side transforms.

**ROADMAP — next after this ships (Dan, 2026-07-12):**
1. **Non-code domain kits** (Dan wants a reminder post-push): system packs for AI video
   generation, image generation, music generation, writing, etc. — folds into the Phase 3
   domain-pack registry (gated on 👍/👎 data per the locked thesis).
2. Capacity/scaling when monetizing: enable Gemini billing (removes the 250 req/day shared
   ceiling ≈ 10–20 AI-active users/day), Vercel Pro (Hobby forbids commercial use), then
   Liveblocks (500 rooms/mo) and Neon paid as pressure appears. BYOK users bypass the
   Gemini ceiling entirely.
3. Phase 4: Trigger.dev retirement + landing repositioned around the system-generator thesis.

### 2026-07-06 — Collaboration bundle: canvas comment pins, laser pointer, team chat

Finishes the deferred "node-anchored comments" (Phase B v2) plus two live-collab features.
tsc + `next build` exit 0 (39 routes).

- **Canvas-anchored comment pins**: new `components/canvas/comment-layer.tsx` — threads with
  `{x, y}` metadata (flow coords, `ThreadMetadata` now typed optional so panel threads still
  work) render as pins that track pan/zoom; click opens the thread inline; resolved pins hide.
  Pin tool added to the canvas toolbar (`MessageSquarePlus`) → placement mode: click-catcher
  captures one canvas click → inline `Composer` with the coords as metadata. Esc backs out
  (draft → mode → open thread).
- **Comments panel → "Collaborate" panel** (`comments-panel.tsx`): two tabs — **Threads**
  (pinned threads get a "Canvas" jump button that `setCenter`s the flow to the pin) and
  **Team chat** (Liveblocks feed `team-chat`, `FeedMetadata.type` extended; bubble UI,
  Enter to send). Human chat is deliberately separate from AI Twin + comment threads.
- **Laser pointer**: hold `L` on the canvas → `presence.laser` broadcasts; `custom-cursor.tsx`
  renders others' cursors as a glowing red pulse with name tag. Guarded against typing targets.
- **Polish**: suggestion chips scale to 90% when a right panel is open (canvas narrows).

**Follow-up 2026-07-07 (both deferred items done):** laser now releases on window
`blur`/`visibilitychange` (keyup can't fire if focus leaves mid-hold); off-viewport
comment pins render as small edge-clamped indicators (ResizeObserver-measured layer)
that `setCenter` the flow to the pin on click.

### 2026-07-05 (evening) — Conversational agent core (Phase 1) + System Kit (Phase 2)

**Product thesis locked** ([[spi-ai-product-direction]]): "the gap between seniors and vibe
coders is the proper system — SYPI generates the system." Approved plan: Phase 1
conversational core → Phase 2 System Kit → Phase 3 domain packs (gated on 👍/👎 data) →
Phase 4 Trigger.dev retirement + landing repositioning.

**Phase 1 — one conversation, no silent AI (approach A3: agent front-door + pipelines):**
- `lib/ai/agent-tools.ts` — heavy tools wrapping the schema-enforced pipelines:
  `generateArchitecture` (plan-approval contract in prompt; URL grounding; daily cap;
  writes AIGeneration; updates shared mutable ctx so a review in the same turn sees the
  new architecture), `runDesignReview` (inline critique), `refineArchitecture` (diff ops),
  `researchUrl`. Chat route merges them with the light canvas tools; `stepCountIs(8)`,
  `maxDuration = 300`.
- `CHAT_SYSTEM_PROMPT` rewritten as agent conductor: propose-plan-before-build, narrate
  before/after every tool, translate results to plain language, never dump JSON.
- `ai-panel.tsx` ChatTab: mode pills (Generate/Chat/URL) + separate plan flow REMOVED —
  single thread. Tool calls render as live action cards (`ToolActionCard`): running
  spinner → result (components placed + reasoning / review severity list / changes
  applied / research brief) or error. Client applies `placeArchitecture` via
  placeArchitectureOnCanvas + `registerPlacement` (revert/rate card works for agent
  generations) and `applyDiff` via canvas-diff engine.
- `/api/ai/plan` + `/api/ai/generate` routes kept (API surface), but the panel now goes
  through the agent exclusively.

**Phase 2 — System Kit (the thesis feature):**
- `lib/ai/kit.ts` — KIT_FILES (six-file definitions w/ per-file guidance distilled from
  Dan's playbook), `KIT_SYSTEM_PROMPT` (derive from ACTUAL canvas, no filler), static
  `kitEntryFile` (CLAUDE.md/AGENTS.md entry point).
- `POST /api/ai/kit` — streams NDJSON per file (6 sequential generateText on owner-resolved
  flash model); auth + access + 3/10min rate limit; maxDuration 300.
- Spec tab hero card: "System Kit" with live per-file checklist → downloads
  `{name}-system-kit.zip` (CLAUDE.md + AGENTS.md + context/×6 + spi-schema.json) via new
  `downloadSystemKit` in lib/export.ts.
- Help panel updated: modes removed from copy, System Kit documented.

**Deferred:** Phase 3 domain packs; Phase 4 Trigger retirement (Review button still uses
the worker); measuring full agent-turn latency in prod (watch: chained research→generate
turns near the 300s cap on slow models).

### 2026-07-05 (final) — Site audit, onboarding v3, help refresh, repo ownership cleanup

**Audit diagnosis (full-repo):** README was a tutorial e-book (playbook) → rewritten as SYPI's
own README (playbook preserved locally at `_local/ai-builders-playbook.md`, gitignored).
Untracked 136 AI-tool files from git (kept on disk): `.claude/` (120 vendored skill refs),
`.cursor/`, `.gemini/`, `.vscode/`, `.github/instructions/` (vendored trigger docs),
`GEMINI.md`, `skills-lock.json`. No secrets found in any tool config. package.json →
v1.0.0 + description/author.

- **Onboarding v3** (`spi-onboarding-v3-done`): 4 steps — generate (incl. paste-a-URL +
  self-review), refine/collaborate (incl. Revert), export, and NEW step 4: help (`?` key),
  custom instructions, BYOK. Shows once more for existing users (key bump).
- **Help panel**: added URL real-grounding, self-review pipeline, revert/restore/rate,
  custom instructions items; section renamed "AI Settings — Keys & Custom Instructions";
  footer "View full docs" (dead link to /welcome) → "Email support" (mailto).
- **Deferred from audit** (next sessions): landing/dashboard masterclass polish; docs/
  Mintlify guides content refresh for new features; node-anchored comments; landing
  feature-claims re-verification; Clerk Organizations (Phase A).

### 2026-07-05 (later) — Revert/restore, self-critique, feedback, custom instructions, UX polish

**Migration `20260705120000_rating_custom_instructions` APPLIED** (`AIGeneration.rating Int?`,
`User.customInstructions String?`). Note: had to `migrate resolve --applied 20260604200000_add_share_token`
first — it was applied manually via Neon SQL editor in June but never marked.

- **Revert/Restore**: `use-generation.ts` tracks `lastGeneration` (placed node/edge IDs +
  architecture); `revertGeneration()` removes them, `restoreGeneration()` re-places (fresh IDs).
  Result card in ChatTab with Revert/Restore + dismiss.
- **Self-critique loop** (`generate/route.ts`): after generateObject, a flash critique pass
  (CritiqueOutputSchema); critical issues trigger ONE full-architecture repair generation before
  placing. Best-effort — critique failure never blocks. Streamed as "reviewing"/"refining" stages.
- **Feedback**: 👍/👎 on the result card → `POST /api/ai/feedback` (access-checked) →
  `AIGeneration.rating` (1/-1, tap again clears). Data for the quality loop.
- **Custom instructions (user prompt layer)**: `User.customInstructions` (≤2000 chars),
  `GET/PUT /api/settings/instructions`, `applyUserInstructions()` APPENDS to generate/plan/chat
  system prompts — never replaces the base schema contract (deliberate: replacing would break
  generateObject). Settings page renamed "AI settings", new InstructionsSettings card.
- **UX**: generation banner is now a live pipeline (Research → Design → Review → Refine → Place,
  server-streamed stages, checkmarks + pulse); Enter sends / Shift+Enter newline (was Ctrl+Enter);
  dead `PlaceholderTab` removed. Mermaid export already existed (lib/export.ts) — no work needed.
- tsc + `next build` exit 0. **Deferred:** full-app masterclass UI audit (dashboard/canvas/landing)
  — needs its own session; project-level custom instructions (only user-level built).

### 2026-07-05 — Real URL grounding + AI-route security + streaming generation

**A. URL grounding (fixes "URL analysis returns generic nonsense"):**
- New `lib/ai/url-research.ts`: `extractUrls()`, `fetchSiteEvidence()` (SSRF-guarded live
  fetch of the actual site — DNS-resolves and blocks private/metadata IPs, revalidates each
  redirect hop; extracts title/meta, ~20 HTML + ~14 header tech fingerprints, third-party
  script hosts, visible page text), `researchSite()` (evidence + Gemini google_search brief).
  Verified live: linear.app → detects Next.js + Cloudflare + real page text; 169.254.169.254
  and localhost blocked.
- URLs pasted into ANY prompt now trigger research — generate route auto-detects (no separate
  URL mode needed), plan + chat routes inject fetch-only evidence into the system prompt.
- `URL_ANALYSIS_SYSTEM_PROMPT` rewritten evidence-first: observed tech MUST appear, silent
  layers marked "Inferred:", the old "make educated inferences" hallucination license removed.

**B. Security hardening:**
- New `lib/rate-limit.ts` (in-memory sliding window, per-instance) applied per user:
  generate 6/min, plan 15/min, chat 20/min → 429 + Retry-After.
- Durable daily cap on generation: 100/24h per user, counted via AIGeneration in the DB.
- Input caps: prompt 6k chars, canvasContext 24k, plan ≤40 turns × 8k, chat ≤60 messages.
- SSRF guard (above) covers the new server-side fetches.

**C. Streaming generation UX:**
- `/api/ai/generate` now streams NDJSON (`status` events → `result`/`error`) instead of a
  silent 10–30s JSON wait; `use-generation.ts` parses the stream and shows live stage text
  ("Reading {url} and researching the stack…" → "Designing the architecture…").

tsc + `next build` exit 0. In-memory limiter resets on cold start (documented); durable cap
covers the platform-quota risk. Upstash/Redis limiter is the upgrade path if abuse appears.

### 2026-06-08 — Generation moved inline; plan-then-execute is now a conversation

**Why:** Generation was the only AI path that offloaded to a Trigger.dev worker
(`design-agent`). Plan + chat run inline and worked; generate failed in both local
and prod because the worker wasn't reliably running/deployed. A single `generateObject`
call (~10–30s) doesn't need a durable worker.

**Changes (Option B):**
- New `app/api/ai/generate/route.ts` — inline generation (resolveModelForProject +
  generateObject, URL-research step preserved), `maxDuration = 120`, writes the
  AIGeneration record for history, returns `{ generationId, architecture }`.
- `hooks/use-generation.ts` — calls `/api/ai/generate` and places nodes directly.
  Removed Trigger.dev polling, runId, and Liveblocks completion/status listeners.
- `app/api/ai/plan/route.ts` — accepts a `messages[]` conversation (back-compat with
  single `prompt`), streams plan turns.
- `components/workspace/ai-panel.tsx` — plan is now a **discussable conversation**:
  send to draft a plan, keep typing to refine it across turns, then
  **"Generate from this plan"** sends the transcript to inline generation. Old
  one-shot Approve/Refine card removed.

**Still on Trigger.dev (unchanged, same worker dependency — migrate next if needed):**
`/api/ai/design` + `trigger/design-agent.ts` (legacy generate path, now off the hot path),
`/api/ai/critique` + `trigger/critique-architecture.ts`, `/api/ai/refine` +
`trigger/refine-architecture.ts`, `/api/ai/design/token`.

### 2026-06-08 — Vercel Web Analytics

Added `@vercel/analytics`; `<Analytics />` mounted in `app/layout.tsx` (App Router import
`@vercel/analytics/next`). Tracks page views/visitors automatically; `track()` available for
custom events. **Still required:** enable Web Analytics in the Vercel project's Analytics tab —
data only flows once toggled on. No-op in local dev.

### 2026-06-07 — Renamed "spi AI" → SYPI (System Project Intelligence)

Platform renamed to **SYPI** (all-caps wordmark; backronym: System Project Intelligence).
Vercel/domain moved to `sypi-ai-dev.vercel.app`. Applied across user-facing copy (logo,
metadata, OG/Twitter, landing/auth/share copy, email sender + signature, AI Twin system prompt,
export footers), `package.json` name (`sypi-ai`), and canonical docs.
**Deliberately NOT renamed** (functional, would break things): `lib/crypto.ts` BYOK salt
`spi-ai.byok.v1`; the `spi-schema.json` export format filename; localStorage keys
(`spi-sidebar-collapsed`, `spi-onboarding-v2-done`); drag MIME `application/spi-node-type`;
internal event `spi:open-create-project`. Dated feature-spec records left as historical.

### 2026-06-07 — Audit + rebrand: light/dark theme, royal-blue palette, save-bug fix

**Critical bug fixed — "save error":** `@vercel/blob@2.4.0` `put()` throws on overwrite unless
`allowOverwrite: true`. Fixed-path writes meant the first save worked and every later save 500'd.
Added `allowOverwrite: true` in `canvas/route.ts` + `thumbnail/route.ts`. The autosave hook now
surfaces the real server error via a sonner toast (was a silent "error" status).

**Light + dark theme (whole app, was dark-only):**
- `globals.css` restructured: `:root` = light tokens, `.dark` = dark overrides; shadcn mappings
  defined once (re-resolve per theme). New 3-color palette — ice white / powder blue / royal blue.
- `next-themes` wired (was installed, unused): `components/theme-provider.tsx`
  (`attribute="class"`, `defaultTheme="system"`). `<html>` no longer hardcodes `dark`.
- Clerk made theme-aware via `components/clerk-theme-provider.tsx` (was `baseTheme: dark` hardcoded).
- `components/theme-toggle.tsx` + sidebar theme row + landing nav toggle + canvas toolbar toggle.
- sonner Toaster + Liveblocks comments (`attributes.css`, `data-theme`) now follow the app theme.

**Killed the violet ("vibe-coded aura"):** `--accent-ai`/`--accent-primary` redefined to royal blue
— recolors all ~54 `var(--accent-ai)` refs for free. Recolored node categories (service/gateway
off indigo/violet), `NODE_COLORS`, `PROJECT_COLORS`, and landing hero gradients/mock.

**De-hardcoded hex:** thumbnail + PNG export capture now read `--bg-base` at runtime (were `#09090b`,
would render black in light mode).

**Verified:** `tsc --noEmit` clean, `next build` exits 0 (34 routes).

**Reported but deferred (not in this change):** AI-route rate limiting; rename `lib/mock-projects.ts`
→ `lib/projects.ts`; remove `~$DEPLOY.md` + gitignore `~$*`; re-verify landing feature claims.


### 2026-06-07 — Production deployment debugging + feature completion

**Production bugs fixed:**
- `proxy.ts` missing public routes: `/welcome`, `/share/*`, `/` — caused landing page + auth to redirect to Clerk hosted UI
- 6 DB migrations unapplied (PgBouncer ate DDL): `shareToken`, `thumbnailUrl`, `UserApiKey`, `defaultModel`, `title`, `CanvasTemplate` — applied via Neon SQL editor
- `LIVEBLOCKS_SECRET_KEY` was set to public key (pk_) instead of secret key (sk_) — canvas connection 403
- `NEXT_PUBLIC_APP_URL` missing `https://` prefix crashed `new URL()` in metadata — build error fixed

**New features shipped:**
- System templates (P5.1): 4 pre-built canvas architectures (Microservices, Serverless, Event-Driven, API Gateway) load on project creation
- Onboarding redesign: full-screen backdrop, animated progress bar, per-step accent colors, directional hints
- Favicon: SVG branch icon in indigo box
- OG metadata: og:title, og:description, og:image, Twitter card, SVG favicon
- Project card thumbnails: clean letter-initial placeholder instead of broken gradient

**Still needs user action:**
- `ENCRYPTION_SECRET` in Vercel → enables BYOK/API Keys settings page
- `TRIGGER_SECRET_KEY` in Vercel → must be from `Spi_AI` project (not `spi-ai`), format `tr_prod_...`
- `NEXT_PUBLIC_APP_URL` → update to `https://spi-ai-dev.vercel.app` (with https://)

**Not yet built (Phase A):**
- Clerk Organizations for workspace-level team management

Next action: Fix 2 Vercel env vars (ENCRYPTION_SECRET + TRIGGER_SECRET_KEY from correct project).

### 2026-06-04 — Final build sprint (P1–P6 complete)

**P1 fixes:**
- Node palette realigned to `bottom-4` (was floating too high at `bottom-20`)
- Node count display bug fixed (prevNodeCount guard removed — now fires on initial Liveblocks load)
- Suggestions wired: `useSuggestions` lifted to `WorkspaceContent`, `SuggestionChip` rendered bottom-right of canvas, real `SuggestionsTab` with "Apply with AI" buttons

**P2 onboarding + UX:**
- 3-step onboarding overlay (Describe → Refine → Export), localStorage-gated, skip-able, shows once per browser
- Critique → Chat handoff: "Fix all with AI Twin" in review panel formats all issues as prompt → opens ChatTab → auto-triggers plan-then-execute flow
- `ChatTab` auto-trigger: when `initialPrompt` is pushed (from suggestion or critique), calls `requestPlan()` automatically

**P3 landing + docs:**
- Public landing page at `/welcome` (hero, feature cards, how-it-works, CTA)
- Dashboard moved from `/` to `/dashboard` — all internal refs updated
- Mintlify docs scaffold: `docs/mint.json` + 7 full guides + 14 placeholder stubs
- Clerk redirects updated: sign-in/sign-up → `/dashboard`, sign-out → `/welcome`

**P4 product completeness:**
- Project thumbnails: capture 800×450 PNG on Ctrl+S → Vercel Blob → shown on dashboard cards
- User-saved templates: `CanvasTemplate` DB model, save dialog with private/public toggle, template picker shows My / Built-in / Community sections
- Public read-only share: `shareToken` on Project, `/share/[token]` viewer (no auth required), generate link button in ShareDialog

**P5 validation:**
- A-Z audit: 60/60 user flows verified — auth, dashboard, canvas, AI, critique, export, collaboration, settings, landing, onboarding, route integrity. Zero bugs found.

**P6 deployment prep:**
- `.env.example` updated with all 13 required vars + documentation
- `DEPLOY.md` created: 10-step deployment guide covering Vercel, Neon, Trigger.dev, Clerk/Liveblocks webhooks, Mintlify, custom domain

## Previous Current Phase

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

Roadmap (Dan's stated priorities): more export formats (Mermaid/OpenAPI/IaC); ~~BYOK + model picker~~ (done — see P5.3); self-critique loop; image-to-architecture; deeper research during planning; (future) autonomous follow-up agents.

### Team collaboration plan (C → B → A, started 2026-06-04)

From a backend-dev friend's feedback. Building order: **C (UX) → B (comments) → A (orgs)**. See [[spi-ai-product-direction]].

**Phase C — UX fixes (DONE, commit 6f6ca45):**
- "Projects" breadcrumb in the canvas toolbar is now a `<Link href="/">` (was a dead span).
- Export toolbar button enabled → opens the AI Twin panel on the **Spec** tab (`AiPanel` gained `initialTab`; `project-workspace` rightPanel ai mode gained optional `tab`).
- Collapsed-sidebar logo already reopened the sidebar (`onClick={collapsed ? onToggle : home}`) — no change needed.

**Phase B — comments + @mentions + email (DONE, build green):**
- **Comments** via Liveblocks Comments (`@liveblocks/react-ui` already installed). New `components/editor/comments-panel.tsx` (regular `useThreads` from `@liveblocks/react` so opening it doesn't suspend the whole workspace; `Thread` + `Composer`; imports `styles.css` + dark `media-query.css`). New right-panel mode `"comments"` + a MessageSquare toolbar toggle (`onToggleComments`).
- **@mentions**: `LiveblocksProvider` now has `resolveUsers` + `resolveMentionSuggestions` (liveblocks-room.tsx), backed by `GET /api/projects/[projectId]/members` — returns account-holding members keyed by **clerkId** (the Liveblocks userId from `prepareSession`), with name/avatar/cursorColor/email. Members fetch is cached per room.
- **Email on mention/reply**: `POST /api/webhooks/liveblocks` (`WebhookHandler` + `isThreadNotificationEvent`) → looks up the recipient's email (User by clerkId) + project, sends via `lib/email.ts` (Resend). Graceful no-op when `RESEND_API_KEY` unset (logs + skips). Webhook path is public via existing `/api/webhooks(.*)` matcher.
- **NEW env (all optional — features degrade without them):** `RESEND_API_KEY`, `EMAIL_FROM` (default `onboarding@resend.dev`), `LIVEBLOCKS_WEBHOOK_SECRET_KEY`, `NEXT_PUBLIC_APP_URL` (for the email deep link). Dashboard step: add a Liveblocks "notification" webhook → `/api/webhooks/liveblocks`.
- **Deferred (B v2):** node-anchored comment pins on the canvas (currently project-room-level threads); Liveblocks dark theme is via prefers-color-scheme (could force-match the app theme).

**Phase A — teams/orgs (NOT STARTED):** Clerk Organizations + discipline labels (PM/FE/BE/Security/Designer) separate from permission roles.

### BYOK + model picker (P5.3)

Users bring their own provider keys; generation routes to the chosen model. Providers: **Anthropic (Claude)**, **OpenAI (GPT)**, **Google (Gemini)**. Per-user default model.

- `lib/crypto.ts` — AES-256-GCM encrypt/decrypt for keys at rest. Key derived via scrypt from **`ENCRYPTION_SECRET`** env (NEW required env to use BYOK; without it, saving a key returns a clear 500 and nothing is stored in plaintext). Generate one with `openssl rand -base64 32`.
- `lib/ai/providers.ts` — provider registry (label, console URL, model list, tier defaults, SDK `create(apiKey, modelId)`); `parseModelRef`/`formatModelRef` for the `"provider:modelId"` storage format; only whitelisted models accepted.
- `lib/ai/index.ts` — `resolveModelForUser(userId, tier)` reads the user's keys + `defaultModel` (honors explicit default if its provider has a key, else strongest available provider's tier default; null when no keys). `resolveModelForProject(projectId, tier)` resolves from the **project owner's** keys, falling back to the platform Gemini key. `getModel()` kept as the platform fallback.
- Prisma: `UserApiKey { userId, provider, encryptedKey, last4, @@unique([userId, provider]) }` + `User.defaultModel`. Migration `20260601195403_byok_api_keys` applied.
- Routes: `app/api/settings/keys` (GET catalog+configured state w/ last-4 only, POST upsert, DELETE), `app/api/settings/model` (PUT default, validates provider key exists). Encrypted keys never returned to the client.
- UI: `/settings` page (`app/(workspace)/settings/`) + `components/settings/model-settings.tsx` — default-model `<select>`, per-provider key cards (masked last-4 badge, "Get key" link, save/replace/remove). Linked from the Clerk `UserButton` menu ("Models & API keys").
- Wiring: chat/spec + design/critique/refine tasks use `resolveModelForProject` (owner-keyed); plan route uses `resolveModelForUser` (acting user, no projectId). design-agent's URL-research step stays on platform Gemini (Google Search grounding is Gemini-only).
- **Trigger.dev note**: for BYOK to work inside generation, `ENCRYPTION_SECRET` must be set in the Trigger.dev env (dev: in `.env`; prod: synced). Only needed once an owner has BYOK keys — fallback path never decrypts.
- tsc + `next build` exit 0.

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

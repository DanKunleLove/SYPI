# SYPI Giant Product Plan

## North Star

SYPI should become the system-design operating room for software teams and AI
coding agents: a place where a vague product idea becomes requirements,
tradeoffs, risks, architecture, tasks, implementation guidance, and an
agent-ready handoff.

The wedge:

> Describe your app. Get a build-ready system spec and AI-agent handoff in 10
> minutes.

Do not lead with "AI diagram maker." Lead with clarity, confidence, and a better
build plan.

## Product Pillars

### 1. Founder-to-Build Handoff

Turn a plain-language idea into a bundle a person or coding agent can use.

Deliverables:
- `SPEC.md`
- `ARCHITECTURE.md`
- `TASKS.md`
- `API.md`
- `DATA_MODEL.md`
- `AGENT_INSTRUCTIONS.md`
- acceptance tests
- risk register

Success criteria:
- A solo founder can describe an app and leave with a credible first build plan.
- The handoff explains what to build first, what not to build yet, and how to verify it.

### 2. AI Coding Agent Control Center

Make SYPI the planning and control layer before Cursor, Codex, Claude Code, or
other coding agents start implementation.

Deliverables:
- target-specific agent bundle exports
- scoped implementation phases
- repo bootstrap instructions
- "do not implement yet" guardrails
- verification checklist per phase
- MCP-backed project context access

Success criteria:
- A user can export a bundle, give it to a coding agent, and get less drift than
  from a normal prompt.

### 3. Architecture Review Product

Support "review my idea/spec/repo summary" as a first-class mode, not only
generation.

Deliverables:
- review intake mode
- senior-engineer findings grouped by reliability, security, data, product,
  operations, and cost
- concrete failure scenarios
- fixes ranked by severity and effort
- before-build review report

Success criteria:
- A user can paste an existing architecture and discover material missing pieces
  before building.

### 4. Decision Memory

Every important choice should explain why it exists.

Deliverables:
- decision log
- rejected alternatives
- revisit triggers
- assumption register
- "what changed since last version" view

Success criteria:
- Teams return to SYPI because it remembers reasoning better than chats or docs.

### 5. Living Architecture

The canvas, USS, markdown, tasks, and handoff should stay connected.

Deliverables:
- stale-section detection
- impact analysis when a requirement changes
- spec health score
- open questions panel
- role-specific views

Success criteria:
- Changing a requirement tells users which architecture, tasks, and risks need
  attention.

## UI, Frontend, and UX Upgrade Plan

### First-Run Experience

Goal: make the first 5 minutes feel magical and useful.

Build:
- one focused intake screen inside the workspace
- examples by use case: SaaS, marketplace, AI app, internal tool, video pipeline
- visible generation stages: understand, question, design, review, handoff
- output preview tabs: Canvas, Questions, Risks, Build Plan, Agent Bundle

Avoid:
- tutorial copy walls
- generic hero-style product explanations inside the app
- making users understand USS terminology before value appears

### Workspace IA

Goal: make the product feel like an operating room, not a drawing tool.

Primary navigation:
- Canvas
- Spec
- Questions
- Risks
- Decisions
- Tasks
- Handoff

Right panel:
- AI Twin chat
- selected-node inspector
- selected-finding inspector
- selected-decision resolver

Top health strip:
- completeness
- risk count
- open decisions
- build readiness
- last synced state

### Canvas UX

Goal: keep the canvas useful without making it the whole product.

Build:
- clearer node grouping by layer
- edge labels always visible at readable zoom levels
- highlight "why this exists" paths
- click component -> show requirement/capability trace
- viewer mode visual affordance
- empty state that starts the pipeline, not manual drawing

### Spec UX

Goal: make the USS understandable to non-architects.

Build:
- human-readable summary cards
- confidence/evidence badges
- "Known / inferred / assumption / unknown" filters
- one-click resolve for open decisions
- diff view between versions

### Handoff UX

Goal: make exports feel like the main product payoff.

Build:
- target selector: Human Team, Codex, Cursor, Claude Code, Generic MCP
- file checklist with generation state
- copy/download bundle
- "start with this phase" recommendation
- warnings for unresolved blocking decisions

## Implementation Sequence

### Phase 0: Safety and Trust

Fix before expanding product surface.

- Enforce owner/editor/viewer permissions across Liveblocks and mutation routes.
- Stop saving private canvas files at deterministic public Blob paths.
- Ensure public share routes actually work without auth.
- Make lint/build checks reliable by ignoring generated artifacts.
- Update stale context docs where they contradict code.

Verification:
- TypeScript passes.
- Public share page works signed out.
- Viewer can open a project but cannot save, run generation, resolve decisions,
  or write Liveblocks storage.

### Phase 1: Build-Ready Output

- Upgrade handoff targets around the standard deliverables.
- Add missing `DATA_MODEL.md`, `API.md`, and acceptance-test exports where absent.
- Add a single "Agent Bundle" card in the AI panel.
- Gate export with unresolved blocking decisions.

Verification:
- A generated project exports a complete zip/bundle.
- The bundle includes clear implementation phases and verification steps.

### Phase 2: Questions and Risk Radar

- Promote open decisions into a first-class workspace tab.
- Add risk radar from council findings, deterministic gaps, and scenarios.
- Add build-readiness score based on blocking unknowns, risks, and coverage.

Verification:
- Users can answer an open decision and see affected canvas/spec/task changes.
- Risk list is actionable and links back to affected entities.

### Phase 3: Task and Roadmap Generation

- Render USS tasks as an implementation roadmap.
- Add phase grouping: foundation, data/auth, core flows, AI/async, hardening.
- Add acceptance tests per phase.
- Add "export tasks" to Markdown and agent bundle.

Verification:
- A project has a coherent first-week build plan after generation.

### Phase 4: Review Mode

- Add "Review existing idea/spec" intake.
- Let users paste docs, repo summaries, or architecture notes.
- Generate findings, open questions, and a repair plan without forcing a new
  canvas.

Verification:
- Review mode produces useful findings without creating unnecessary components.

### Phase 5: UI Polish and Retention

- Redesign dashboard around recent projects, readiness, unresolved questions,
  and last activity.
- Add project activity timeline.
- Add decision log and version diff.
- Improve responsive layout for dashboard/spec/handoff surfaces.
- Keep canvas desktop-focused.

Verification:
- Returning users immediately see what needs attention and what changed.

## Stickiness Loops

- Decision memory: users return to see why choices were made.
- Agent bundle: users return before each coding session.
- Risk radar: users return before committing to build.
- Living spec: users return when requirements change.
- Shared review links: teams invite collaborators to resolve decisions.

## Positioning

Short:

> SYPI turns rough software ideas into build-ready system plans for humans and AI
> coding agents.

Product promise:

> Less drift. Fewer missed requirements. Better prompts for the agents that build.


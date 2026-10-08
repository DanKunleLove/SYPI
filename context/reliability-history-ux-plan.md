# Reliable Audits, Project Memory and Workspace UX

Prepared: 2026-10-08. Status: proposed; no application changes in this unit.
This plan takes priority over further MCP expansion where both depend on the
same run lifecycle, history and evidence services.

## Outcome

A user can audit a website, receive a useful evidence-backed report, leave the
project, return to the conversation and results, retry an interrupted stage,
and revise or restore a saved design without losing work. The interface reads
clearly to a founder while preserving engineering detail for a developer.

## Findings From Code and Screenshot

These are source-level findings, not a confirmed diagnosis of the specific
production incident. Reproduce that incident with its project and URL first.

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Saved chat is not restored into the visible transcript | `hooks/use-ai-chat.ts:26` reads feed messages; `chat-tab.tsx:102` uses only SDK messages | Returning users can see an empty chat beside a saved spec |
| Tool results are discarded during persistence | `hooks/use-ai-chat.ts:48` flattens assistant output to text | Run cards, tool outcomes and their context cannot be reconstructed faithfully |
| Persistence failures are silent | `hooks/use-ai-chat.ts:58` and `:70` swallow feed write errors | A visible conversation is not proof that it was saved |
| Resume discovery is disconnected from the UI | `hooks/use-generation.ts:394`; search found no component caller | An abandoned run is not offered when returning |
| Chat owns the pipeline hook | `chat-tab.tsx:115`; `ai-panel.tsx:176` conditionally mounts ChatTab | Tab/panel lifecycle can lose visible run state; audit whether requests continue after unmount |
| Generation does not fully lock the composer | `chat-tab.tsx:151` includes chat loading/placing, not pipeline generating | Users can start overlapping work while a design run is active |
| Research provider differs from selected generation provider | `lib/ai/url-research.ts` constructs Google with the platform key | Adding Gemini BYOK does not replace every stage; provider choice can be misleading |
| One conversational URL turn can do repeated research | `app/api/ai/chat/route.ts` prefetches live evidence; prompt requires `researchUrl`, which fetches again | Fetch, research and final response share a bounded request budget |
| URL research has no explicit model deadline | `researchSite` calls `generateText`; initial run also researches before returning its ID | A timeout can leave a server-side run the browser never received |
| Run resumability expires after 15 minutes | `lib/ai/run.ts:28` and `:240` | Yesterday's unfinished work is not discoverable as resumable; old records can still say running |
| Hidden backend is filled with a plausible choice | `lib/ai/prompts.ts:47` asks for an industry-standard option where evidence is silent | A suggested architecture can be confused with detected implementation |
| Plain text renderer and crowded health summary | `chat-tab.tsx:295`; `spec-health-bar.tsx:49` and `:113` | Markdown is unreadable, warning is truncated and technical labels dominate |

Do not conclude that tokens caused the failed audits without provider/run logs.
Possible causes include latency, HTTP timeout, provider limits, tool chaining,
schema failures, tab lifecycle, credential selection and stale run status.

## Product Modes and Truth Rules

Expose a compact mode selector: Chat, Audit Website, Plan a System. Keep review
and refinement as actions on the selected project or result.

Audit Website examines an existing implementation. Plan a System designs a
possible implementation. An audit must not silently become a generation task
or add components merely to satisfy a generic architecture checklist.

Every audit claim carries a source, observation time and one of these labels:

- Observed: a specific artifact or runtime observation supports the claim.
- Owner-confirmed: the user supplied it; show that provenance separately.
- Reported: a cited external source says it; do not upgrade it to live evidence.
- Inferred: plausible explanation, clearly qualified with supporting signals.
- Unknown: insufficient visibility; identify what would establish it.
- Recommended: a proposed change or recreation choice, outside the diagnosis.

Examples: a `cf-ray` header supports a Cloudflare edge claim, not a Firebase or
Cloudflare database claim. A Supabase endpoint indicates a visible integration,
not proof that every backend operation runs there. No Supabase marker in HTML
does not establish that Supabase is absent. Bundled SDKs may be unused.

Treat contradictory signals explicitly. Preserve the user's "I think Supabase"
as tentative owner input until clarified. Do not force uncertainty into a
percentage that looks like accuracy. Coverage is not correctness.

## Audit Workflow and Report

1. Save the user's request and create a run before expensive work.
2. Fetch the public page within explicit time/byte/redirect limits. Record final
   URL, status, source and failures. A blocked page is an incomplete inspection,
   not evidence about the requested site's stack.
3. Parse observable framework, hosting/edge, scripts, visible functions and links
   into structured evidence. Use a maintained HTML parser, not new regex parsing.
4. Inspect a bounded set of linked public assets/pages where useful. Optionally
   add isolated browser rendering/network observations in a later worker unit;
   do not execute arbitrary site code inside the app server process.
5. Add optional search evidence as a separately bounded stage, with its actual
   provider identified. Cache/reuse evidence within the same run.
6. Produce the audit: observations, functional flows, architecture visibility,
   uncertainties, and prioritized issues. Save a partial result at each stage.
7. Offer optional recreate/design and cost-estimate actions from the report.

Keep SSRF protections at every hop, including asset requests; audit DNS rebinding,
IPv6/mapped-IP handling, response streaming limits and private network access.
Site text is untrusted input, never instructions to the agent or tool runner.
Do not probe private endpoints, extract secrets or bypass site authentication.

Report structure:
- Summary: what the site does and the most useful findings in plain language.
- Stack: frontend, hosting/CDN, backend/API, database/storage, third-party tools;
  each row has evidence and uncertainty, with unknown sections kept explicit.
- Architecture: observed paths and qualified hypotheses visually distinguished.
- Issues: impact, evidence, priority and next action; avoid generic accusations.
- What remains unknown: concrete owner questions or repo artifacts needed.
- Optional recreation plan: clearly labeled design recommendations.
- Optional cost scenarios: traffic, storage, bandwidth, region and feature
  assumptions; current sourced pricing with date and ranges, never claimed
  actual spend. Separate hosting costs from SYPI's audit model usage.

An owner-provided repository or dependency manifest can improve visibility in
a later unit, with scoped authorization. A public URL alone cannot reveal every
private service, schema, business rule or infrastructure bill.

## Run Reliability and Provider Transparency

Reuse the newer shared pipeline services and atomic claim work already present
in `pipeline-run.ts` and `run.ts`; preserve the concurrent MCP implementation.

- Persist intent (audit/design/review), initiator, resolved provider/model per
  stage, credential source (BYOK/platform), timestamps and source version.
  Store references and identifiers, never raw keys.
- Return a run ID promptly; separate research from start and conversational
  replies. Show progress immediately and save stage outcomes independently.
- Resolve and pin model policy at run creation; an admin model change must not
  unexpectedly alter half a run. Explicit provider switching creates a recorded
  new attempt. No silent paid fallback to a different key or provider.
- Add deadlines for fetch, model, parsing and overall step work; propagate
  cancellation. Check the deployed runtime's actual limits rather than relying
  on old comments. Do not raise a timeout and assume the platform honors it.
- Define queued/running/paused/completed/failed/cancelled/expired states with
  heartbeat and stage leases. Map them to existing fields or additive migrations
  deliberately; remove stale running status when a lease expires.
- A closed tab means paused for client-driven execution. If background completion
  is required, deploy and test a durable worker as a separate architecture unit.
- Keep the project run controller above changing tab/panel components; reconnect
  from durable run state. Expose Stop, Resume and Retry Failed Stage.
- Handle retry ownership, stale leases, duplicate starts and quota reservations
  atomically. Replay saved outcomes rather than spending another model call.
- Preserve partial work on every failure. Classify timeout, authentication,
  quota, network and validation errors; explain what finished and the next action.
- Generate a saved completion or interruption message from persisted outcomes.
  No run may disappear merely because the conversational final reply failed.

## Durable Project History and Restore

Make project history server-authoritative; browser local state is a view of it.
Use Liveblocks for presence and live notifications, not unverified canonical AI
results. Decide storage/schema in a focused unit before implementing migration.

Entities to design: project conversation, typed message parts, run attempts,
artifacts and project checkpoints. Reuse `AIGeneration` and `SystemSpecVersion`
where they fit; add data only for contracts they cannot represent safely.

- Save the user message before dispatch; retain streamed/partial assistant text,
  tool cards, errors, run IDs, timestamps and author attribution.
- Persist tool action receipts server-side. Loading history never executes a
  historical tool call again, even after refresh, branching or reconnect.
- Deduplicate by stable message/tool/run IDs. Paginate long conversations and
  define ordering under concurrent collaborators. Show loading and save errors.
- History is shared within the project according to role; drafts are per user.
  Server checks protect all reads/writes; a viewer's allowed chat cannot become
  permission to edit architecture or fabricate assistant outcomes.
- Preserve existing feed transcripts through a migration/legacy-read strategy.
  Label incomplete legacy tool history; do not manufacture missing results.
- History drawer lists conversations and runs: task name, mode, time, state and
  outcome. Selecting an entry opens its transcript and versioned result.
- Saved versions list checkpoints, actor, summary and affected artifacts.
  Distinguish Retry (run), Edit/Resend (new attempt), Branch (new conversation),
  Undo (local canvas) and Restore Version (saved project state).
- A restore previews differences, requires owner/editor access, records a new
  revision and leaves the history intact. Check expected version and concurrent
  Liveblocks edits; USS, canvas layout and dependent artifacts need a coordinated
  restore contract. Start with a spec-version browser before full canvas restore.
- Mark derived tasks/handoffs stale when their source version changes.

## Workspace Design

The screenshot's main problems are density, weak hierarchy, tiny type, technical
labels and absent continuity. Address these with a usable workspace, not decor.

Layout:
- Header: project title, save state, run state, History and panel expand/close.
- Primary views: Chat, Report/Spec, Handoff. Secondary sections live in a single
  organized menu or output view rather than another permanent crowded tab row.
- Chat panel: adjustable 420-560px on desktop, with persisted width and an expand
  view; preserve a useful canvas minimum. Small screens use a full-width view.
- Compact status: "Audit paused - 3 stages saved" or "2 questions need answers".
  Move coverage, scenario details and tier into an expandable Details area.
- Composer stays reachable with explicit mode, selected model and stop/send
  controls. The transcript is the scroll region; avoid stacked scrollbars.
- Dashboard: recent projects, latest task/outcome and a clear Resume action.
- Admin: actual model per attempt, stage, elapsed time, heartbeat and actionable
  failure category; separate historical running records from active workers.

Text and interaction:
- Render assistant Markdown with a maintained renderer and safe links; no raw
  HTML. Support headings, lists, tables, code/copy and readable streaming states.
- Use 14-15px body text, 1.5-1.65 line height, normal letter spacing and 12-13px
  metadata; reserve monospace for code. Avoid tables squeezed into a narrow panel.
- Plain-language summaries first; collapsible Technical Details retain exact
  terms. Translate `API_GATEWAY` into "API gateway" and explain relevance.
- Warnings wrap or open full details; never truncate the only explanation of a
  blocker. Distinguish an unknown mechanism from a demonstrated design flaw.
- Short paragraphs, specific findings and one clear next action per result.
  An audit should say "I couldn't verify the database from the public page"
  rather than inventing an implementation or dumping uppercase categories.
- Scroll only when near the bottom; show Jump to Latest while the user reads.
- Label composer and mode controls; visible keyboard focus, accessible tabs,
  status announcements, sufficient contrast, touch targets and IME-safe Enter.
- Use existing light/dark tokens with clearer neutral surfaces and restrained
  semantic accents. Validate contrast in both themes before changing palette.
- Use Lucide icons and consistent button hierarchy. Motion communicates saved
  progress or state changes and respects reduced motion.
- Use actual site thumbnails for audit/project items, with stable dimensions,
  alt text and privacy-aware capture. No stock imagery in operational panels.
  Diagrams carry architecture; decorative animations must not compete with text.

## Implementation Sequence

| Unit | Scope and main files | Acceptance gate |
| --- | --- | --- |
| 0. Reproduce and measure | Named project/URL, provider resolution, run traces, runtime configuration | Explain the exact failed stage without guessing; record known stack as a separate test oracle |
| 1. Persistent run recovery | `use-generation`, project controller, pipeline services, run status/admin | Refresh/tab switch returns saved progress; stale runs stop claiming active; retries don't duplicate calls or charges |
| 2. Conversation persistence | `use-ai-chat`, chat route, history service/schema and drawer | Reopen shows user/assistant/tool/error history; restored tool calls never replay; persistence failures visible |
| 3. Truthful website audit | URL evidence, prompts, explicit mode and report service | Observed versus suggested stack separated; hidden backend remains unknown; partial report survives fetch/model failure |
| 4. Chat and panel redesign | Chat renderer/composer, AI panel, health bar, result layouts | Readable light/dark desktop/mobile states; no clipped warnings, inaccessible controls or scrolling jumps |
| 5. Version browsing and restore | Existing USS versions, checkpoints, canvas reconciliation | Version preview works first; full restore preserves history and rejects concurrent state conflicts |
| 6. Dashboard/admin and costs | Resume/outcome surfaces, model usage telemetry, optional cost scenarios | Users find prior work quickly; admin can explain provider failures; estimates show dated sources and assumptions |
| 7. MCP reuse | Shared audit/history/run/result services, existing MCP tool contracts | External and browser clients see the same versions, report truth labels and interrupted run state |

Ship each unit separately. Update architecture/UI context when its decisions
become implemented, not while they are merely proposals. Read installed Next.js
guides and relevant Liveblocks/Prisma skills before changing those boundaries.

## Verification

- Test timeout before start response, provider 401/429, malformed outputs,
  oversized page, unreachable URL, denied page, refresh, tab switch, revoke,
  interrupted stream, duplicate retry and simultaneous collaborators.
- Detection fixtures: observable Supabase, hidden Supabase, Cloudflare edge with
  another backend, stale Firebase script, SPA shell, redirects and error pages.
  Prefer precision and honest unknowns over an impressive component count.
- Compare Gemini and NVIDIA using the same captured evidence before comparing
  live runs. Record model, latency and failure stage; account for varying pages.
- Use the owner's known portfolio stack as a withheld oracle so detection is
  not simply repeating the supplied answer. Separately test owner-confirmed mode.
- Check Playwright screenshots/interactions at narrow panel, expanded desktop,
  tablet/mobile, both themes, reduced motion and keyboard-only navigation.
- Run relevant contract/concurrency tests, TypeScript, USS/MCP tests as affected,
  lint for touched modules and production build. Real provider checks use an
  explicitly configured test credential; never reuse a key pasted into chat.
- Measure completed/partial audits, restored-history success, recovery rate,
  unsupported technology claims and time to useful result. Establish numerical
  targets after a representative pilot instead of inventing a baseline.

## Inputs Still Needed for Incident Reproduction

- Portfolio URL and affected project ID/name; exact prompt and approximate time.
- Selected model and key source on each attempt; inspect securely, not raw keys.
- Confirmed frontend/backend/hosting stack as a separate comparison reference.

Planning and source audit are complete without these inputs. A claim that the
specific production failure has been fixed requires reproducing and verifying it.

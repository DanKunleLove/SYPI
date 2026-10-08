# SYPI From Any AI Conversation

Status: proposed implementation plan, 2026-10-08. Units 1–2 are implemented in
code and Unit 3 is partial; Units 4–6 are not started. See the 2026-10-08 entry
in `progress-tracker.md` for exactly what is verified and what is not — passing
server tests do not establish client compatibility.

## Product Promise

Connect SYPI once, then turn an idea into an engineering plan from the AI
conversation you already use. Keep requirements, decisions, risks and tasks
in one SYPI project across chats and coding agents.

Example: "Use SYPI to plan a Nigerian marketplace. Ask me what is missing,
review the architecture, then give Claude Code the first implementation phase."

The assistant hosts the conversation. SYPI stores the specification, runs its
reasoning and validation, and returns versioned results. A coding agent performs
implementation in its own environment. SYPI does not gain filesystem access or
deployment privileges merely because it is connected through MCP.

## Existing Foundation

- Remote stateless Streamable HTTP endpoint: `app/api/mcp/route.ts`.
- Personal SYPI bearer tokens: hashed at rest, revocable, membership checked
  per tool, suspended users rejected.
- Five tools in `lib/mcp/server.ts`: `list_projects`, `get_spec`,
  `list_open_decisions`, `answer_decision`, `get_tasks`.
- `get_spec` returns a summary, not the full engineering specification.
- Existing USS graph, version log, deterministic checks, task renderer,
  step-based AI pipeline and target-specific handoff generation.
- Existing settings token card; no OAuth connection flow or client setup wizard.

Missing: project creation, readable specification sections, pipeline execution,
review execution, controlled editing, handoff retrieval, scoped credentials,
connection diagnostics and client interoperability tests.

## User Journeys

1. Idea to plan: connect, create a project, submit a brief, run planning steps,
   answer material questions in chat, receive requirements, risks and tasks.
2. Change a plan: select an existing project, propose a requirement change,
   inspect affected decisions/components/tasks, approve and save a new version.
3. Review before building: supply a brief or architecture notes, run review,
   receive prioritized findings and concrete verification criteria.
4. Plan to implementation: fetch an approved version and first task phase,
   implement in the coding client, report evidence and unresolved deviations.
5. Continue elsewhere: start in a chat app, resume the same project in a coding
   client, and retain the same decisions and source version.

## Client Strategy

Compatibility is a property of the host application, not the model name. A
DeepSeek-powered agent can use SYPI if its host supports MCP or a tool adapter;
do not promise that the DeepSeek consumer chat app supports this integration.

| Client | Delivery approach | Release evidence |
| --- | --- | --- |
| Codex CLI / IDE | Remote HTTP + bearer token initially; OAuth later | Real authenticated tool round-trip |
| Claude Code | Remote HTTP setup with supported credential configuration | Real authenticated tool round-trip |
| Claude chat | Remote custom connector; OAuth preferred, headers where supported | Verify account-specific setup and writes |
| ChatGPT | Remote custom app/plugin with OAuth and current client requirements | Verify target account eligibility and tool approval behavior |
| Cursor / other MCP hosts | Verified HTTP configuration per client | Mark supported only after testing |
| DeepSeek-based custom agents | MCP-capable host, otherwise a later REST/function adapter | Test the actual host, not just the model API |

Keep PAT access for developers while adding OAuth for consumer connection UX.
Use a stable HTTPS endpoint reachable by client cloud servers. Audit Deployment
Protection and Clerk proxy behavior: MCP requests must reach MCP authentication,
not a Vercel login or HTML rewrite. Do not disable protection for the whole app
as an incidental setup change; choose a deliberate endpoint exposure strategy.

## Proposed Tool Contract

Preserve the five existing tools. Add tools incrementally:

| Tool | Purpose | Permission |
| --- | --- | --- |
| `create_project` | Create from name and brief; return project link | Project creation scope |
| `get_spec_section` | Fetch selected requirements, architecture, decisions or risks | Read + project membership |
| `start_plan` | Start a quota-accounted planning run | Run + owner/editor |
| `continue_plan` | Execute the next permitted bounded step | Run + owner/editor |
| `get_run` | Read progress, failures, questions and next action | Read + project membership |
| `start_review` | Review the current spec through shared review services | Run + owner/editor |
| `propose_change` | Persist a version-bound change proposal and impact preview | Edit + owner/editor |
| `apply_change` | Apply an approved proposal if its base version still matches | Edit + owner/editor |
| `get_handoff` | Fetch deterministic target files from a pinned spec version | Read + project membership |
| `report_progress` | Record agent-reported implementation evidence | Report + owner/editor |

AI-generated handoff files must use the existing quota-accounted, per-file run
pattern; do not hide multiple model calls inside a read tool. Reserve proposal
and progress tools for later phases rather than shipping empty placeholders.

Every response identifies its project and source version. Use structured MCP
results plus concise text. Paginate projects and large spec sections; do not
dump the complete USS into every conversation. Include artifact paths/links,
blocking questions, findings and a next action where relevant.

Use stable error codes: `UNAUTHORIZED`, `FORBIDDEN`, `VERSION_CONFLICT`,
`QUOTA_EXCEEDED`, `RUN_EXPIRED`, `STEP_IN_PROGRESS`, `MODEL_UNAVAILABLE`.
Return retry guidance without exposing database or provider credentials.

Annotate tools accurately for read-only, destructive and idempotent behavior.
Annotations guide clients; server-side permission checks still enforce access.
Optional MCP resources/prompts can improve discovery after the tool flow works;
the core journey must not depend on a host supporting those features.

## Execution and Storage

- Extract orchestration from Clerk-bound HTTP handlers into shared services
  accepting an authenticated actor. Browser routes and MCP call these services;
  MCP must not impersonate a Clerk browser session or call routes over HTTP.
- Reuse `lib/ai/pipeline.ts`, `pipeline-steps.ts`, `run.ts`, USS commits and
  quota checks. Charge once per logical run, including replay/retry behavior.
- Initial execution is client-driven: `start_plan` returns a run identifier;
  `continue_plan` performs one step and returns the next action. `get_run` only
  observes progress. Closing the chat pauses work; polling does not run it.
- Do not promise autonomous background completion without a durable worker.
  If client-driven continuation proves unreliable in chat hosts, separately
  implement durable execution and prove worker deployment before launch there.
- Claim steps atomically with an expiring lease; replay a completed step's
  result. Enforce ordering, actor access, run lifetime and cancellation state.
  Existing run bookkeeping needs a concurrency/replay audit before reuse.
- Bind runs and proposals to the initiating grant and user, with explicit
  project permissions. Revocation blocks new steps. Completed results remain
  readable to authorized project members, independent of the original client.
- Browser presence must not be necessary for generating or saving a plan.
  USS commits remain authoritative. Audit the current client-side canvas write
  path, then add versioned projection/synchronization that preserves layout
  and manual edits when a project is opened or already has active collaborators.
- A proposed edit records base version, patch, affected entities and author.
  Applying a stale proposal returns a conflict; it cannot overwrite newer work.
- Agent completion reports remain claims with evidence links. SYPI must not
  mark acceptance criteria verified without suitable evidence or validation.

## Authentication and Permissions

- Separate SYPI access credentials from OpenAI/Anthropic/provider API keys.
  A ChatGPT or Claude subscription does not pay for SYPI's own model calls.
- Add PAT expiration, explicit scopes and optional project restrictions.
  Existing tokens retain their current behavior during a documented transition;
  newly issued credentials default to the minimum requested permissions.
- OAuth: use a maintained authorization-server solution that integrates with
  Clerk identity. Select it after a compatibility spike; avoid custom OAuth
  cryptography or assuming Clerk browser login alone supplies MCP OAuth.
- Support authorization code + PKCE S256, discovery metadata, supported client
  registration, exact redirect validation, audience/resource binding,
  short-lived access tokens, refresh rotation and revocation.
- Proposed scopes: `projects:read`, `projects:create`, `spec:write`,
  `plans:run`, `progress:write`. Project roles always narrow a grant.
- Consent shows client identity, project selection and requested permissions.
  Require explicit user authorization for applying material plan changes;
  bind approvals to persisted proposals, not an agent-supplied boolean alone.
- Record grant/user, tool, project, time, version, outcome and run/proposal ID.
  Do not log secrets or whole private briefs by default. Treat supplied docs,
  links and tool outputs as untrusted content, never tool authorization.

## UI and UX

Replace the isolated token card with Settings > Connected agents:

- Client selector with verified support status and client-specific setup.
- Endpoint copy control, OAuth connect flow or token configuration as appropriate.
- Named connections with project access, scopes, last successful use and revoke.
- Connection test distinguishes endpoint reachability, authentication, tool
  discovery and first successful call. No green connected state on URL copy.
- Accessible labels, keyboard navigation, loading/retry states, mobile layout,
  masked secrets and one-time reveal/copy. Use existing tokens and components.
- Workspace activity shows "Updated through Claude" or another verified client
  identity where available; do not trust a client-supplied label as proof.
- Review proposals show before/after, impacted tasks and approval state.
- Handoff includes the source version so the receiving agent can detect drift.
- In chat, return a compact outcome, open questions and project link. Optional
  embedded ChatGPT UI is a later enhancement; tools must work without it.

## Delivery Units and Acceptance Gates

1. Connectivity foundation: SDK-level integration tests for initialization,
   discovery, auth failure, revocation, viewers and cross-project isolation;
   real Codex and Claude Code smoke tests; audit production endpoint exposure.
   Done when both clients read a project and record an authorized answer.
2. Planning from chat: shared actor-based services, section reads, project
   creation and bounded run tools. Add atomic step claims and idempotency.
   Done when an empty account creates a complete persisted plan without opening
   SYPI; interrupted/retried calls do not duplicate projects, charges or steps.
3. Browser consistency and handoff: reconcile MCP-generated semantics with the
   canvas; fetch version-pinned tasks and target files. Done when a browser
   opened later and an already-open collaborator see consistent saved results.
4. Consumer connections: OAuth provider spike, additive grant/token migrations,
   consent, refresh/revocation and Connected agents UI. Test ChatGPT and Claude
   accounts. Done when connection, expiry recovery, scope denial and revocation
   work end to end. If chat clients cannot reliably continue steps, add durable
   execution as its own unit before declaring the full planning journey supported.
5. Revision and review: proposals, impact previews, approved commits and shared
   review execution. Done when stale proposals fail safely, decisions retain
   provenance, and applied changes update relevant outputs.
6. Implementation feedback and distribution: evidence reports, version drift,
   client setup docs and optional directories/marketplace submissions. Done when
   a project moves between chat and coding clients with no manual context copy.

Each unit gets focused contract/access/concurrency tests, TypeScript, USS tests
and build checks. Read the installed Next.js guides before route changes.
Use synthetic fixtures for automated tests, then named real-client checks;
passing server tests alone does not establish client compatibility.

## Value and Measurement

Priority use cases: founder idea planning, engineer architecture review, scoped
feature changes, team decision collection, and coding-agent task preparation.
Later: implementation drift checks and repo-evidence intake. Generic business
automation is outside this release's software-engineering scope.

Track connection-to-first-tool success, first complete MCP plan, continuation
failure rate, duplicate-charge rate, weekly connected-project reuse, handoff use
and cross-client continuation. Log these as events with deduplicated run IDs.
Set numerical product targets after a small pilot establishes a baseline.

The retention mechanism is useful accumulated state: a user's preferred AI can
return to the same requirements, decisions and tasks before each coding session.
Validate with five pilot users across chat and coding clients before broad claims.

## Verified References

Client capabilities can change; recheck these at each client release gate.

- Codex MCP: https://learn.chatgpt.com/docs/extend/mcp?surface=cli
  (remote HTTP, bearer tokens and OAuth).
- ChatGPT authentication: https://developers.openai.com/plugins/build/auth
  (protected-resource discovery and authorization code + PKCE).
- Claude connectors:
  https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
  (remote connectors, OAuth and request-header configuration where available).
- MCP authorization:
  https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
  (discovery, scopes and resource-bound access tokens).

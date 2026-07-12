/**
 * System Kit — SYPI's thesis feature.
 *
 * The gap between seniors and vibe coders is the proper system: documented
 * context, standards, workflow rules, a progress tracker, and a setup template.
 * The kit generates that system from the user's actual canvas — for software
 * AND non-code domains (video, image, music, writing, marketing, business,
 * automation) — packaged per platform where tool-native files exist.
 */

export interface KitFileSpec {
  name: string;
  title: string;
  /** One line for the entry file's read-order list. */
  summary: string;
  guidance: string;
}

// ─── Shared file specs ────────────────────────────────────────────────────────

function progressTrackerFile(nextUpHint: string): KitFileSpec {
  return {
    name: "progress-tracker.md",
    title: "Progress Tracker",
    summary: "current phase, completed work, open questions, next steps",
    guidance: `Write progress-tracker.md as the living status file for this project.
Include sections: Current Phase (set to "Foundation — system designed in SYPI, work not
started"); Current Goal; Completed (list "System designed" with today's component count);
In Progress (none yet); Next Up — a realistic ordered list of the first 5-8 work units
derived from the canvas (${nextUpHint}); Open Questions (infer 2-4 real unresolved
decisions from the design); Decisions Made (the key ones already visible in the canvas);
Session Notes.`,
  };
}

function toolSetupFile(what: string): KitFileSpec {
  return {
    name: "tool-setup.md",
    title: "Tool Setup",
    summary: "tools, accounts, and export settings — set up before starting",
    guidance: `Write tool-setup.md: everything that must be in place before work starts.
Derive from the actual components and configured tools in the canvas. For each tool/stage:
which tool, what plan/account is needed, ${what}. Include a final "Ready checklist" the
user ticks before starting. Never include real credentials — placeholders only.`,
  };
}

const AI_WORKFLOW_RULES_BASE = `Write ai-workflow-rules.md as DIRECT IMPERATIVE COMMANDS
to an AI (or a person driving AI tools) working on this project.`;

// ─── Software (the original kit) ──────────────────────────────────────────────

export const KIT_FILES: KitFileSpec[] = [
  {
    name: "project-overview.md",
    title: "Project Overview",
    summary: "product definition, goals, features, and scope",
    guidance: `Write project-overview.md: what this system does and why.
Include: a one-paragraph overview; numbered goals (measurable, not aspirational);
the step-by-step core user flow; features grouped by category; an explicit
IN SCOPE list; an explicit OUT OF SCOPE list (infer sensible exclusions);
success criteria that are verifiable ("a signed-in user can X"), not vague.`,
  },
  {
    name: "architecture.md",
    title: "Architecture",
    summary: "system structure, boundaries, storage model, and invariants",
    guidance: `Write architecture.md: the system's structure, derived strictly from the canvas.
Include: a stack table (layer | technology | role) using the ACTUAL technologies in the
component configs; system boundaries (which component owns which responsibility);
the storage model (what lives in each database/cache/storage component); the auth &
access model (from gateway/auth components, or state the gap); and an INVARIANTS
section with at least 4 rules this system must never violate (derived from the design,
e.g. "clients never talk to the database directly").`,
  },
  {
    name: "code-standards.md",
    title: "Code Standards",
    summary: "implementation rules and conventions",
    guidance: `Write code-standards.md for the stack visible in the canvas configs
(languages, frameworks, protocols). Include: language conventions; framework patterns;
API design rules matching the protocols in use (REST/gRPC/GraphQL as configured);
file/folder organization; naming conventions; error-handling rules; testing expectations.
Be opinionated and specific to THIS stack — no generic advice.`,
  },
  {
    name: "ai-workflow-rules.md",
    title: "AI Workflow Rules",
    summary: "development workflow, scoping rules, and delivery approach",
    guidance: `${AI_WORKFLOW_RULES_BASE}
Include: the overall approach (spec-driven, one unit at a time);
scoping rules (no speculative changes, stay within one system boundary per unit);
what to do when requirements are missing (ask, never guess); which things must not be
modified without instruction; how to keep these context files in sync; and a
verification checklist before any unit is marked done (build passes, no type errors,
behavior verified).`,
  },
  {
    name: "ui-context.md",
    title: "UI / Experience Context",
    summary: "theme, interface conventions, and experience patterns",
    guidance: `Write ui-context.md. If the canvas has client/frontend components: define the
visual language for them — semantic color-token table (name + hex), typography roles,
spacing/radius scale, component-library conventions, and layout patterns for the app's
actual surfaces. If there is NO client tier, write it as experience-context.md content
instead: the operational interfaces (CLIs, dashboards, alerts, reports) and the
conventions for each. Every visual/interface decision an agent could face should be
answerable from this file.`,
  },
  progressTrackerFile(
    "dependencies first: auth before features, backend before frontend wiring"
  ),
  {
    name: "env.example",
    title: "Environment Template",
    summary: "every variable the system needs, documented",
    guidance: `Write .env.example for this system in RAW dotenv format — NOT Markdown: no code
fences, no headings, no prose outside # comments. Derive every variable from the actual
components and their configured technologies (database connection strings, cache endpoints,
auth secrets, third-party API keys, queue URLs, service ports, the public app URL). For each
variable: a # comment stating what it's for, where to obtain it, and the expected format,
then the VAR_NAME= line with an obvious placeholder (never a realistic-looking secret).
Group variables per component with # ── section header comments.`,
  },
];

// ─── Automation (n8n / agents / workflows) ────────────────────────────────────

const AUTOMATION_FILES: KitFileSpec[] = [
  {
    name: "project-overview.md",
    title: "Project Overview",
    summary: "what the automation does, triggers, outcomes, and scope",
    guidance: `Write project-overview.md for this automation system.
Include: a one-paragraph overview of what it automates and for whom; the trigger events
that start each workflow; the concrete outcomes (what exists/happens after a successful
run); an IN SCOPE and OUT OF SCOPE list; success criteria that are verifiable
("a new form submission creates a CRM contact within 1 minute").`,
  },
  {
    name: "workflow-architecture.md",
    title: "Workflow Architecture",
    summary: "triggers, steps, branches, data flow, and error paths",
    guidance: `Write workflow-architecture.md derived strictly from the canvas.
Include: a table of workflows (trigger | steps | systems touched | output); the data
flow between systems using the ACTUAL components and edge labels; branch/condition logic;
error paths (what happens on failure at each step — retry, dead-letter, alert a human);
human-approval gates; and an INVARIANTS section with at least 4 rules (e.g. "no workflow
writes to the CRM without an idempotency key").`,
  },
  {
    name: "integration-standards.md",
    title: "Integration Standards",
    summary: "auth, retries, idempotency, naming, and logging rules",
    guidance: `Write integration-standards.md for the systems visible in the canvas.
Include: credential/auth handling per integration (env vars or the platform's credential
store — never inline); retry and idempotency rules; rate-limit handling per external API;
payload/field naming conventions; workflow and node naming conventions; logging and
run-history expectations; how to version and test workflows before activating.`,
  },
  {
    name: "ai-workflow-rules.md",
    title: "AI Workflow Rules",
    summary: "build workflow, scoping rules, and verification checklist",
    guidance: `${AI_WORKFLOW_RULES_BASE}
Include: build one workflow at a time, activate only after a test run with sample data;
scoping rules (never modify a working workflow while building another); what to do when
an API or field is undocumented (inspect a real payload, never guess field names);
credentials only via env/credential store; keep these context files in sync; and a
verification checklist before a workflow is marked done (test execution passed, error
path tested, idempotency verified).`,
  },
  progressTrackerFile(
    "dependencies first: credentials and triggers before actions, core path before branches"
  ),
  {
    name: "env.example",
    title: "Environment Template",
    summary: "every credential and endpoint the automations need, documented",
    guidance: `Write .env.example for this automation system in RAW dotenv format — NOT
Markdown: no code fences, no headings, no prose outside # comments. Derive every variable
from the actual integrations in the canvas (API keys, webhook URLs, OAuth client IDs,
base URLs, notification channels). For each variable: a # comment stating what it's for,
where to obtain it, and the expected format, then the VAR_NAME= line with an obvious
placeholder. Group per integration with # ── section header comments.`,
  },
];

// ─── Video (AI video generation / production) ─────────────────────────────────

const VIDEO_FILES: KitFileSpec[] = [
  {
    name: "project-overview.md",
    title: "Project Overview",
    summary: "what the video is, audience, platform, format, and scope",
    guidance: `Write project-overview.md for this video production.
Include: what the video/series is and the story it tells; target audience; platform and
format (duration, aspect ratio, with/without dialogue); the deliverables (e.g. 1 hero video
+ 3 cutdowns); IN SCOPE / OUT OF SCOPE; success criteria that are verifiable
("a viewer understands X within the first 10 seconds").`,
  },
  {
    name: "production-pipeline.md",
    title: "Production Pipeline",
    summary: "stages, tool per stage, and handoff formats",
    guidance: `Write production-pipeline.md derived strictly from the canvas.
Map the components into ordered production stages (e.g. script → voiceover → reference
images → shot generation → edit/assembly → sound → grade → publish), naming the ACTUAL
tool configured for each stage. For every stage: input it receives, output it produces,
and the handoff format (file type, resolution, naming). State where a human reviews
before the next stage. Include an INVARIANTS section (e.g. "no shot is generated before
its reference frame is approved").`,
  },
  {
    name: "creative-direction.md",
    title: "Creative Direction",
    summary: "visual style, consistency system, tone, and audio identity",
    guidance: `Write creative-direction.md — the consistency system that stops the
production drifting. Include: the visual style in concrete terms (medium, palette,
lighting, camera language); the CHARACTER/SUBJECT CONSISTENCY SYSTEM — lock every
recurring character/subject with a neutral-lighting reference sheet BEFORE production,
and require image-to-video with those references (plus first/last frames for continuity
between clips) rather than text-only prompting; tone and pacing rules; the audio identity
(voice style, music mood, sound design); and typography/brand rules for any on-screen text.`,
  },
  {
    name: "ai-workflow-rules.md",
    title: "AI Workflow Rules",
    summary: "shot-based iteration, versioning, and rights discipline",
    guidance: `${AI_WORKFLOW_RULES_BASE}
Include: think in SHOTS, not scenes — one frame, one motion idea, one short clip per
generation; always anchor generations with the approved references from
creative-direction.md; change ONE variable per regeneration and log what changed;
naming/versioning for every take (shot ID + version, keep rejects until final cut);
maintain a prompt log (prompt + settings + seed/reference used → which take it produced);
rights and licensing checks for voices, likenesses, and music before publishing;
update these context files when the direction changes.`,
  },
  {
    name: "asset-library.md",
    title: "Asset Library",
    summary: "folder structure, naming, reference boards, and prompt log",
    guidance: `Write asset-library.md: how every file in this production is organized so any
tool or person can find it. Include: a concrete folder tree (references/, shots/ by shot ID,
audio/, exports/…); file-naming convention with examples; the reference board (where
character sheets and style refs live and how they're versioned); the prompt log format
(one line per generation: shot, prompt, tool, settings, result); and export specs per
deliverable (resolution, codec, aspect) based on the platform in the overview.`,
  },
  progressTrackerFile(
    "production order: script and references locked before any shot generation"
  ),
  toolSetupFile("export settings/resolutions per stage, and how stages connect"),
];

// ─── Image (AI image generation / design) ─────────────────────────────────────

const IMAGE_FILES: KitFileSpec[] = [
  {
    name: "project-overview.md",
    title: "Project Overview",
    summary: "what's being created, audience, deliverables, and scope",
    guidance: `Write project-overview.md for this image/visual project.
Include: what is being created and why; target audience and where the images will live;
the deliverables list (count, sizes, formats per use); IN SCOPE / OUT OF SCOPE;
success criteria that are verifiable ("all 12 images read as one campaign at thumbnail size").`,
  },
  {
    name: "generation-pipeline.md",
    title: "Generation Pipeline",
    summary: "concept → reference → generate → select → upscale → deliver",
    guidance: `Write generation-pipeline.md derived strictly from the canvas.
Map the components into ordered stages (e.g. concept/moodboard → reference lock →
generation → selection → upscale → retouch → export), naming the ACTUAL tool configured
for each. For each stage: input, output, handoff format, and where a human selects/approves.
Include an INVARIANTS section (e.g. "no batch generation before the style reference is locked").`,
  },
  {
    name: "style-guide.md",
    title: "Style Guide",
    summary: "style anchors, palette, composition, and per-deliverable specs",
    guidance: `Write style-guide.md — the consistency system. Include: the visual style in
concrete terms (medium, palette with hex values, lighting, composition rules); the STYLE
ANCHOR SYSTEM — lock style references/seeds (and for recurring characters, a
neutral-lighting character sheet with portrait-orientation reference) before any batch
work, and reuse the exact anchor phrasing across prompts, changing only the scene;
a structured prompt formula (subject + environment + lighting + camera/medium + parameters);
what must NEVER appear (off-brand elements); and output specs per deliverable.`,
  },
  {
    name: "ai-workflow-rules.md",
    title: "AI Workflow Rules",
    summary: "prompt library, one-variable iteration, and versioning",
    guidance: `${AI_WORKFLOW_RULES_BASE}
Include: anchor every generation with the locked style references from style-guide.md;
change ONE variable per iteration and log it; maintain a prompt library (winning prompts
with settings/seeds, organized by deliverable type); naming/versioning for generations and
selects (keep the selection trail); upscale/retouch only selected finals; licensing and
usage-rights checks for reference imagery; update these context files when the style evolves.`,
  },
  {
    name: "asset-library.md",
    title: "Asset Library",
    summary: "folders, naming, prompt library, and selects",
    guidance: `Write asset-library.md: how files are organized. Include: a concrete folder
tree (references/, generations/ by deliverable, selects/, finals/); file-naming convention
with examples; where the prompt library lives and its entry format (prompt, tool, settings,
seed, result rating); and export specs per deliverable from the overview.`,
  },
  progressTrackerFile("references and style lock before any batch generation"),
  toolSetupFile("model/version choices, and export settings per deliverable"),
];

// ─── Music (AI music generation / production) ─────────────────────────────────

const MUSIC_FILES: KitFileSpec[] = [
  {
    name: "project-overview.md",
    title: "Project Overview",
    summary: "the release, audience, references, and deliverables",
    guidance: `Write project-overview.md for this music project.
Include: what is being made (single/EP/score/sonic identity) and the feeling it should
create; target audience/use (streaming, sync, content background); 3-5 reference tracks
or artists that define the target; deliverables (track count, lengths, formats incl.
stems if needed); IN SCOPE / OUT OF SCOPE; verifiable success criteria.`,
  },
  {
    name: "production-pipeline.md",
    title: "Production Pipeline",
    summary: "write → generate → select → stems → mix/master → release",
    guidance: `Write production-pipeline.md derived strictly from the canvas.
Map components into ordered stages (e.g. writing/lyrics → AI generation → selection →
stem separation → DAW arrangement → mix/master → release), naming the ACTUAL tools
configured. For each stage: input, output, handoff format (e.g. stems as WAV per
instrument). State the principle: AI replaces the blank page, not the production process —
selection, arrangement, and final polish are human stages. Include an INVARIANTS section
(e.g. "nothing is released without a human mix pass").`,
  },
  {
    name: "sound-direction.md",
    title: "Sound Direction",
    summary: "genre descriptors, BPM/key, instrumentation, and vocal identity",
    guidance: `Write sound-direction.md — the consistency system for the project's sound.
Include: the genre/style described in ~10 FOCUSED descriptors where every descriptor earns
its place (genre, instrumentation, vocal identity, production texture, mood, tempo — no
synonym piles); BPM and key ranges; the instrumentation palette (what belongs, what never
appears); vocal identity (gender, energy, delivery style) if vocal; lyrical themes and
language rules; and how the tracks relate (shared motifs for an EP/score).`,
  },
  {
    name: "ai-workflow-rules.md",
    title: "AI Workflow Rules",
    summary: "prompting discipline, stems, versioning, and rights",
    guidance: `${AI_WORKFLOW_RULES_BASE}
Include: prompt with the locked descriptors from sound-direction.md, changing ONE element
per regeneration; generate in batches, select the best, then refine (extend/cover/remix)
rather than endlessly regenerating; the stem workflow (when to split, how stems are named
and stored, what gets replaced or re-played by a human in the DAW); versioning for takes
(track + version, keep the selection trail); RIGHTS DISCIPLINE — add human creative
elements (original lyrics, live instruments, arrangement decisions) and document the
creative process to strengthen ownership; check each platform's commercial terms before
release; keep these context files in sync.`,
  },
  progressTrackerFile("sound direction locked before batch generation; one track at a time"),
  toolSetupFile("plan tier needed for commercial use/stems, and export formats per stage"),
];

// ─── Writing (books, scripts, blogs, copy) ────────────────────────────────────

const WRITING_FILES: KitFileSpec[] = [
  {
    name: "project-overview.md",
    title: "Project Overview",
    summary: "what's being written, audience, promise, and scope",
    guidance: `Write project-overview.md for this writing project.
Include: what is being written (book/series/blog/script/copy) and its core promise to the
reader; target audience and where they'll read it; deliverables (word counts, chapter/post
counts, formats); IN SCOPE / OUT OF SCOPE; verifiable success criteria
("a reader can explain X after chapter 2").`,
  },
  {
    name: "content-architecture.md",
    title: "Content Architecture",
    summary: "structure, sections, arcs, and dependencies",
    guidance: `Write content-architecture.md derived strictly from the canvas.
Map the components into the work's structure (parts/chapters/sections/posts or acts/scenes),
with each unit's purpose, key points or beats, target length, and what it depends on
(what the reader must already know/feel). Show the through-line: how units build to the
promise in the overview. Include an INVARIANTS section (e.g. "no chapter introduces a
concept its predecessors haven't set up").`,
  },
  {
    name: "style-voice-guide.md",
    title: "Style & Voice Guide",
    summary: "voice, tone, rhythm, vocabulary, and formatting rules",
    guidance: `Write style-voice-guide.md — the consistency system for the prose.
Include: the voice described concretely (person, tense, sentence rhythm, paragraph length);
tone and register per context; vocabulary rules (words/phrases to use, words that never
appear); at least 3 DO/DON'T example pairs showing the voice; formatting conventions
(headings, lists, dialogue, citations); and any platform-specific rules.`,
  },
  {
    name: "content-bible.md",
    title: "Content Bible",
    summary: "continuity record — entities, facts, terminology, and claims",
    guidance: `Write content-bible.md — the persistent continuity record.
For fiction: characters (traits, arcs, relationships), settings, timeline, established
events. For nonfiction: key entities, definitions and terminology (one term per concept,
used consistently), core claims with their sources, and a fact log format (claim | source |
verified date). Seed it with everything already visible in the canvas. State the rule:
this file is updated after every writing session — it is what keeps book 3 consistent
with book 1.`,
  },
  {
    name: "ai-workflow-rules.md",
    title: "AI Workflow Rules",
    summary: "drafting discipline, fact-checking, and voice passes",
    guidance: `${AI_WORKFLOW_RULES_BASE}
Include: outline → draft ONE section at a time → revise (never generate the whole work in
one pass); every draft is anchored by content-architecture.md + style-voice-guide.md +
content-bible.md; FACT DISCIPLINE — verify every claim, date, quote, and citation; never
invent sources; flag anything unverifiable; a separate voice pass after content is right;
update content-bible.md after every session; versioning for drafts (unit + version);
plagiarism and originality checks before publishing.`,
  },
  progressTrackerFile("architecture and bible seeded before drafting; one unit at a time"),
];

// ─── Marketing (content & campaign systems) ───────────────────────────────────

const MARKETING_FILES: KitFileSpec[] = [
  {
    name: "project-overview.md",
    title: "Project Overview",
    summary: "offer, audience, channels, goals, and KPIs",
    guidance: `Write project-overview.md for this marketing system.
Include: the offer and its core value proposition; the ideal customer profile (who, where
they are, what they believe before buying); channels in play; numbered goals with KPIs
(measurable: "X qualified leads/month", not "more awareness"); IN SCOPE / OUT OF SCOPE;
verifiable success criteria.`,
  },
  {
    name: "campaign-architecture.md",
    title: "Campaign Architecture",
    summary: "funnel, channels, assets, and sequences",
    guidance: `Write campaign-architecture.md derived strictly from the canvas.
Map components into the funnel (awareness → consideration → conversion → retention):
which channel/asset serves each stage, how traffic flows between them (use the edge labels),
the sequences (email/retargeting) with triggers and timing, and what is measured at each
hand-off. Include an INVARIANTS section (e.g. "no paid traffic to a page without a
tracked conversion event").`,
  },
  {
    name: "brand-voice-guide.md",
    title: "Brand & Voice Guide",
    summary: "messaging pillars, tone, identity, and compliance rules",
    guidance: `Write brand-voice-guide.md — the consistency system for every asset.
Include: 3-5 messaging pillars (the things every piece reinforces); voice and tone rules
with at least 3 DO/DON'T example pairs; visual identity references (palette, typography,
imagery style) for any designed asset; claim rules — what may be promised, what requires
proof, what is never claimed (compliance); and per-channel adaptations (same voice,
different format).`,
  },
  {
    name: "ai-workflow-rules.md",
    title: "AI Workflow Rules",
    summary: "content generation rules, review gates, and measurement",
    guidance: `${AI_WORKFLOW_RULES_BASE}
Include: every asset is anchored by brand-voice-guide.md and serves one funnel stage from
campaign-architecture.md; generate variants (3-5 per asset), select against the pillars,
then refine ONE variable at a time; human review gates before anything publishes (claims,
compliance, brand fit); naming/versioning per asset and channel; measurement discipline —
every published asset has a tracked goal, results are logged to progress-tracker.md;
never fabricate statistics, testimonials, or social proof.`,
  },
  progressTrackerFile("foundations first: tracking and landing assets before traffic"),
  toolSetupFile("tracking/pixel setup, sending domains, and publishing access per channel"),
];

// ─── Business (structure & operations) ────────────────────────────────────────

const BUSINESS_FILES: KitFileSpec[] = [
  {
    name: "business-overview.md",
    title: "Business Overview",
    summary: "model, customers, offers, revenue streams, and goals",
    guidance: `Write business-overview.md for this business system.
Include: the business model in one paragraph (who pays, for what, why you); customer
segments; offers and revenue streams; numbered goals with measurable targets;
IN SCOPE / OUT OF SCOPE for this phase; verifiable success criteria.`,
  },
  {
    name: "operations-architecture.md",
    title: "Operations Architecture",
    summary: "functions, processes, hand-offs, and systems",
    guidance: `Write operations-architecture.md derived strictly from the canvas.
Map components into business functions (sales, delivery, support, finance, marketing…):
what each function owns, the processes that run through it, hand-offs between functions
(use the edge labels — what moves, in what format, triggered by what), and the systems/
tools that support each. Include an INVARIANTS section (e.g. "no client work starts
without a signed agreement and a paid invoice").`,
  },
  {
    name: "sops-and-standards.md",
    title: "SOPs & Standards",
    summary: "SOP format, decision rights, quality bars, and escalation",
    guidance: `Write sops-and-standards.md. Include: the standard SOP format every process
uses (trigger, steps, owner, output, quality check); the first 3-5 SOPs drafted from the
processes in operations-architecture.md; decision rights (what each role decides alone,
what needs approval); quality bars per deliverable; and escalation rules (what triggers
one and to whom).`,
  },
  {
    name: "ai-workflow-rules.md",
    title: "AI Workflow Rules",
    summary: "where AI acts, where humans approve, and data rules",
    guidance: `${AI_WORKFLOW_RULES_BASE}
Include: which work AI drafts vs. what humans must approve (anything customer-facing,
financial, or legal gets human sign-off); DATA DISCIPLINE — what data may be shared with
AI tools and what never leaves internal systems (client PII, credentials, financials);
documentation rules (every process change updates the SOP); one process improved at a
time, measured before the next; keep these context files in sync.`,
  },
  progressTrackerFile("revenue-critical processes first, then supporting functions"),
  toolSetupFile("access/roles per team member, and how the tools connect"),
];

// ─── Domain registry ──────────────────────────────────────────────────────────

export type KitDomainId =
  | "software"
  | "automation"
  | "video"
  | "image"
  | "music"
  | "writing"
  | "marketing"
  | "business";

export interface KitDomain {
  id: KitDomainId;
  label: string;
  /** Shown in the picker tooltip. */
  hint: string;
  /** Role line for the generation system prompt. */
  role: string;
  files: KitFileSpec[];
  /** Whether code-tool platform profiles (CLAUDE.md, .cursor/…) apply. */
  codeProfiles: boolean;
}

export const KIT_DOMAINS: KitDomain[] = [
  {
    id: "software",
    label: "Software",
    hint: "Apps, APIs, platforms",
    role: "senior software engineer",
    files: KIT_FILES,
    codeProfiles: true,
  },
  {
    id: "automation",
    label: "Automation",
    hint: "n8n, agents, workflows",
    role: "senior automation architect",
    files: AUTOMATION_FILES,
    codeProfiles: true,
  },
  {
    id: "video",
    label: "Video",
    hint: "AI video production",
    role: "senior video production director",
    files: VIDEO_FILES,
    codeProfiles: false,
  },
  {
    id: "image",
    label: "Image",
    hint: "AI image & design work",
    role: "senior art director",
    files: IMAGE_FILES,
    codeProfiles: false,
  },
  {
    id: "music",
    label: "Music",
    hint: "AI music production",
    role: "senior music producer",
    files: MUSIC_FILES,
    codeProfiles: false,
  },
  {
    id: "writing",
    label: "Writing",
    hint: "Books, scripts, blogs, copy",
    role: "senior editor",
    files: WRITING_FILES,
    codeProfiles: false,
  },
  {
    id: "marketing",
    label: "Marketing",
    hint: "Content & campaign systems",
    role: "senior marketing strategist",
    files: MARKETING_FILES,
    codeProfiles: false,
  },
  {
    id: "business",
    label: "Business",
    hint: "Structure & operations",
    role: "senior operations consultant",
    files: BUSINESS_FILES,
    codeProfiles: false,
  },
];

/** Resolve a domain id (unknown/absent falls back to software). */
export function getKitDomain(id: unknown): KitDomain {
  return KIT_DOMAINS.find((d) => d.id === id) ?? KIT_DOMAINS[0];
}

/** Static entry-point file included in every kit (not AI-generated). */
export function kitEntryFile(projectName: string, domain: KitDomain): string {
  const contextFiles = domain.files.filter((f) => f.name.endsWith(".md"));
  const hasEnv = domain.files.some((f) => f.name === "env.example");
  const list = contextFiles
    .map((f, i) => `${i + 1}. \`context/${f.name}\` — ${f.summary}`)
    .join("\n");

  return `# ${projectName} — AI Working Context

> Generated by SYPI (sypi-ai-dev.vercel.app). This is the entry point your
> AI reads first, every session. Works as CLAUDE.md or AGENTS.md.

## Working Context

Read the following files in order before doing or deciding anything:

${list}

Update \`context/progress-tracker.md\` after each meaningful working session.

If the work changes the structure, scope, or standards documented in these
files, update the relevant file before continuing.
${
  hasEnv
    ? `
Copy \`.env.example\` to \`.env\` and fill in every value before running anything.
Never commit \`.env\` or any real secret to version control.
`
    : ""
}`;
}

// ─── Platform profiles ────────────────────────────────────────────────────────
// AGENTS.md + context/ ship in every kit. For code domains, profiles add the
// tool-specific entry files; creative/business kits always get a paste-ready
// KNOWLEDGE.md instead.

export type KitProfileId = "claude-code" | "cursor" | "copilot" | "windsurf" | "lovable";

export interface KitProfile {
  id: KitProfileId;
  label: string;
  /** What the profile adds to the zip — shown in the picker tooltip. */
  hint: string;
}

export const KIT_PROFILES: KitProfile[] = [
  { id: "claude-code", label: "Claude Code", hint: "CLAUDE.md" },
  { id: "cursor", label: "Cursor", hint: ".cursor/rules/" },
  { id: "copilot", label: "Copilot", hint: ".github/copilot-instructions.md" },
  { id: "windsurf", label: "Windsurf", hint: ".windsurf/rules/" },
  { id: "lovable", label: "Lovable / v0", hint: "Knowledge doc + prompting guide" },
];

/** Wrap the entry file as a Cursor project rule (.mdc with frontmatter). */
export function cursorRuleFile(projectName: string, entryFile: string): string {
  return `---
description: ${projectName} build system — read the context files before any change
alwaysApply: true
---

${entryFile}`;
}

/** Files excluded from the paste-ready Knowledge doc. */
const KNOWLEDGE_EXCLUDE = new Set(["progress-tracker.md", "env.example", "tool-setup.md"]);

/** One paste-ready Knowledge doc for chat platforms (Lovable, v0, ChatGPT/Claude projects). */
export function kitKnowledgeFile(
  projectName: string,
  domain: KitDomain,
  kitFiles: Record<string, string>
): string {
  const sections = domain.files
    .filter((f) => !KNOWLEDGE_EXCLUDE.has(f.name))
    .map((f) => kitFiles[f.name])
    .filter(Boolean)
    .join("\n\n---\n\n");
  return `# ${projectName} — Knowledge

> Generated by SYPI (sypi-ai-dev.vercel.app). Paste this whole document into your
> AI platform's persistent context (Lovable: Settings → Knowledge. ChatGPT/Claude:
> project instructions or a project file. v0/Bolt: project instructions). It is
> sent with every prompt, so the AI always knows the system.

${sections}
`;
}

/** Static prompting guide shipped alongside the Knowledge doc. */
export function kitPromptingGuide(projectName: string): string {
  return `# ${projectName} — Prompting Guide

> How to build this system on any prompt-driven AI platform without it
> collapsing after week one. Pair with KNOWLEDGE.md (paste that into the
> platform's Knowledge/instructions first).

## Every prompt has four parts

1. **Context** — where in the system you are: "In the checkout flow, which calls the
   Payments service…"
2. **Scope** — the ONE piece to build or change. One component per prompt.
3. **Outcome** — what working looks like, verifiable: "a signed-in user can X".
4. **Constraints** — what must NOT change: "don't touch auth, keep the existing schema".

## Working rules

- Work in the order listed in \`context/progress-tracker.md\` — dependencies first.
- One piece at a time. Verify it works before prompting the next.
- Use the platform's plan/chat mode to discuss any change that touches more than one
  component BEFORE letting it act.
- When the AI breaks something: don't pile on fix prompts. Revert to the last working
  version, then re-prompt with tighter scope and constraints.
- After each finished piece, update \`context/progress-tracker.md\` (or have the AI do
  it) — it is the memory that survives between sessions.
- Secrets go in the platform's env/secrets settings, never in prompts or content.
`;
}

/** Per-file generation system prompt, framed for the domain. */
export function kitSystemPrompt(domain: KitDomain): string {
  return `
You are a ${domain.role} writing ONE file of a project's "proper system" — the
context system that separates disciplined senior-grade work from improvised
prompting. These files will be read by AI tools at the start of every session,
so precision beats prose.

RULES:
- Derive everything from the ACTUAL design provided (component names, categories,
  configured tools/technologies, connections). Reference real component labels.
- Be specific and concrete. If the canvas doesn't answer something, make ONE reasonable
  decision and state it plainly — never write "TBD" or generic filler.
- Plain Markdown with a single H1 title — unless the file's own instructions specify a
  different format (e.g. raw dotenv). No preamble, no closing summary.
- Keep each file focused on its own job — do not repeat content that belongs in the
  other files of the system.
`.trim();
}

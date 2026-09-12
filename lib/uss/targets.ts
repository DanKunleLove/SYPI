import type { UssSection } from "@/lib/uss/views";

/**
 * Execution targets — who is going to build this.
 *
 * The same specification is useful to a coding agent, a no-code builder, an
 * automation platform and a human team, but each needs a DIFFERENT rendering of
 * it. An n8n workflow spec and a threat model are not the same document with
 * different headings.
 *
 * This is the payoff of keeping the USS target-neutral (P8): no target's
 * vocabulary leaks into the core, so adding a target is adding a renderer, not
 * changing the specification.
 */

export type TargetId =
  | "claude-code"
  | "codex"
  | "lovable"
  | "n8n"
  | "human-team";

export interface TargetFile {
  /** Path inside the exported bundle. */
  path: string;
  title: string;
  /** Which parts of the spec this file is built from. */
  sections: UssSection[];
  /** What this file must contain, written as instructions to the generator. */
  guidance: string;
  /** Rendered deterministically from the spec rather than generated. */
  deterministic?: boolean;
}

export interface ExecutionTarget {
  id: TargetId;
  label: string;
  /** Who or what consumes this bundle. */
  audience: string;
  /** One line for the picker. */
  hint: string;
  /** Framing for the generator: who it is writing for. */
  role: string;
  files: TargetFile[];
}

const IMPLEMENTATION_PLAN: TargetFile = {
  path: "IMPLEMENTATION-PLAN.md",
  title: "Implementation plan",
  sections: ["requirements", "architecture", "domain", "openDecisions", "complexity"],
  guidance: `Order the work so that nothing is built before what it depends on.
Group requirements into units that each produce ONE verifiable result and can be
finished in a single sitting. For each unit: what is built, what "done" looks like
as a check someone could actually run, and what it depends on. Put anything
blocked by an unresolved decision in a separate "Blocked" section with the
decision id — do not quietly assume an answer.`,
};

export const EXECUTION_TARGETS: ExecutionTarget[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    audience: "an AI coding agent working in a repository",
    hint: "CLAUDE.md + context/ + tasks",
    role: "senior engineer briefing an AI agent that will write the code",
    files: [
      {
        path: "CLAUDE.md",
        title: "Agent entry point",
        sections: ["product", "complexity", "invariants"],
        guidance: `The first thing the agent reads every session. State what is being
built in three sentences, then the read order for the context files, then the rules
it must never violate. End with the two standing instructions: update the progress
tracker after each unit, and update the context files when the design changes.
Short. This is a map, not a manual.`,
      },
      {
        path: "context/architecture.md",
        title: "Architecture",
        sections: ["architecture", "capabilities", "providers", "decisions", "complexity"],
        guidance: `The structure, and why it is this way. Give the component table with
the chosen technology for each, the dependencies between them, and the decisions
with what was rejected. An agent that knows why a choice was made will not quietly
undo it.`,
      },
      {
        path: "context/domain.md",
        title: "Domain model",
        sections: ["domain", "invariants"],
        guidance: `The business, not the software. Entities with their meaningful
attributes, lifecycles with their LEGAL transitions, and the invariants. State
plainly that a transition not listed is illegal and must be rejected in code, and
that each invariant needs something in the implementation that enforces it.`,
      },
      {
        path: "context/requirements.md",
        title: "Requirements",
        sections: ["requirements", "nonFunctional", "useCases", "actors"],
        guidance: `Every requirement with its id and its acceptance criterion, the
non-functional requirements with their targets, and the actors with what each may
do. Keep the ids: they are how the plan and the tracker refer back here.`,
      },
      IMPLEMENTATION_PLAN,
      {
        path: "context/open-questions.md",
        title: "Open questions",
        sections: ["openDecisions", "assumptions", "unknowns"],
        guidance: `Reproduce the unresolved decisions verbatim with their ids and why
each matters, then the assumptions taken to keep moving. Instruct the agent to ASK
rather than decide when it reaches one of these. This file is what stops an agent
inventing a business rule.`,
      },
    ],
  },
  {
    id: "codex",
    label: "Codex / Cursor",
    audience: "an AI agent working from repository instructions",
    hint: "AGENTS.md + specification",
    role: "senior engineer writing repository instructions for an AI agent",
    files: [
      {
        path: "AGENTS.md",
        title: "Repository instructions",
        sections: ["product", "architecture", "complexity", "invariants"],
        guidance: `The cross-tool standard entry file. What the project is, how it is
structured, the technology choices, and the rules that must never be violated.
Written as direct instruction, not description.`,
      },
      {
        path: "SPECIFICATION.md",
        title: "Full specification",
        sections: ["product", "actors", "requirements", "nonFunctional", "domain", "invariants", "architecture", "providers"],
        guidance: `One complete document an agent can hold in context: what is being
built, for whom, the business model, the rules, and the structure. Dense and
organised; no filler.`,
      },
      IMPLEMENTATION_PLAN,
    ],
  },
  {
    id: "lovable",
    label: "Lovable / v0 / Bolt",
    audience: "an app builder driven from a chat prompt",
    hint: "Knowledge doc + prompting guide",
    role: "product engineer briefing a no-code app builder",
    files: [
      {
        path: "KNOWLEDGE.md",
        title: "Project knowledge",
        sections: ["product", "actors", "useCases", "requirements", "domain"],
        guidance: `Paste-ready persistent context for the builder. Plain language — the
reader is a generation model, not an engineer. What the product is, who uses it,
what they do, and what data it keeps. Avoid infrastructure vocabulary entirely;
this tool does not choose infrastructure.`,
      },
      {
        path: "PROMPTS.md",
        title: "Build prompts",
        sections: ["useCases", "requirements", "actors"],
        guidance: `A sequence of prompts to paste in, one screen or flow at a time, in
dependency order. Each prompt: what to build, what it must do, and what it must NOT
do yet. Building in one giant prompt is how these tools produce something that
looks right and does nothing.`,
      },
      {
        path: "RULES.md",
        title: "Rules and limits",
        sections: ["invariants", "constraints", "openDecisions"],
        guidance: `The things that must stay true however the build evolves, in plain
language, plus what is still undecided. Written so a non-engineer can check the
result against it.`,
      },
    ],
  },
  {
    id: "n8n",
    label: "n8n / Make / Zapier",
    audience: "an automation platform",
    hint: "Workflow spec + failure paths",
    role: "senior automation architect specifying a workflow",
    files: [
      {
        path: "WORKFLOW.md",
        title: "Workflow specification",
        sections: ["useCases", "requirements", "architecture", "capabilities", "providers"],
        guidance: `Specify the automation as triggers and steps. For each step: what
fires it, what it reads, what it writes, and which service it talks to. Name the
data that moves between steps. This is a wiring diagram in prose, not an essay.`,
      },
      {
        path: "FAILURE-PATHS.md",
        title: "Failure handling",
        sections: ["invariants", "implications", "domain"],
        guidance: `For EVERY step that touches an external service: what happens when it
fails, when it times out, and when it is retried. State explicitly which steps must
be idempotent and how duplicates are detected — an automation that runs twice and
creates two records is the single most common failure of this kind of system.
Include what a human should be alerted about and how.`,
      },
      {
        path: "CREDENTIALS.md",
        title: "Credentials and setup",
        sections: ["providers", "capabilities", "constraints"],
        guidance: `Every external service the workflow needs, what access it requires,
and where to obtain the credential. Placeholders only, never real values. End with
a checklist to tick before the first run.`,
      },
    ],
  },
  {
    id: "human-team",
    label: "Human engineering team",
    audience: "engineers who will design and build it themselves",
    hint: "ADRs, threat model, contracts",
    role: "principal engineer handing a design to a team",
    files: [
      {
        path: "DESIGN.md",
        title: "System design",
        sections: ["product", "requirements", "nonFunctional", "architecture", "capabilities", "complexity"],
        guidance: `A design document an engineering team would actually review. Context
and goals, non-goals, the proposed design, and the tradeoffs. Assume a reader who
will push back — write what you would defend.`,
      },
      {
        path: "DECISIONS.md",
        title: "Architecture decision records",
        sections: ["decisions", "providers", "tradeoffs", "constraints"],
        guidance: `One ADR per significant decision: context, the decision, the
alternatives considered and why each was rejected, the consequences, and what would
make you revisit it. Keep the rejected alternatives — an ADR without them is a
press release.`,
      },
      {
        path: "DOMAIN.md",
        title: "Domain model and invariants",
        sections: ["domain", "invariants"],
        guidance: `Entities, relationships, lifecycles with legal transitions, and the
invariants with what enforces each. Include an entity-relationship description a
reader could turn into a schema.`,
      },
      {
        path: "THREAT-MODEL.md",
        title: "Threat model",
        sections: ["actors", "invariants", "architecture", "domain"],
        guidance: `Trust boundaries, what an attacker would want, and how each
authorization and privacy invariant is enforced. For each actor, what they could
reach if a check were missing. Be concrete about the attack, not abstract about the
risk.`,
      },
      IMPLEMENTATION_PLAN,
    ],
  },
];

export function getTarget(id: unknown): ExecutionTarget {
  return EXECUTION_TARGETS.find((t) => t.id === id) ?? EXECUTION_TARGETS[0];
}

export function isTargetId(value: unknown): value is TargetId {
  return EXECUTION_TARGETS.some((t) => t.id === value);
}

/**
 * System prompt for rendering one file.
 *
 * The epistemic clause is the same discipline the Kit already enforces, and it
 * matters more here: these documents are handed to something that will build from
 * them, so a guess presented as a decision becomes code.
 */
export function targetSystemPrompt(target: ExecutionTarget): string {
  return `
You are a ${target.role}. You are writing ONE file of a hand-off package for
${target.audience}.

RULES:
- Derive everything from the SPECIFICATION provided. Reference its real ids, names
  and decisions. Never invent a requirement, a component or a rule.
- Keep each file to its own job. Do not repeat what belongs in a sibling file.
- Plain Markdown, one H1, no preamble and no closing summary.

EPISTEMIC DISCIPLINE — the specification marks how well each fact is established,
and you must preserve that rather than flattening it into confident prose:
- KNOWN → state as fact.
- marked (inferred) → state it, then add "(inferred — confirm before building)".
- marked (ASSUMPTION) or (UNKNOWN) → do NOT resolve it. Label it and list it under
  Assumptions or Open questions.
Whoever reads this will build from it. A guess presented as a decision becomes code.
`.trim();
}

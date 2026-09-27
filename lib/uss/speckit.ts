import { UssGraph } from "@/lib/uss/graph";
import { tierDef } from "@/lib/uss/complexity";
import { classifyEars } from "@/lib/uss/requirements-quality";
import { runScenarios } from "@/lib/uss/scenarios";
import { renderTasksMarkdown } from "@/lib/uss/tasks";
import {
  actors,
  assumptions,
  components,
  constraints,
  decisions,
  domainEntities,
  invariants,
  nonFunctional,
  openDecisions,
  product,
  providerBindings,
  requirements,
  transitions,
  unknowns,
  useCases,
} from "@/lib/uss/views";
import type { Entity, Uss } from "@/lib/uss/schema";

/**
 * GitHub Spec Kit export.
 *
 * Spec Kit's workflow is constitution → spec → plan → tasks, with the documents
 * living in `.specify/memory/` and `specs/###-feature/`. Every one of them can be
 * rendered from the SYPI graph with no model call, so a Spec Kit user can take a
 * design reasoned in SYPI straight into `/implement`.
 *
 * Headings follow Spec Kit's own templates so its commands find what they expect.
 * SYPI ids are kept beside Spec Kit's (FR-001 ← REQ-004) so the two stay traceable.
 */

export const SPECKIT_FEATURE_DIR = "specs/001-initial-system";

type Requirement = Extract<Entity, { kind: "requirement" }>;

const today = () => new Date().toISOString().slice(0, 10);
const nameOf = (doc: Uss, fallback: string) => product(doc)?.title ?? fallback;
const pad = (n: number) => String(n).padStart(3, "0");

/** Epistemic markers survive the export: an inference is not a decision. */
function mark(e: { status: string }): string {
  if (e.status === "INFERRED") return " *(inferred — confirm)*";
  if (e.status === "ASSUMPTION") return " *(assumption)*";
  if (e.status === "UNKNOWN") return " *(unknown)*";
  return "";
}

/** "WHEN x, THE SYSTEM SHALL y" → Spec Kit's "**When** x, **Then** the system shall y". */
export function earsToScenario(criterion: string): string {
  const pattern = classifyEars(criterion);
  const m = criterion.match(/^\s*(when|while|if|where)\s+(.+?),\s*(?:then\s+)?(the\s+.+)$/i);
  if (m && pattern && pattern !== "ubiquitous") {
    const lead = { when: "When", while: "Given", if: "When", where: "Given" }[m[1].toLowerCase()] ?? "When";
    const then = m[3].replace(/^the system shall/i, "the system shall");
    return `**${lead}** ${m[2].trim()}, **Then** ${then.trim()}`;
  }
  return criterion.trim();
}

/** Open questions that name a requirement, as Spec Kit clarification markers. */
function clarificationsFor(doc: Uss, reqId: string): string {
  const qs = openDecisions(doc).filter((d) => d.impact.affectsRequirements.includes(reqId));
  return qs.map((d) => ` [NEEDS CLARIFICATION: ${d.question}]`).join("");
}

const PRIORITY: Record<Requirement["priority"], string> = { must: "P1", should: "P2", could: "P3" };

// ─── constitution.md ─────────────────────────────────────────────────────────

export function renderConstitution(doc: Uss, projectName: string): string {
  const { tier, label, budget } = doc.complexity;
  const def = tierDef(tier);
  const inv = invariants(doc);
  const out: string[] = [`# ${nameOf(doc, projectName)} Constitution`, ""];

  out.push("## Core Principles", "");

  out.push(
    "### I. Proportionate complexity",
    `This is a tier-${tier} (${label}) system: ${def.description}`,
    `- At most **${budget.maxComponents} components**.`,
    budget.allowAsyncMessaging ? "" : "- No message queues, event buses or streaming.",
    budget.allowCaching ? "" : "- No dedicated cache tier.",
    budget.allowServiceDecomposition ? "" : "- One deployable service — no microservices.",
    budget.allowMultiRegion ? "" : "- Single region.",
    "Adding any of these requires a requirement that justifies it, recorded in Complexity Tracking.",
    ""
  );

  out.push("### II. Business rules are laws");
  if (inv.length === 0) {
    out.push("No invariants are recorded yet. Add them before implementing anything that moves money or data.", "");
  } else {
    out.push("Each rule below is enforced in code and covered by a test that tries to break it.", "");
    for (const i of inv) {
      out.push(`- **${i.id}** (${i.severity}): ${i.statement}${mark(i)}${i.enforcement ? ` — enforced by ${i.enforcement}` : ""}`);
    }
    out.push("");
  }

  out.push(
    "### III. Nothing unknown is decided silently",
    "Anything marked *(inferred)*, *(assumption)* or `[NEEDS CLARIFICATION]` is not a decision.",
    "Ask before building on it; never resolve it by guessing.",
    "",
    "### IV. Every requirement is testable",
    "Acceptance criteria are written as WHEN / THE SYSTEM SHALL checks. A requirement without one is not done when it is coded — it is done when its check passes.",
    ""
  );

  const cons = constraints(doc);
  if (cons.length) {
    out.push("## Constraints", "");
    for (const c of cons) out.push(`- **${c.category}**: ${c.statement}${mark(c)}`);
    out.push("");
  }

  out.push(
    "## Governance",
    "",
    "This constitution was generated from the SYPI specification. When the design changes, regenerate it rather than editing by hand.",
    "",
    `**Version**: 1.0.0 | **Ratified**: ${today()} | **Last Amended**: ${today()}`,
    ""
  );
  return out.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

// ─── spec.md ─────────────────────────────────────────────────────────────────

export function renderSpec(doc: Uss, projectName: string): string {
  const p = product(doc);
  const reqs = requirements(doc);
  const out: string[] = [
    `# Feature Specification: ${nameOf(doc, projectName)}`,
    "",
    `**Feature Branch**: \`001-initial-system\``,
    "",
    `**Created**: ${today()}`,
    "",
    "**Status**: Draft",
    "",
    `**Input**: ${p?.problem ? `"${p.problem}"` : "Generated from the SYPI specification."}`,
    "",
    "## User Scenarios & Testing *(mandatory)*",
    "",
  ];

  // Stories: use cases where they exist; otherwise one per requirement.
  const ucs = useCases(doc);
  const g = new UssGraph(doc);
  let n = 0;
  if (ucs.length > 0) {
    for (const uc of ucs) {
      n++;
      const who = g.sources(uc.id, "actsOn").map((a) => a.title);
      out.push(`### User Story ${n} - ${uc.title} (Priority: P${Math.min(n, 3)})`, "");
      out.push(
        `${who.length ? `${who.join(", ")}: ` : ""}${uc.trigger ? `when ${uc.trigger}, ` : ""}${uc.mainFlow.join(" → ") || uc.title}.${mark(uc)}`,
        ""
      );
      if (uc.postconditions.length) {
        out.push(`**Independent Test**: after the flow, ${uc.postconditions.join("; ")}.`, "");
      }
      if (uc.alternateFlows.length) {
        out.push("**Acceptance Scenarios**:", "");
        uc.alternateFlows.forEach((f, i) => out.push(`${i + 1}. ${f}`));
        out.push("");
      }
      out.push("---", "");
    }
  } else {
    for (const r of reqs) {
      n++;
      out.push(`### User Story ${n} - ${r.title} (Priority: ${PRIORITY[r.priority]})`, "");
      out.push(`${r.statement}${mark(r)}`, "");
      if (r.acceptanceCriteria.length) {
        out.push("**Acceptance Scenarios**:", "");
        r.acceptanceCriteria.forEach((c, i) => out.push(`${i + 1}. ${earsToScenario(c)}`));
        out.push("");
      }
      out.push("---", "");
    }
  }
  if (n === 0) out.push("No user stories yet.", "");

  // Edge cases come from the scenario engine — the things that go wrong in production.
  const edge = runScenarios(doc).filter((s) => s.outcome !== "pass");
  out.push("### Edge Cases", "");
  if (edge.length) for (const s of edge) out.push(`- ${s.question}${s.outcome === "gap" ? " — **not handled yet**" : ""}`);
  else out.push("- No failure scenarios apply yet.");
  out.push("");

  out.push("## Requirements *(mandatory)*", "", "### Functional Requirements", "");
  if (reqs.length === 0) out.push("- None recorded yet.");
  reqs.forEach((r, i) => {
    out.push(`- **FR-${pad(i + 1)}** (${r.id}, ${PRIORITY[r.priority]}): ${r.statement}${mark(r)}${clarificationsFor(doc, r.id)}`);
    for (const c of r.acceptanceCriteria) out.push(`  - ${earsToScenario(c)}`);
  });
  out.push("");

  // Unanswered questions not tied to one requirement still need to be visible.
  const loose = openDecisions(doc).filter((d) => d.impact.affectsRequirements.length === 0 && d.impact.severity !== "cosmetic");
  if (loose.length) {
    out.push("### Open Questions", "");
    for (const d of loose) out.push(`- [NEEDS CLARIFICATION: ${d.question}] (${d.id}, ${d.impact.severity})`);
    out.push("");
  }

  const ents = domainEntities(doc);
  if (ents.length) {
    out.push("### Key Entities", "");
    for (const e of ents) {
      out.push(`- **${e.title}**: ${e.description || "—"}${e.keyAttributes.length ? ` Key attributes: ${e.keyAttributes.join(", ")}.` : ""}${mark(e)}`);
    }
    out.push("");
  }

  out.push("## Success Criteria *(mandatory)*", "", "### Measurable Outcomes", "");
  const outcomes = [
    ...(p?.successCriteria ?? []),
    ...nonFunctional(doc).filter((r) => r.target).map((r) => `${r.title}: ${r.target}`),
  ];
  if (outcomes.length === 0) out.push("- [NEEDS CLARIFICATION: how will you know this works?]");
  outcomes.forEach((o, i) => out.push(`- **SC-${pad(i + 1)}**: ${o}`));
  out.push("");

  const assumed = [...assumptions(doc).map((a) => `${a.statement}${a.ifWrong ? ` (if wrong: ${a.ifWrong})` : ""}`), ...(p?.outOfScope ?? []).map((o) => `Out of scope for v1: ${o}`)];
  out.push("## Assumptions", "");
  if (assumed.length === 0) out.push("- None recorded.");
  for (const a of assumed) out.push(`- ${a}`);
  const unk = unknowns(doc);
  for (const u of unk) out.push(`- [NEEDS CLARIFICATION: ${u.question}]`);
  out.push("");

  return out.join("\n");
}

// ─── plan.md ─────────────────────────────────────────────────────────────────

export function renderPlan(doc: Uss, projectName: string): string {
  const p = product(doc);
  const comps = components(doc).filter((c) => !c.orphaned);
  const tech = (cats: string[]) =>
    [...new Set(comps.filter((c) => cats.includes(c.category)).map((c) => c.technology ?? c.title))].join(", ") ||
    "NEEDS CLARIFICATION";
  const nfr = nonFunctional(doc);
  const { tier, label, budget } = doc.complexity;
  const out: string[] = [
    `# Implementation Plan: ${nameOf(doc, projectName)}`,
    "",
    `**Branch**: \`001-initial-system\` | **Date**: ${today()} | **Spec**: [spec.md](./spec.md)`,
    "",
    "## Summary",
    "",
    p ? `${p.problem}${p.valueProposition ? ` ${p.valueProposition}` : ""}` : "See spec.md.",
    "",
    "## Technical Context",
    "",
    `**Primary Dependencies**: ${[...new Set([...comps.map((c) => c.technology).filter(Boolean), ...providerBindings(doc).map((b) => b.providerLabel)])].join(", ") || "NEEDS CLARIFICATION"}`,
    "",
    `**Storage**: ${tech(["database", "storage"])}`,
    "",
    `**Testing**: one test per acceptance criterion in spec.md, plus one that tries to break each rule in the constitution`,
    "",
    `**Target Platform**: ${tech(["client"])}`,
    "",
    `**Project Type**: ${comps.some((c) => c.category === "client") && comps.some((c) => ["service", "compute", "gateway"].includes(c.category)) ? "web application (frontend + backend)" : "single project"}`,
    "",
    `**Performance Goals**: ${nfr.filter((r) => ["performance", "scalability"].includes(r.nfrCategory ?? "")).map((r) => r.target ?? r.title).join("; ") || "none stated"}`,
    "",
    `**Constraints**: ${constraints(doc).map((c) => c.statement).join("; ") || "none recorded"}`,
    "",
    `**Scale/Scope**: tier ${tier} (${label}), at most ${budget.maxComponents} components`,
    "",
    "## Constitution Check",
    "",
    `- [${comps.length <= budget.maxComponents ? "x" : " "}] Within the complexity budget (${comps.length}/${budget.maxComponents} components)`,
    ...invariants(doc).map((i) => {
      const enforced = new UssGraph(doc).from(i.id, "enforcedBy").length > 0;
      return `- [${enforced ? "x" : " "}] ${i.id} has an enforcer${enforced ? "" : " — **decide where this rule lives**"}`;
    }),
    `- [${openDecisions(doc).some((d) => d.impact.severity === "blocking") ? " " : "x"}] No blocking questions open`,
    "",
    "## Project Structure",
    "",
    "### Documentation (this feature)",
    "",
    "```text",
    `${SPECKIT_FEATURE_DIR}/`,
    "├── spec.md",
    "├── plan.md",
    "├── data-model.md",
    "└── tasks.md",
    "```",
    "",
    "### Architecture",
    "",
    "| Component | Kind | Technology | Responsibility |",
    "| --- | --- | --- | --- |",
    ...comps.map((c) => `| ${c.title}${c.status === "INFERRED" ? " *(inferred)*" : ""} | ${c.category} | ${c.technology ?? "—"} | ${c.responsibility.replace(/\|/g, "/") || "—"} |`),
    "",
  ];

  const dec = decisions(doc);
  if (dec.length) {
    out.push("### Decisions", "");
    for (const d of dec) {
      out.push(`- **${d.title}** → ${d.choice}. ${d.rationale}`);
      for (const a of d.alternatives) out.push(`  - Rejected ${a.option}: ${a.rejectedBecause}`);
    }
    out.push("");
  }

  out.push("## Complexity Tracking", "");
  const over = doc.integrity.filter((f) => f.rule === "capability-over-tier" || f.rule === "budget-violation");
  if (over.length === 0) out.push("No violations of the constitution's complexity budget.");
  else {
    out.push("| Violation | Why Needed | Simpler Alternative Rejected Because |", "| --- | --- | --- |");
    for (const f of over) out.push(`| ${f.message.replace(/\|/g, "/")} | NEEDS CLARIFICATION | NEEDS CLARIFICATION |`);
  }
  out.push("");
  return out.join("\n");
}

// ─── data-model.md ───────────────────────────────────────────────────────────

export function renderDataModel(doc: Uss, projectName: string): string {
  const ents = domainEntities(doc);
  const trans = transitions(doc);
  const invs = invariants(doc);
  const g = new UssGraph(doc);
  const out: string[] = [`# Data Model: ${nameOf(doc, projectName)}`, ""];

  if (ents.length === 0) {
    out.push("No domain entities recorded yet.", "");
    return out.join("\n");
  }

  for (const e of ents) {
    out.push(`## ${e.title}${mark(e)}`, "");
    if (e.description) out.push(e.description, "");
    const flags = [e.tenantScoped ? "scoped to a tenant" : "", e.financial ? "records money movement" : ""].filter(Boolean);
    if (flags.length) out.push(`*${flags.join(" · ")}*`, "");
    if (e.keyAttributes.length) {
      out.push("**Key attributes**:", "");
      for (const a of e.keyAttributes) out.push(`- ${a}`);
      out.push("");
    }
    const own = trans.filter((t) => t.entityTitle.toLowerCase() === e.title.toLowerCase());
    if (own.length) {
      out.push("**Lifecycle** — any transition not listed is illegal:", "");
      for (const t of own) out.push(`- ${t.from} → ${t.to}${t.trigger ? ` on ${t.trigger}` : ""}${t.guard ? ` (only if ${t.guard})` : ""}`);
      out.push("");
    }
    const rules = invs.filter((i) => g.from(i.id, "governs").some((r) => r.to === e.id));
    if (rules.length) {
      out.push("**Rules**:", "");
      for (const r of rules) out.push(`- ${r.statement}`);
      out.push("");
    }
  }

  const people = actors(doc);
  if (people.length) {
    out.push("## Who can do what", "");
    for (const a of people) out.push(`- **${a.title}**: ${a.permissions.join("; ") || "permissions not yet defined"}`);
    out.push("");
  }
  return out.join("\n");
}

export function renderSpeckitTasks(doc: Uss): string {
  return renderTasksMarkdown(doc).replace(
    /^(# Tasks: .*\n)/,
    `$1\n**Input**: Design documents from \`/${SPECKIT_FEATURE_DIR}/\`\n\n**Prerequisites**: plan.md, spec.md, data-model.md\n`
  );
}

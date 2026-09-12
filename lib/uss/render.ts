import { renderBudgetForPrompt } from "@/lib/uss/complexity";
import {
  actors,
  architecture,
  assumptions,
  capabilities,
  constraints,
  decisions,
  glossary,
  materialOpenDecisions,
  nonFunctional,
  product,
  requirements,
  sectionIsEmpty,
  implications,
  domainEntities,
  invariants,
  providerBindings,
  transitions,
  tradeoffs,
  unknowns,
  useCases,
  type UssSection,
} from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";

/**
 * Render a NARROW SLICE of the spec for a prompt.
 *
 * The most important rule in the USS codebase lives here: a prompt never receives
 * the whole specification, and an EMPTY SECTION IS NEVER RENDERED. Handing a model
 * a document full of empty headings makes it hallucinate uniformly to fill them —
 * the failure mode this entire design exists to avoid.
 *
 * Status markers are rendered inline so the model can see what is established
 * fact, what was inferred, and what is explicitly unknown. Without them it treats
 * an assumption as a given, which is exactly how unknowns become facts.
 */

const MARK: Record<string, string> = {
  KNOWN: "",
  INFERRED: " (inferred)",
  ASSUMPTION: " (ASSUMPTION — unconfirmed)",
  UNKNOWN: " (UNKNOWN)",
};

function mark(status: string): string {
  return MARK[status] ?? "";
}

export interface RenderOptions {
  sections: UssSection[];
  /** Hard ceiling; lowest-value sections are dropped first if exceeded. */
  maxChars?: number;
}

/** Sections dropped first when the render exceeds maxChars. */
const DROP_ORDER: UssSection[] = [
  "tradeoffs",
  "domain",
  "glossary",
  "assumptions",
  "unknowns",
  "useCases",
  "decisions",
  "nonFunctional",
  "openDecisions",
  "capabilities",
  "constraints",
  "actors",
  "requirements",
  "architecture",
  "complexity",
  "product",
];

function renderSection(doc: Uss, section: UssSection): string | null {
  if (sectionIsEmpty(doc, section)) return null;

  switch (section) {
    case "product": {
      const p = product(doc)!;
      const lines = [`PRODUCT${mark(p.status)}: ${p.title}`, p.problem];
      if (p.valueProposition) lines.push(`Value: ${p.valueProposition}`);
      if (p.inScope.length) lines.push(`In scope: ${p.inScope.join("; ")}`);
      if (p.outOfScope.length) lines.push(`OUT of scope (do not design for these): ${p.outOfScope.join("; ")}`);
      if (p.successCriteria.length) lines.push(`Success: ${p.successCriteria.join("; ")}`);
      return lines.join("\n");
    }
    case "complexity":
      return renderBudgetForPrompt(doc.complexity);
    case "actors":
      return `ACTORS:\n${actors(doc)
        .map((a) => `- ${a.title}${mark(a.status)}${a.description ? `: ${a.description}` : ""}${a.permissions.length ? ` [may: ${a.permissions.join(", ")}]` : ""}`)
        .join("\n")}`;
    case "requirements":
      return `REQUIREMENTS:\n${requirements(doc)
        .map((r) => `- [${r.id}] ${r.statement}${mark(r.status)}${r.acceptanceCriteria.length ? ` (done when: ${r.acceptanceCriteria.join("; ")})` : ""}`)
        .join("\n")}`;
    case "nonFunctional":
      return `NON-FUNCTIONAL REQUIREMENTS:\n${nonFunctional(doc)
        .map((r) => `- [${r.id}] ${r.nfrCategory ?? "general"}: ${r.statement}${r.target ? ` — target ${r.target}` : " — NO TARGET SET"}${mark(r.status)}`)
        .join("\n")}`;
    case "useCases":
      return `USE CASES:\n${useCases(doc)
        .map((u) => `- ${u.title}${u.trigger ? ` (when: ${u.trigger})` : ""}${u.mainFlow.length ? `\n    ${u.mainFlow.join(" → ")}` : ""}`)
        .join("\n")}`;
    case "constraints":
      return `CONSTRAINTS:\n${constraints(doc)
        .map((c) => `- [${c.category}] ${c.statement}${mark(c.status)}`)
        .join("\n")}`;
    case "assumptions":
      return `ASSUMPTIONS (unconfirmed — do not treat as fact):\n${assumptions(doc)
        .map((a) => `- ${a.statement}${a.ifWrong ? ` (if wrong: ${a.ifWrong})` : ""}`)
        .join("\n")}`;
    case "unknowns":
      return `KNOWN UNKNOWNS (do not invent answers):\n${unknowns(doc)
        .map((u) => `- ${u.question}`)
        .join("\n")}`;
    case "openDecisions": {
      const open = materialOpenDecisions(doc);
      if (open.length === 0) return null;
      return `UNRESOLVED DECISIONS that affect this design:\n${open
        .map((d) => `- [${d.id}] ${d.question} (${d.impact.severity})`)
        .join("\n")}`;
    }
    case "decisions":
      return `DECISIONS ALREADY MADE:\n${decisions(doc)
        .map((d) => `- ${d.choice} — ${d.rationale}${d.alternatives.length ? ` (rejected: ${d.alternatives.map((a) => a.option).join(", ")})` : ""}`)
        .join("\n")}`;
    case "capabilities":
      return `CAPABILITIES THE SYSTEM NEEDS:\n${capabilities(doc)
        .map((c) => `- ${c.capabilityClass}${c.why ? ` — ${c.why}` : ""}`)
        .join("\n")}`;
    case "architecture": {
      const a = architecture(doc);
      const byId = new Map(a.components.map((c) => [c.id, c.title]));
      const comps = a.components
        .map((c) => `- ${c.title} (${c.category})${c.technology ? ` [${c.technology}]` : ""}${c.responsibility ? `: ${c.responsibility}` : ""}${c.orphaned ? " [REMOVED FROM CANVAS]" : ""}`)
        .join("\n");
      const deps = a.dependencies
        .map((d) => `- ${byId.get(d.from) ?? d.from} → ${byId.get(d.to) ?? d.to}${d.note ? ` [${d.note}]` : ""}`)
        .join("\n");
      return `CURRENT ARCHITECTURE:\n${comps}${deps ? `\n\nCONNECTIONS:\n${deps}` : ""}`;
    }
    case "glossary":
      return `GLOSSARY:\n${glossary(doc)
        .map((t) => `- ${t.title}: ${t.definition}`)
        .join("\n")}`;
    case "implications":
      // Rendered as REQUIREMENTS OF THE DESIGN rather than as suggestions. These
      // are the things the baseline showed a model will otherwise omit — payment
      // idempotency, order lifecycles, tenant scoping — so they are stated as
      // obligations the architecture must satisfy, not as advice it may take.
      return `WHAT THE REQUIREMENTS IMPLY — the design MUST account for each of these:\n${implications(
        doc
      )
        .map((i) => `- ${i.statement}${i.trigger ? ` (because: ${i.trigger})` : ""}`)
        .join("\n")}`;
    case "tradeoffs":
      return `TRADEOFFS:\n${tradeoffs(doc)
        .map((t) => `- ${t.statement}${t.costs.length ? ` — costs: ${t.costs.join(", ")}` : ""}`)
        .join("\n")}`;
    case "domain": {
      const entities = domainEntities(doc);
      const trans = transitions(doc);
      const lines = entities.map((e) => {
        const own = trans.filter((t) => t.entityTitle === e.title);
        const flags = [
          e.tenantScoped ? "belongs to one customer" : "",
          e.financial ? "records money" : "",
        ].filter(Boolean);
        return (
          `- ${e.title}${flags.length ? ` [${flags.join("; ")}]` : ""}` +
          `${e.keyAttributes.length ? `: ${e.keyAttributes.join(", ")}` : ""}` +
          (own.length
            ? `\n    legal transitions: ${own
                .map((t) => `${t.from}→${t.to}${t.guard ? ` (only if ${t.guard})` : ""}`)
                .join(", ")}`
            : "")
        );
      });
      return `DOMAIN MODEL — the things this business tracks. Transitions not listed are ILLEGAL and the system must reject them:\n${lines.join("\n")}`;
    }
    case "providers":
      // Rendered with the rejected alternatives, so the design carries its own
      // justification rather than reading as a list of preferences.
      return `TECHNOLOGY CHOICES — each was selected against the project's constraints:\n${providerBindings(
        doc
      )
        .map(
          (b) =>
            `- ${b.capabilityClass}: ${b.providerLabel}${b.rationale ? ` — ${b.rationale}` : ""}${b.drivenBy.length ? ` [driven by: ${b.drivenBy.join("; ")}]` : ""}`
        )
        .join("\n")}`;
    case "invariants":
      // Stated as laws, because that is what they are. The architecture must
      // show how each is enforced, not merely avoid contradicting it.
      return `INVARIANTS — rules this system must NEVER violate. For each one, the design must make clear what enforces it:\n${invariants(
        doc
      )
        .map(
          (i) =>
            `- ${i.statement}${i.violationConsequence ? ` (if violated: ${i.violationConsequence})` : ""}${i.enforcement ? ` [enforced by: ${i.enforcement}]` : " [NOTHING ENFORCES THIS YET]"}`
        )
        .join("\n")}`;
  }
}

export function renderUssForPrompt(doc: Uss, options: RenderOptions): string {
  const maxChars = options.maxChars ?? 18_000;

  // Preserve the caller's order; empty sections never appear.
  let chosen = options.sections.slice();
  let rendered = chosen
    .map((s) => renderSection(doc, s))
    .filter((s): s is string => Boolean(s));
  let out = rendered.join("\n\n");

  // Over budget: drop the lowest-value sections that are actually present.
  for (const candidate of DROP_ORDER) {
    if (out.length <= maxChars) break;
    if (!chosen.includes(candidate)) continue;
    chosen = chosen.filter((s) => s !== candidate);
    rendered = chosen.map((s) => renderSection(doc, s)).filter((s): s is string => Boolean(s));
    out = rendered.join("\n\n");
  }

  return out.length > maxChars ? out.slice(0, maxChars) : out;
}

/** One-line summary for a chat system prompt. */
export function renderUssSummary(doc: Uss): string {
  const p = product(doc);
  const open = materialOpenDecisions(doc);
  const parts = [
    p ? `Building: ${p.title}` : "Nothing established about the product yet",
    `tier ${doc.complexity.tier} (${doc.complexity.label})`,
    `${requirements(doc).length} requirements`,
    `${architecture(doc).components.length} components`,
    `spec ${doc.meta.completeness}% complete`,
  ];
  if (open.length > 0) {
    parts.push(`${open.length} unresolved decision(s) that affect the design`);
  }
  return parts.join(" · ");
}

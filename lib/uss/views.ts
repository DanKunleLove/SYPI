import { UssGraph } from "@/lib/uss/graph";
import type { Entity, Uss } from "@/lib/uss/schema";

/**
 * Views — the "sections" of the spec, computed over the entity graph rather than
 * stored. Adding a view is a pure addition; no storage or migration changes.
 */

export type UssSection =
  | "product"
  | "actors"
  | "requirements"
  | "nonFunctional"
  | "useCases"
  | "constraints"
  | "assumptions"
  | "unknowns"
  | "openDecisions"
  | "decisions"
  | "capabilities"
  | "architecture"
  | "glossary"
  | "complexity"
  | "implications"
  | "tradeoffs"
  | "domain"
  | "invariants"
  | "providers";

export const ALL_SECTIONS: UssSection[] = [
  "product",
  "actors",
  "requirements",
  "nonFunctional",
  "useCases",
  "constraints",
  "assumptions",
  "unknowns",
  "openDecisions",
  "decisions",
  "capabilities",
  "architecture",
  "glossary",
  "complexity",
  "implications",
  "tradeoffs",
  "domain",
  "invariants",
  "providers",
];

type Of<K extends Entity["kind"]> = Extract<Entity, { kind: K }>;

export function product(doc: Uss): Of<"product"> | undefined {
  return new UssGraph(doc).byKind("product")[0];
}

export function actors(doc: Uss): Of<"actor">[] {
  return new UssGraph(doc).byKind("actor");
}

export function requirements(doc: Uss): Of<"requirement">[] {
  return new UssGraph(doc)
    .byKind("requirement")
    .filter((r) => r.requirementKind === "functional");
}

export function nonFunctional(doc: Uss): Of<"requirement">[] {
  return new UssGraph(doc)
    .byKind("requirement")
    .filter((r) => r.requirementKind === "non-functional");
}

export function useCases(doc: Uss): Of<"useCase">[] {
  return new UssGraph(doc).byKind("useCase");
}

export function constraints(doc: Uss): Of<"constraint">[] {
  return new UssGraph(doc).byKind("constraint");
}

export function assumptions(doc: Uss): Of<"assumption">[] {
  return new UssGraph(doc).byKind("assumption");
}

export function unknowns(doc: Uss): Of<"unknown">[] {
  return new UssGraph(doc).byKind("unknown");
}

export function decisions(doc: Uss): Of<"decision">[] {
  return new UssGraph(doc).byKind("decision");
}

export function capabilities(doc: Uss): Of<"capability">[] {
  return new UssGraph(doc).byKind("capability");
}

export function components(doc: Uss): Of<"component">[] {
  return new UssGraph(doc).byKind("component");
}

export function glossary(doc: Uss): Of<"term">[] {
  return new UssGraph(doc).byKind("term");
}

export function domainEntities(doc: Uss): Of<"domainEntity">[] {
  return new UssGraph(doc).byKind("domainEntity");
}

export function providerBindings(doc: Uss): Of<"providerBinding">[] {
  return new UssGraph(doc).byKind("providerBinding");
}

export function findings(doc: Uss): Of<"finding">[] {
  return new UssGraph(doc).byKind("finding").filter((f) => !f.dismissed);
}

export function invariants(doc: Uss): Of<"invariant">[] {
  return new UssGraph(doc).byKind("invariant");
}

export function transitions(doc: Uss): Of<"transition">[] {
  return new UssGraph(doc).byKind("transition");
}

export function implications(doc: Uss): Of<"implication">[] {
  return new UssGraph(doc).byKind("implication");
}

export function tradeoffs(doc: Uss): Of<"tradeoff">[] {
  return new UssGraph(doc).byKind("tradeoff");
}

export function openDecisions(doc: Uss): Of<"openDecision">[] {
  return new UssGraph(doc)
    .byKind("openDecision")
    .filter((d) => !d.resolvedAt);
}

/**
 * The ranking rule that drives the whole "progressive rigor" UX.
 *
 * A decision is MATERIAL only when answering it would change the architecture, or
 * when it blocks. This is what produces "17 open questions, 6 of which affect this
 * design" — the 6 is computed, never claimed. If this rule goes soft the decisions
 * tray becomes a nag bar and users close the panel, which kills the strategy.
 */
export function materialOpenDecisions(doc: Uss): Of<"openDecision">[] {
  return openDecisions(doc).filter(
    (d) => d.impact.severity === "blocking" || d.impact.affectsComponents.length > 0
  );
}

export function blockingOpenDecisions(doc: Uss): Of<"openDecision">[] {
  return openDecisions(doc).filter((d) => d.impact.severity === "blocking");
}

/** Architecture view: components plus their dependency edges. */
export function architecture(doc: Uss): {
  components: Of<"component">[];
  dependencies: { from: string; to: string; note?: string }[];
} {
  const g = new UssGraph(doc);
  return {
    components: g.byKind("component"),
    dependencies: g
      .relations()
      .filter((r) => r.type === "dependsOn")
      .map((r) => ({ from: r.from, to: r.to, note: r.note })),
  };
}

/** Is a section empty? Used to hard-filter sections out of prompts. */
export function sectionIsEmpty(doc: Uss, section: UssSection): boolean {
  switch (section) {
    case "product":
      return !product(doc);
    case "complexity":
      return doc.complexity.status === "UNKNOWN";
    case "actors":
      return actors(doc).length === 0;
    case "requirements":
      return requirements(doc).length === 0;
    case "nonFunctional":
      return nonFunctional(doc).length === 0;
    case "useCases":
      return useCases(doc).length === 0;
    case "constraints":
      return constraints(doc).length === 0;
    case "assumptions":
      return assumptions(doc).length === 0;
    case "unknowns":
      return unknowns(doc).length === 0;
    case "openDecisions":
      return openDecisions(doc).length === 0;
    case "decisions":
      return decisions(doc).length === 0;
    case "capabilities":
      return capabilities(doc).length === 0;
    case "architecture":
      return components(doc).length === 0;
    case "glossary":
      return glossary(doc).length === 0;
    case "implications":
      return implications(doc).length === 0;
    case "tradeoffs":
      return tradeoffs(doc).length === 0;
    case "domain":
      return domainEntities(doc).length === 0;
    case "invariants":
      return invariants(doc).length === 0;
    case "providers":
      return providerBindings(doc).length === 0;
  }
}

/**
 * Spec coverage, tolerant of documents written before the rename.
 *
 * `coverage` defaults to 0, so a document stored under the old name would read as
 * a hard 0 until the next write. Falling back keeps existing projects showing the
 * truth, and they self-heal on their next commit.
 */
export function specCoverage(doc: Uss): number {
  return doc.meta.coverage || doc.meta.completeness || 0;
}

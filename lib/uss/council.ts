import type { CapabilityClass } from "@/lib/capabilities/registry";
import { unenforcedInvariants } from "@/lib/uss/domain";
import { UssGraph } from "@/lib/uss/graph";
import { capabilities, domainEntities, invariants, requirements } from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";
import type { UssSection as Section } from "@/lib/uss/views";

/**
 * The Engineering Council — the right specialists, chosen by what the system
 * actually does.
 *
 * Replaces the single generic critique pass. A payments platform needs security,
 * data and compliance eyes; a tier-1 internal tool needs an architect and someone
 * asking whether it can actually be built. Sending every project to every
 * reviewer would be expensive, slow, and would bury the real findings in
 * boilerplate — which is the failure mode of most automated review.
 *
 * Selection is DETERMINISTIC: derived from capabilities, domain facts and tier,
 * never from a model's opinion about which reviewers it would like to be.
 */

export type DisciplineId =
  | "architecture"
  | "implementability"
  | "security"
  | "data"
  | "reliability"
  | "cost"
  | "compliance"
  | "ai"
  | "frontend"
  | "operations";

export interface Discipline {
  id: DisciplineId;
  label: string;
  /** What this reviewer is looking for — becomes their system prompt. */
  brief: string;
  /** Spec sections this reviewer needs. Keeps each review call narrow. */
  sections: Section[];
  /** Always included, regardless of what the system does. */
  always?: boolean;
  /** Capability classes that summon this reviewer. */
  triggeredBy?: CapabilityClass[];
  /** Minimum tier at which this reviewer is worth the call. */
  minTier?: number;
}

export const DISCIPLINES: Discipline[] = [
  {
    id: "architecture",
    label: "Architecture",
    always: true,
    sections: ["architecture", "requirements", "capabilities", "complexity", "implications"],
    brief: `You review the SHAPE of the system. Look for: components that serve no requirement;
missing components that a stated requirement demands; responsibilities split across
components that should be together, or bundled together that should be apart; and
complexity that the stated scale does not justify. Be specific about which component,
and be willing to say the design is fine.`,
  },
  {
    id: "implementability",
    label: "Implementability",
    always: true,
    sections: ["architecture", "requirements", "domain", "openDecisions"],
    brief: `You are the engineer who has to BUILD this from the specification alone. Find every
place you would have to stop and invent a decision: an unnamed technology where the
choice matters, a contract between two components that is not defined, a business rule
implied but never stated. Each finding must name what you would be forced to guess.`,
  },
  {
    id: "security",
    label: "Security",
    triggeredBy: ["AUTH", "AUTHZ", "PAYMENTS", "OBJECT_STORAGE"],
    minTier: 2,
    sections: ["architecture", "actors", "invariants", "domain", "constraints"],
    brief: `You review who can reach what. Look for: authorization decided in the interface rather
than on every request; data belonging to one customer reachable by another; stored files
or records readable without a check; secrets in the wrong place; and trust placed in
anything the client sends. Assume an attacker calls the API directly.`,
  },
  {
    id: "data",
    label: "Data & consistency",
    triggeredBy: ["RELATIONAL_STORE", "DOCUMENT_STORE", "PAYMENTS"],
    minTier: 2,
    sections: ["domain", "invariants", "architecture", "requirements"],
    brief: `You review correctness of state. Look for: operations that must be atomic but are
spread across systems; two users changing the same thing concurrently; a quantity that
could go negative; a record that can reach an impossible state; and anything that
changes money without an auditable history. Name the sequence of events that breaks it.`,
  },
  {
    id: "reliability",
    label: "Reliability",
    triggeredBy: ["QUEUE", "PAYMENTS", "LLM", "VIDEO_GEN", "IMAGE_GEN", "EMAIL", "WORKFLOW_ENGINE"],
    minTier: 3,
    sections: ["architecture", "capabilities", "implications", "nonFunctional"],
    brief: `You review what happens when things fail. For every external dependency and every
piece of background work, ask: what if it is slow, down, or returns an error? What if
the same message arrives twice? What if it half-completes? Findings must name the
dependency and the undefined behaviour.`,
  },
  {
    id: "cost",
    label: "Cost",
    triggeredBy: ["LLM", "VIDEO_GEN", "IMAGE_GEN", "AUDIO_GEN", "VECTOR_SEARCH"],
    minTier: 2,
    sections: ["architecture", "capabilities", "constraints", "requirements"],
    brief: `You review what this costs to run. Look for: per-request costs that scale with usage
but nothing that caps them; expensive work done eagerly that could be done on demand;
data kept forever with no retention rule; and any way one user could spend a
disproportionate amount. Be concrete about which operation.`,
  },
  {
    id: "compliance",
    label: "Privacy & compliance",
    triggeredBy: ["PAYMENTS"],
    minTier: 3,
    sections: ["domain", "constraints", "actors", "invariants"],
    brief: `You review obligations that come from law rather than engineering. Look for: personal
or regulated data with no retention or deletion story; consent that is assumed rather
than recorded; money handling that implies licensing; and data crossing jurisdictions.
Do not invent obligations the brief gives no reason to expect.`,
  },
  {
    id: "ai",
    label: "AI/ML",
    triggeredBy: ["LLM", "VECTOR_SEARCH", "EMBEDDING", "VIDEO_GEN", "IMAGE_GEN"],
    minTier: 2,
    sections: ["architecture", "capabilities", "requirements", "implications"],
    brief: `You review the use of models. Look for: model output treated as trustworthy without
review or citation; no defined behaviour when the model is wrong or unavailable;
retrieval that ignores who is allowed to see what; prompt or context built from
untrusted input; and evaluation that does not exist. Be specific about which step.`,
  },
  {
    id: "operations",
    label: "Operations",
    triggeredBy: ["QUEUE", "SCHEDULER", "WORKFLOW_ENGINE"],
    minTier: 3,
    sections: ["architecture", "capabilities", "nonFunctional"],
    brief: `You review whether this can be run. Look for: work that fails silently; no way to tell
whether the system is healthy; no alert on the things that matter; and manual steps with
no runbook. Findings must name what would go unnoticed.`,
  },
];

export interface CouncilSelection {
  disciplines: Discipline[];
  /** Why each was chosen — shown to the user so the review is not a black box. */
  reasons: Record<string, string>;
}

/**
 * Choose the reviewers. Pure function of the spec.
 *
 * A tier-0/1 project gets the two mandatory reviewers and nothing else: paying for
 * six specialist opinions on an eight-user internal tool would be the same
 * over-engineering this product exists to prevent.
 */
export function selectCouncil(doc: Uss, max = 6): CouncilSelection {
  const caps = new Set(capabilities(doc).map((c) => c.capabilityClass as CapabilityClass));
  const tier = doc.complexity.tier;
  const reasons: Record<string, string> = {};
  const chosen: Discipline[] = [];

  for (const d of DISCIPLINES) {
    if (d.always) {
      chosen.push(d);
      reasons[d.id] = "always reviewed";
      continue;
    }
    if (d.minTier !== undefined && tier < d.minTier) continue;

    const hit = d.triggeredBy?.find((c) => caps.has(c));
    if (hit) {
      chosen.push(d);
      reasons[d.id] = `the system uses ${hit}`;
    }
  }

  // Money and multi-tenancy pull in reviewers that capability alone may miss.
  const entities = domainEntities(doc);
  if (entities.some((e) => e.financial) && !chosen.some((d) => d.id === "data")) {
    const data = DISCIPLINES.find((d) => d.id === "data")!;
    chosen.push(data);
    reasons.data = "the system records money";
  }
  if (entities.some((e) => e.tenantScoped) && !chosen.some((d) => d.id === "security")) {
    const security = DISCIPLINES.find((d) => d.id === "security")!;
    chosen.push(security);
    reasons.security = "data belongs to separate customers";
  }

  return { disciplines: chosen.slice(0, max), reasons };
}

/** Context a reviewer needs, as sections rather than the whole spec. */
export function sectionsFor(discipline: Discipline): Section[] {
  return discipline.sections;
}

/**
 * The invariants a reviewer should specifically check are enforced. Passing these
 * explicitly is what turns "does this look secure?" into "show me what stops a
 * payment being recorded twice".
 */
export function invariantsFor(doc: Uss, discipline: Discipline): string[] {
  const relevant: Record<string, string[]> = {
    security: ["authorization", "privacy"],
    data: ["conservation", "consistency", "uniqueness", "lifecycle"],
    compliance: ["privacy", "financial"],
    reliability: ["uniqueness"],
  };
  const categories = relevant[discipline.id];
  if (!categories) return [];
  return invariants(doc)
    .filter((i) => categories.includes(i.category))
    .map((i) => i.statement);
}

/** Rough count of review calls a spec will cost, for the UI to warn about. */
export function estimateCouncilCalls(doc: Uss): number {
  // Each discipline is one call, plus one judge pass to reconcile them.
  return selectCouncil(doc).disciplines.length + 1;
}


/** Traceable summary of who reviewed and why. */
export function describeCouncil(selection: CouncilSelection): string {
  return selection.disciplines
    .map((d) => `${d.label} (${selection.reasons[d.id] ?? "selected"})`)
    .join(", ");
}

/** Everything the council needs to know about what the graph already proves. */
export function preReviewFindings(doc: Uss): string[] {
  const g = new UssGraph(doc);
  const out: string[] = [];

  // Give reviewers the deterministic findings so they do not spend their attention
  // rediscovering what a rule already knows, and can go deeper instead.
  for (const f of doc.integrity) {
    if (f.severity === "cosmetic") continue;
    out.push(`[${f.severity}] ${f.message}`);
  }

  // One predicate, shared with checkDomainIntegrity and render.ts. These three used
  // to disagree about the same invariant.
  const unenforced = g.byKind("component").length > 0 ? unenforcedInvariants(doc) : [];
  if (unenforced.length > 0) {
    out.push(
      `[blocking] ${unenforced.length} invariant(s) have no component enforcing them`
    );
  }

  const reqs = requirements(doc).length;
  if (reqs === 0) out.push("[blocking] no requirements have been established");

  return out;
}

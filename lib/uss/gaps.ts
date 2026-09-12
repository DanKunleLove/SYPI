import { getCapability } from "@/lib/capabilities/registry";
import { CAPABILITY_QUESTIONS } from "@/lib/capabilities/questions";
import { UssGraph } from "@/lib/uss/graph";
import { capabilitiesOverBudget } from "@/lib/uss/complexity";
import {
  actors,
  capabilities,
  components,
  constraints,
  nonFunctional,
  openDecisions,
  product,
  requirements,
  useCases,
} from "@/lib/uss/views";
import type { Entity, IntegrityFinding, Uss } from "@/lib/uss/schema";

/**
 * The deterministic layer: gap detection, integrity checks and completeness.
 *
 * ZERO LLM CALLS. This is what makes the core promise — "SYPI makes it hard to
 * forget something important" — available to every user rather than only to those
 * who bring an API key. A model may later reword these questions in the project's
 * own language, but it is not needed to FIND them.
 */

type OpenDecision = Extract<Entity, { kind: "openDecision" }>;
export type GapDraft = Omit<OpenDecision, "id" | "kind">;

// ─── Gap rules ───────────────────────────────────────────────────────────────

export interface GapRule {
  id: string;
  /** Tier-gated: a rule that does not apply at this tier must not fire. */
  appliesWhen: (doc: Uss) => boolean;
  detect: (doc: Uss) => GapDraft[];
}

const prov = (version: number) =>
  ({
    status: "INFERRED" as const,
    confidence: 0.8,
    evidence: [{ kind: "rule" as const }],
    firstSeenVersion: version,
  });

function draft(
  version: number,
  fields: {
    title: string;
    question: string;
    why: string;
    category: OpenDecision["category"];
    severity: OpenDecision["impact"]["severity"];
    affectsComponents?: string[];
    affectsRequirements?: string[];
    options?: OpenDecision["options"];
  }
): GapDraft {
  return {
    ...prov(version),
    title: fields.title,
    question: fields.question,
    why: fields.why,
    category: fields.category,
    options: fields.options ?? [],
    impact: {
      affectsComponents: fields.affectsComponents ?? [],
      affectsRequirements: fields.affectsRequirements ?? [],
      severity: fields.severity,
    },
  };
}

const always = () => true;
const atLeastTier = (n: number) => (doc: Uss) => doc.complexity.tier >= n;

export const GAP_RULES: GapRule[] = [
  // ── Capability-keyed ambiguity: the bulk of real senior questioning ────────
  {
    id: "capability-questions",
    appliesWhen: always,
    detect: (doc) => {
      const v = doc.complexity.firstSeenVersion;
      const g = new UssGraph(doc);
      const out: GapDraft[] = [];
      for (const cap of capabilities(doc)) {
        const questions = CAPABILITY_QUESTIONS[cap.capabilityClass] ?? [];
        // Components realizing this capability are what the answer would change.
        const affected = g.sources(cap.id, "realizes").map((c) => c.id);
        for (const q of questions) {
          out.push(
            draft(v, {
              title: q.title,
              question: q.question,
              why: q.why,
              category: q.category,
              severity: q.severity,
              affectsComponents: affected,
            })
          );
        }
      }
      return out;
    },
  },

  // ── Structural gaps ────────────────────────────────────────────────────────
  {
    id: "no-actors",
    appliesWhen: always,
    detect: (doc) =>
      actors(doc).length > 0
        ? []
        : [
            draft(doc.complexity.firstSeenVersion, {
              title: "Who uses this?",
              question: "Who are the different kinds of people or systems that will use this?",
              why: "Every permission, screen and boundary in the design follows from who the users are.",
              category: "actors",
              severity: "blocking",
            }),
          ],
  },
  {
    id: "actors-without-permissions",
    appliesWhen: atLeastTier(2),
    detect: (doc) => {
      const bare = actors(doc).filter((a) => a.isHuman && a.permissions.length === 0);
      if (bare.length < 2) return []; // one actor type needs no permission model
      return [
        draft(doc.complexity.firstSeenVersion, {
          title: "Who is allowed to do what?",
          question: `There are ${bare.length} kinds of user (${bare
            .map((a) => a.title)
            .join(", ")}). What can each of them see and do that the others cannot?`,
          why: "Without this, the design cannot enforce boundaries and users may reach each other's data.",
          category: "auth",
          severity: "blocking",
          affectsComponents: components(doc).map((c) => c.id),
        }),
      ];
    },
  },
  {
    id: "no-success-criteria",
    appliesWhen: always,
    detect: (doc) => {
      const p = product(doc);
      if (!p || p.successCriteria.length > 0) return [];
      return [
        draft(doc.complexity.firstSeenVersion, {
          title: "What does success look like?",
          question: "How will you know this is working? Name something you could actually check.",
          why: "Without a verifiable outcome there is no way to tell a finished system from an unfinished one.",
          category: "scope",
          severity: "material",
        }),
      ];
    },
  },
  {
    id: "no-out-of-scope",
    appliesWhen: always,
    detect: (doc) => {
      const p = product(doc);
      if (!p || p.outOfScope.length > 0) return [];
      return [
        draft(doc.complexity.firstSeenVersion, {
          title: "What are you deliberately NOT building?",
          question: "What is explicitly out of scope for the first version?",
          why: "Naming this stops the design — and whoever builds it — from quietly expanding.",
          category: "scope",
          severity: "material",
        }),
      ];
    },
  },
  {
    id: "data-without-retention",
    appliesWhen: atLeastTier(2),
    detect: (doc) => {
      const stores = capabilities(doc).filter((c) =>
        ["RELATIONAL_STORE", "DOCUMENT_STORE", "OBJECT_STORAGE"].includes(c.capabilityClass)
      );
      if (stores.length === 0) return [];
      if (constraints(doc).some((c) => c.category === "regulatory" || /retain|retention|delete/i.test(c.statement)))
        return [];
      return [
        draft(doc.complexity.firstSeenVersion, {
          title: "How long is data kept?",
          question: "How long should stored data be kept, and what happens when someone asks you to delete it?",
          why: "Retention drives storage cost, backup design and, where personal data is involved, legal exposure.",
          category: "data",
          severity: "material",
          affectsComponents: components(doc)
            .filter((c) => c.category === "database" || c.category === "storage")
            .map((c) => c.id),
        }),
      ];
    },
  },
  {
    id: "unverifiable-nfr",
    appliesWhen: atLeastTier(3),
    detect: (doc) => {
      const vague = nonFunctional(doc).filter((r) => !r.target);
      if (vague.length === 0) return [];
      return [
        draft(doc.complexity.firstSeenVersion, {
          title: "How fast, how reliable, how many?",
          question: `These are stated but not measurable: ${vague
            .map((r) => r.title)
            .slice(0, 3)
            .join(", ")}. What actual numbers should they hit?`,
          why: "An adjective cannot be tested. A number can.",
          category: "scale",
          severity: "material",
          affectsRequirements: vague.map((r) => r.id),
        }),
      ];
    },
  },
  {
    id: "external-dependency-failure",
    appliesWhen: atLeastTier(2),
    detect: (doc) => {
      const external = capabilities(doc).filter((c) => {
        const def = getCapability(c.capabilityClass);
        return def && ["PAYMENTS", "LLM", "VIDEO_GEN", "IMAGE_GEN", "EMAIL", "SMS", "AUDIO_GEN"].includes(def.id);
      });
      if (external.length === 0) return [];
      const g = new UssGraph(doc);
      return external.map((c) =>
        draft(doc.complexity.firstSeenVersion, {
          title: `What if ${c.title.toLowerCase()} fails?`,
          question: `${c.title} is provided by someone else. What should happen when it is slow, down, or rejects the request?`,
          why: "External services fail routinely. A design with no answer here fails with them.",
          category: "integration",
          severity: "material",
          affectsComponents: g.sources(c.id, "realizes").map((x) => x.id),
        })
      );
    },
  },
];

/** Run every applicable rule. Pure. */
export function detectGaps(doc: Uss): GapDraft[] {
  const out: GapDraft[] = [];
  for (const rule of GAP_RULES) {
    if (!rule.appliesWhen(doc)) continue;
    out.push(...rule.detect(doc));
  }
  // De-duplicate by question text — different rules can converge on one question.
  const seen = new Set<string>();
  return out.filter((d) => {
    const key = d.question.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Integrity checks ────────────────────────────────────────────────────────

/**
 * Computed claims about the graph that require trusting nothing the model said.
 * These double as benchmark scorers — one implementation, two uses.
 */
export function checkIntegrity(doc: Uss): IntegrityFinding[] {
  const g = new UssGraph(doc);
  const findings: IntegrityFinding[] = [];

  const orphans = g.orphanComponents();
  if (orphans.length > 0) {
    findings.push({
      rule: "orphan-component",
      severity: "material",
      message: `${orphans.length} component(s) exist without satisfying any requirement: ${orphans
        .map((o) => o.title)
        .join(", ")}`,
      subjects: orphans.map((o) => o.id),
    });
  }

  const unjustified = g.byKind("decision").filter((d) => g.from(d.id, "causedBy").length === 0);
  if (unjustified.length > 0) {
    findings.push({
      rule: "unjustified-decision",
      severity: "material",
      message: `${unjustified.length} decision(s) are not traced to a requirement or constraint`,
      subjects: unjustified.map((d) => d.id),
    });
  }

  const unrealized = capabilities(doc).filter((c) => g.to(c.id, "realizes").length === 0);
  if (unrealized.length > 0) {
    findings.push({
      rule: "unrealized-capability",
      severity: "blocking",
      message: `The design needs ${unrealized
        .map((c) => c.title)
        .join(", ")} but nothing provides it`,
      subjects: unrealized.map((c) => c.id),
    });
  }

  const overBudget = components(doc).length - doc.complexity.budget.maxComponents;
  if (overBudget > 0) {
    findings.push({
      rule: "budget-violation",
      severity: "blocking",
      message: `${components(doc).length} components for a tier-${doc.complexity.tier} system, ${overBudget} over the limit of ${doc.complexity.budget.maxComponents}`,
      subjects: [],
    });
  }

  const overTier = capabilitiesOverBudget(doc);
  if (overTier.length > 0) {
    findings.push({
      rule: "capability-over-tier",
      severity: "material",
      message: `Not justified at tier ${doc.complexity.tier}: ${overTier.join(", ")}`,
      subjects: [],
    });
  }

  const unverifiable = requirements(doc).filter((r) => r.acceptanceCriteria.length === 0);
  if (unverifiable.length > 0) {
    findings.push({
      rule: "unverifiable-requirement",
      severity: "material",
      message: `${unverifiable.length} requirement(s) have no acceptance criteria, so "done" is undefined`,
      subjects: unverifiable.map((r) => r.id),
    });
  }

  const idle = actors(doc).filter((a) => g.from(a.id, "actsOn").length === 0);
  if (idle.length > 0) {
    findings.push({
      rule: "idle-actor",
      severity: "cosmetic",
      message: `${idle.map((a) => a.title).join(", ")} — no use case describes what they do`,
      subjects: idle.map((a) => a.id),
    });
  }

  const orphanedComponents = components(doc).filter((c) => c.orphaned);
  if (orphanedComponents.length > 0) {
    findings.push({
      rule: "removed-but-depended-on",
      severity: "blocking",
      message: `${orphanedComponents
        .map((c) => c.title)
        .join(", ")} was removed from the canvas but requirements still depend on it`,
      subjects: orphanedComponents.map((c) => c.id),
    });
  }

  return findings;
}

// ─── Completeness ────────────────────────────────────────────────────────────

/**
 * Tier-weighted completeness.
 *
 * A tier-1 script that states its problem, its one actor and three requirements
 * should read 100 — not 30. A user must never be punished by this meter for
 * building something simple; that would make the whole rigor layer feel like an
 * accusation, which is the single likeliest way this feature fails.
 */
export function computeCompleteness(doc: Uss): number {
  const tier = doc.complexity.tier;
  const checks: { has: boolean; weight: number; appliesAtTier: number }[] = [
    { has: Boolean(product(doc)), weight: 3, appliesAtTier: 0 },
    { has: (product(doc)?.successCriteria.length ?? 0) > 0, weight: 2, appliesAtTier: 0 },
    { has: (product(doc)?.outOfScope.length ?? 0) > 0, weight: 1, appliesAtTier: 1 },
    { has: actors(doc).length > 0, weight: 3, appliesAtTier: 0 },
    { has: requirements(doc).length >= 3, weight: 3, appliesAtTier: 0 },
    { has: requirements(doc).some((r) => r.acceptanceCriteria.length > 0), weight: 2, appliesAtTier: 1 },
    { has: useCases(doc).length > 0, weight: 2, appliesAtTier: 2 },
    // Not tier 1: a small internal tool may genuinely have no constraints worth
    // recording, and demanding one would dock a simple project for being simple.
    { has: constraints(doc).length > 0, weight: 1, appliesAtTier: 2 },
    { has: capabilities(doc).length > 0, weight: 2, appliesAtTier: 1 },
    { has: components(doc).length > 0, weight: 3, appliesAtTier: 0 },
    { has: nonFunctional(doc).length > 0, weight: 2, appliesAtTier: 3 },
    { has: nonFunctional(doc).some((r) => Boolean(r.target)), weight: 2, appliesAtTier: 3 },
    { has: doc.complexity.status !== "UNKNOWN", weight: 1, appliesAtTier: 0 },
    { has: openDecisions(doc).every((d) => d.impact.severity !== "blocking"), weight: 2, appliesAtTier: 1 },
  ];

  const applicable = checks.filter((c) => tier >= c.appliesAtTier);
  const total = applicable.reduce((s, c) => s + c.weight, 0);
  if (total === 0) return 100;
  const earned = applicable.filter((c) => c.has).reduce((s, c) => s + c.weight, 0);
  return Math.round((earned / total) * 100);
}

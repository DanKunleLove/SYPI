import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { applyUserInstructions } from "@/lib/ai/index";
import {
  CAPABILITY_SYSTEM_PROMPT,
  COMPLEXITY_SYSTEM_PROMPT,
  INTENT_SYSTEM_PROMPT,
  REQUIREMENTS_SYSTEM_PROMPT,
} from "@/lib/ai/uss-prompts";
import { CAPABILITY_CLASSES } from "@/lib/capabilities/registry";
import { normaliseComplexity } from "@/lib/uss/complexity";
import { UssGraph } from "@/lib/uss/graph";
import { detectGaps, checkIntegrity, computeCompleteness } from "@/lib/uss/gaps";
import { IdAllocator } from "@/lib/uss/ids";
import { applyInvariants, checkDomainIntegrity, seedInvariants } from "@/lib/uss/domain";
import { scenarioFindings } from "@/lib/uss/scenarios";
import type { Uss } from "@/lib/uss/schema";

/**
 * The extraction passes: human intent → USS.
 *
 * Each pass emits a small FLAT draft schema — never the graph, never the whole
 * spec. Deterministic code assigns ids, builds relations and enforces provenance,
 * so the model is only ever asked for judgement, never for bookkeeping. That
 * division is what keeps structured output reliable and cost bounded.
 */

const statusEnum = z.enum(["KNOWN", "INFERRED", "ASSUMPTION", "UNKNOWN"]);

// ─── Pass 1: intent (cheap, runs on every path) ──────────────────────────────

const IntentDraft = z.object({
  productTitle: z.string().describe("Short name for what is being built"),
  problem: z.string().describe("The real problem, in the client's terms"),
  valueProposition: z.string().describe("Why it is worth building. One sentence."),
  inScope: z.array(z.string()).describe("What the first version includes"),
  outOfScope: z.array(z.string()).describe("What it deliberately does not include"),
  successCriteria: z.array(z.string()).describe("Verifiable outcomes, not adjectives"),
  productStatus: statusEnum,
  actors: z
    .array(
      z.object({
        name: z.string().describe("A role, not a person"),
        description: z.string(),
        isHuman: z.boolean(),
        permissions: z.array(z.string()).describe("What this role may do. Empty if unstated."),
        status: statusEnum,
      })
    )
    .describe("Every distinct kind of user or system"),
  constraints: z
    .array(
      z.object({
        category: z.enum([
          "budget", "deadline", "team", "stack", "regulatory", "data-residency", "integration", "other",
        ]),
        statement: z.string(),
        status: statusEnum,
      })
    )
    .describe("Only constraints the brief actually implies"),
  terms: z
    .array(z.object({ term: z.string(), definition: z.string() }))
    .describe("Domain words the client uses in a specific way"),
});

// ─── Pass 2: requirements (deeper; BYOK path) ────────────────────────────────

const RequirementsDraft = z.object({
  functional: z.array(
    z.object({
      title: z.string(),
      statement: z.string().describe("What the system must do. Verifiable."),
      acceptanceCriteria: z.array(z.string()).describe("The check that proves it works"),
      priority: z.enum(["must", "should", "could"]),
      status: statusEnum,
    })
  ),
  nonFunctional: z.array(
    z.object({
      title: z.string(),
      statement: z.string(),
      category: z.enum([
        "performance", "scalability", "reliability", "security",
        "privacy", "compliance", "cost", "operability", "accessibility",
      ]),
      target: z.string().describe("A measurable target, or the exact string UNKNOWN"),
      status: statusEnum,
    })
  ),
  useCases: z.array(
    z.object({
      title: z.string(),
      actorName: z.string().describe("Must match one of the actors"),
      trigger: z.string(),
      mainFlow: z.array(z.string()),
      postconditions: z.array(z.string()),
    })
  ),
});

// ─── Pass 3: complexity ──────────────────────────────────────────────────────

const ComplexityDraft = z.object({
  tier: z.number().describe("0 script, 1 tool, 2 app, 3 product, 4 platform, 5 mission-critical"),
  rationale: z.string(),
  signals: z.array(z.string()).describe("Concrete evidence from the brief"),
});

// ─── Pass 4: capabilities ────────────────────────────────────────────────────

const CapabilityDraft = z.object({
  capabilities: z.array(
    z.object({
      capabilityClass: z.enum(CAPABILITY_CLASSES),
      why: z.string().describe("Which requirement demands this"),
      satisfiesRequirementTitles: z
        .array(z.string())
        .describe("Titles of requirements needing it; must match exactly"),
    })
  ),
});

// ─── Pass runner ─────────────────────────────────────────────────────────────

interface PassContext {
  model: LanguageModel;
  brief: string;
  userInstructions?: string | null;
  version: number;
}

const prov = (status: z.infer<typeof statusEnum>, version: number, quote?: string) => ({
  status,
  confidence: status === "KNOWN" ? 0.95 : status === "INFERRED" ? 0.7 : status === "ASSUMPTION" ? 0.5 : 0.2,
  evidence: quote ? [{ kind: "brief" as const, quote: quote.slice(0, 400) }] : [],
  firstSeenVersion: version,
});

/** Populate product, actors, constraints and glossary. Cheap; runs on every path. */
export async function extractIntent(doc: Uss, ctx: PassContext): Promise<Uss> {
  const { object } = await generateObject({
    model: ctx.model,
    schema: IntentDraft,
    system: applyUserInstructions(INTENT_SYSTEM_PROMPT, ctx.userInstructions),
    prompt: ctx.brief,
  });

  const g = new UssGraph(doc);

  g.addUnique("product", {
    ...prov(object.productStatus, ctx.version, ctx.brief),
    title: object.productTitle,
    problem: object.problem,
    valueProposition: object.valueProposition,
    inScope: object.inScope,
    outOfScope: object.outOfScope,
    successCriteria: object.successCriteria,
  });

  for (const a of object.actors) {
    g.addUnique("actor", {
      ...prov(a.status, ctx.version),
      title: a.name,
      description: a.description,
      isHuman: a.isHuman,
      goals: [],
      permissions: a.permissions,
    });
  }

  for (const c of object.constraints) {
    g.addUnique("constraint", {
      ...prov(c.status, ctx.version),
      title: c.statement.slice(0, 120),
      category: c.category,
      statement: c.statement,
    });
  }

  for (const t of object.terms) {
    g.addUnique("term", {
      ...prov("KNOWN", ctx.version, t.term),
      title: t.term,
      definition: t.definition,
    });
  }

  return g.snapshot();
}

/** Populate requirements, NFRs and use cases, linking use cases to actors. */
export async function extractRequirements(doc: Uss, ctx: PassContext): Promise<Uss> {
  const { object } = await generateObject({
    model: ctx.model,
    schema: RequirementsDraft,
    system: applyUserInstructions(REQUIREMENTS_SYSTEM_PROMPT, ctx.userInstructions),
    prompt: ctx.brief,
  });

  const g = new UssGraph(doc);

  for (const r of object.functional) {
    g.addUnique("requirement", {
      ...prov(r.status, ctx.version),
      title: r.title,
      requirementKind: "functional",
      statement: r.statement,
      acceptanceCriteria: r.acceptanceCriteria,
      priority: r.priority,
    });
  }

  for (const r of object.nonFunctional) {
    const hasTarget = r.target && r.target.trim().toUpperCase() !== "UNKNOWN";
    g.addUnique("requirement", {
      ...prov(hasTarget ? r.status : "UNKNOWN", ctx.version),
      title: r.title,
      requirementKind: "non-functional",
      statement: r.statement,
      nfrCategory: r.category,
      // An unmeasurable target is recorded as absent, not as a vague string.
      ...(hasTarget ? { target: r.target } : {}),
      acceptanceCriteria: [],
      priority: "should",
    });
  }

  const actorsByName = new Map(
    g.byKind("actor").map((a) => [a.title.trim().toLowerCase(), a])
  );

  for (const u of object.useCases) {
    const uc = g.addUnique("useCase", {
      ...prov("INFERRED", ctx.version),
      title: u.title,
      trigger: u.trigger,
      mainFlow: u.mainFlow,
      alternateFlows: [],
      postconditions: u.postconditions,
    });
    const actor = actorsByName.get(u.actorName.trim().toLowerCase());
    if (actor) {
      g.link("actsOn", actor.id, uc.id, {
        status: "INFERRED",
        confidence: 0.8,
        evidence: [{ kind: "inference" }],
        firstSeenVersion: ctx.version,
      });
    }
  }

  return g.snapshot();
}

/** Classify the tier. The BUDGET is derived by code, never by the model. */
export async function classifyComplexity(doc: Uss, ctx: PassContext): Promise<Uss> {
  const { object } = await generateObject({
    model: ctx.model,
    schema: ComplexityDraft,
    system: COMPLEXITY_SYSTEM_PROMPT,
    prompt: ctx.brief,
  });

  return {
    ...doc,
    complexity: normaliseComplexity({
      ...doc.complexity,
      tier: object.tier,
      rationale: object.rationale,
      signals: object.signals,
      status: "INFERRED",
      confidence: 0.75,
      evidence: [{ kind: "inference" }],
    }),
  };
}

/** Identify capabilities and link them to the requirements that demand them. */
export async function extractCapabilities(doc: Uss, ctx: PassContext): Promise<Uss> {
  const g = new UssGraph(doc);
  const requirements = g.byKind("requirement");
  if (requirements.length === 0) return doc;

  const { object } = await generateObject({
    model: ctx.model,
    schema: CapabilityDraft,
    system: CAPABILITY_SYSTEM_PROMPT,
    prompt: `${ctx.brief}\n\nREQUIREMENTS:\n${requirements
      .map((r) => `- ${r.title}: ${r.statement}`)
      .join("\n")}`,
  });

  const byTitle = new Map(requirements.map((r) => [r.title.trim().toLowerCase(), r]));

  for (const c of object.capabilities) {
    const cap = g.addUnique("capability", {
      ...prov("INFERRED", ctx.version),
      title: c.capabilityClass,
      capabilityClass: c.capabilityClass,
      why: c.why,
    });
    for (const title of c.satisfiesRequirementTitles) {
      const req = byTitle.get(title.trim().toLowerCase());
      if (req) {
        g.link("requires", req.id, cap.id, {
          status: "INFERRED",
          confidence: 0.8,
          evidence: [{ kind: "inference" }],
          firstSeenVersion: ctx.version,
        });
      }
    }
  }

  return g.snapshot();
}

// ─── Unit 3: the domain model ────────────────────────────────────────────────

const DomainDraft = z.object({
  entities: z.array(
    z.object({
      name: z.string().describe("Singular noun the business would use, e.g. Order"),
      description: z.string(),
      keyAttributes: z.array(z.string()).describe("Only what matters to the business"),
      tenantScoped: z.boolean().describe("Does this belong to one customer organisation?"),
      financial: z.boolean().describe("Does it record money moving?"),
      /** Empty when the entity has no meaningful lifecycle. */
      states: z.array(z.string()).describe("Named states, in order. Empty if it has none."),
      transitions: z.array(
        z.object({
          from: z.string(),
          to: z.string(),
          trigger: z.string(),
          guard: z.string().describe("What must be true. Empty string if nothing."),
        })
      ).describe("ONLY legal moves. Omitting an illegal move is how it is forbidden."),
    })
  ),
});

export const DOMAIN_SYSTEM_PROMPT = `
You model the BUSINESS behind a system: the things it keeps track of, and how they
change over time. Not the software components — the real-world things a person at
this business would name.

For a marketplace that is Order, Product, Inventory, Payment, Shipment. Not
"Order Service". The service manages the Order; the Order is what matters here.

For each entity:
- Only attributes the business cares about. Not database columns.
- tenantScoped: true if it belongs to one specific customer organisation.
- financial: true if it records money moving.
- States: only where the thing genuinely moves through stages. A Product usually
  does not. An Order does.
- Transitions: list ONLY the legal ones. A move you do not list is forbidden, which
  is exactly how "a cancelled order cannot ship" gets enforced. Give a guard where
  something must be true first — especially before money moves or value is granted.

Stay inside what the requirements support. Do not invent entities for features
nobody asked for.
`.trim();

/** Extract the domain model: entities, their lifecycles, and legal transitions. */
export async function extractDomain(doc: Uss, ctx: PassContext): Promise<Uss> {
  const g0 = new UssGraph(doc);
  const reqs = g0.byKind("requirement");
  if (reqs.length === 0) return doc;

  const { object } = await generateObject({
    model: ctx.model,
    schema: DomainDraft,
    system: applyUserInstructions(DOMAIN_SYSTEM_PROMPT, ctx.userInstructions),
    prompt: `${ctx.brief}\n\nREQUIREMENTS:\n${reqs
      .map((r) => `- ${r.title}: ${r.statement}`)
      .join("\n")}`,
  });

  const g = new UssGraph(doc);

  for (const e of object.entities) {
    const entity = g.addUnique("domainEntity", {
      ...prov("INFERRED", ctx.version),
      title: e.name,
      description: e.description,
      keyAttributes: e.keyAttributes.slice(0, 12),
      tenantScoped: e.tenantScoped,
      financial: e.financial,
    });

    // A single state is not a lifecycle; ignore it rather than record noise.
    if (e.states.length < 2) continue;

    for (const [i, name] of e.states.entries()) {
      const state = g.addUnique("state", {
        ...prov("INFERRED", ctx.version),
        title: `${e.name}: ${name}`,
        entityTitle: e.name,
        isInitial: i === 0,
        // Terminal = nothing legal leaves it.
        isTerminal: !e.transitions.some((t) => t.from === name),
      });
      g.link("partOf", state.id, entity.id, {
        status: "INFERRED",
        confidence: 0.8,
        evidence: [{ kind: "inference" }],
        firstSeenVersion: ctx.version,
      });
    }

    for (const t of e.transitions) {
      const transition = g.addUnique("transition", {
        ...prov("INFERRED", ctx.version),
        title: `${e.name}: ${t.from} → ${t.to}`,
        entityTitle: e.name,
        from: t.from,
        to: t.to,
        trigger: t.trigger,
        guard: t.guard,
      });
      g.link("partOf", transition.id, entity.id, {
        status: "INFERRED",
        confidence: 0.8,
        evidence: [{ kind: "inference" }],
        firstSeenVersion: ctx.version,
      });
    }
  }

  return g.snapshot();
}

/**
 * Merge rule-detected gaps into the spec as openDecisions, skipping any question
 * already present or already answered. Deterministic — no model involved.
 */
export function mergeGaps(doc: Uss): Uss {
  const g = new UssGraph(doc);
  const existing = new Set(
    g.byKind("openDecision").map((d) => d.question.trim().toLowerCase())
  );

  for (const gap of detectGaps(doc)) {
    if (existing.has(gap.question.trim().toLowerCase())) continue;
    existing.add(gap.question.trim().toLowerCase());
    g.add("openDecision", gap);
  }
  return g.snapshot();
}

/**
 * Recompute everything derived. Call after any mutation, before committing:
 * integrity findings and completeness must never be stale, because the UI and the
 * benchmark both read them as current truth.
 */
export function finalise(doc: Uss): Uss {
  // Seed the invariant catalogue before checking integrity, so a rule the system
  // must never violate is present to be checked rather than absent and unnoticed.
  const withInvariants = applyInvariants(
    doc,
    seedInvariants(doc),
    doc.complexity.firstSeenVersion
  );
  const withGaps = mergeGaps(withInvariants);
  return {
    ...withGaps,
    integrity: [
      ...checkIntegrity(withGaps),
      ...checkDomainIntegrity(withGaps),
      // Scenario gaps are findings like any other, so they reach the health bar,
      // the council and the Kit without a separate surface.
      ...scenarioFindings(withGaps),
    ],
    meta: {
      ...withGaps.meta,
      completeness: computeCompleteness(withGaps),
      lastExtractedAt: new Date().toISOString(),
    },
  };
}

/** Unused import guard — IdAllocator is re-exported for callers building drafts. */
export { IdAllocator };

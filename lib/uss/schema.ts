import { z } from "zod";
import { nodeCategoryEnum } from "@/lib/ai/schemas";
import { CAPABILITY_CLASSES } from "@/lib/capabilities/registry";

/**
 * The Universal System Specification — SYPI's canonical semantic representation.
 *
 * It is a TYPED ENTITY GRAPH, not a document with sections. `product`,
 * `requirements`, `architecture` and the rest are VIEWS computed over
 * `entities` (see views.ts), never stored shapes. That is what makes later units
 * additive: adding `kind: "invariant"` in the domain unit extends one union and
 * touches no storage, no migration and no existing view.
 *
 * ─── Two rules that must not be broken ──────────────────────────────────────
 *
 * 1. THIS SCHEMA IS NEVER HANDED TO A MODEL. It is a storage and validation
 *    contract. Extraction passes emit small, flat DRAFT schemas and deterministic
 *    code assembles the graph from them. Passing a 12-kind discriminated union
 *    to generateObject would produce uniform hallucination across every kind and
 *    multiply cost — the failure mode this design exists to avoid.
 *
 * 2. NOTHING BECOMES A FACT WITHOUT EVIDENCE. Every entity and every relation
 *    carries a status, a confidence and its evidence. `KNOWN` with no evidence is
 *    downgraded at write time (see store.ts), so a model cannot assert its way to
 *    certainty.
 */

export const USS_VERSION = 1;

// ─── Provenance ──────────────────────────────────────────────────────────────

/**
 * KNOWN       stated by the user, or directly observed (a URL fingerprint, a canvas node)
 * INFERRED    derived by a model or a rule; carries a confidence
 * ASSUMPTION  a provisional default taken to keep moving; MUST surface in outputs
 * UNKNOWN     an acknowledged gap; MUST NOT be silently resolved
 */
export const epistemicStatusEnum = z.enum([
  "KNOWN",
  "INFERRED",
  "ASSUMPTION",
  "UNKNOWN",
]);
export type EpistemicStatus = z.infer<typeof epistemicStatusEnum>;

export const evidenceKindEnum = z.enum([
  "user-statement",
  "brief",
  "url",
  "canvas",
  "answer",
  "rule",
  "inference",
  "default",
]);

export const EvidenceSchema = z.object({
  kind: evidenceKindEnum,
  /** Where it came from: a URL, a message id, a canvas node id. */
  ref: z.string().max(300).optional(),
  /** Verbatim snippet. This is what makes a claim auditable rather than asserted. */
  quote: z.string().max(400).optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/** Mixed into every entity and every relation. */
const provenance = {
  status: epistemicStatusEnum,
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema).max(4).default([]),
  /** Spec version this first appeared in — lets the UI show what a turn changed. */
  firstSeenVersion: z.number().int().min(1),
};

// ─── Entities ────────────────────────────────────────────────────────────────

export const entityKindEnum = z.enum([
  "product",
  "actor",
  "requirement",
  "constraint",
  "assumption",
  "unknown",
  "useCase",
  "capability",
  "component",
  "decision",
  "openDecision",
  "term",
  "implication",
  "tradeoff",
  "domainEntity",
  "invariant",
  "state",
  "transition",
  "workflow",
]);
export type EntityKind = z.infer<typeof entityKindEnum>;

const idField = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[A-Z]{2,4}-[A-Za-z0-9-]{1,54}$/, "ids look like REQ-001 or CAP-video-gen");

const base = {
  id: idField,
  /** Short human label. Every entity has one so any view can render a list. */
  title: z.string().min(1).max(160),
  ...provenance,
};

export const ProductEntity = z.object({
  ...base,
  kind: z.literal("product"),
  problem: z.string().max(1200),
  valueProposition: z.string().max(600).default(""),
  inScope: z.array(z.string().max(200)).max(20).default([]),
  outOfScope: z.array(z.string().max(200)).max(20).default([]),
  successCriteria: z.array(z.string().max(240)).max(12).default([]),
});

export const ActorEntity = z.object({
  ...base,
  kind: z.literal("actor"),
  description: z.string().max(600).default(""),
  isHuman: z.boolean().default(true),
  goals: z.array(z.string().max(200)).max(10).default([]),
  /** What this actor may do. Absence of this is itself a finding. */
  permissions: z.array(z.string().max(200)).max(12).default([]),
});

export const requirementKindEnum = z.enum(["functional", "non-functional"]);
export const nfrCategoryEnum = z.enum([
  "performance",
  "scalability",
  "reliability",
  "security",
  "privacy",
  "compliance",
  "cost",
  "operability",
  "accessibility",
]);

export const RequirementEntity = z.object({
  ...base,
  kind: z.literal("requirement"),
  requirementKind: requirementKindEnum,
  statement: z.string().max(600),
  /** Only meaningful for non-functional requirements. */
  nfrCategory: nfrCategoryEnum.optional(),
  /** A measurable target ("p95 < 300ms", "99.9% monthly"). Unbounded NFRs are flagged. */
  target: z.string().max(200).optional(),
  acceptanceCriteria: z.array(z.string().max(240)).max(8).default([]),
  priority: z.enum(["must", "should", "could"]).default("should"),
});

export const ConstraintEntity = z.object({
  ...base,
  kind: z.literal("constraint"),
  category: z.enum([
    "budget",
    "deadline",
    "team",
    "stack",
    "regulatory",
    "data-residency",
    "integration",
    "other",
  ]),
  statement: z.string().max(600),
});

export const AssumptionEntity = z.object({
  ...base,
  kind: z.literal("assumption"),
  statement: z.string().max(600),
  /** What breaks if this turns out to be wrong. An assumption without this is a guess. */
  ifWrong: z.string().max(400).default(""),
});

export const UnknownEntity = z.object({
  ...base,
  kind: z.literal("unknown"),
  question: z.string().max(400),
  why: z.string().max(400).default(""),
});

export const UseCaseEntity = z.object({
  ...base,
  kind: z.literal("useCase"),
  trigger: z.string().max(300).default(""),
  mainFlow: z.array(z.string().max(240)).max(15).default([]),
  alternateFlows: z.array(z.string().max(240)).max(10).default([]),
  postconditions: z.array(z.string().max(240)).max(8).default([]),
});

export const CapabilityEntity = z.object({
  ...base,
  kind: z.literal("capability"),
  capabilityClass: z.enum(CAPABILITY_CLASSES),
  /** Why this system needs it — traced to requirements via `requires` relations. */
  why: z.string().max(400).default(""),
});

export const ComponentEntity = z.object({
  ...base,
  kind: z.literal("component"),
  /** Same vocabulary as the canvas, so projection is lossless for software. */
  category: nodeCategoryEnum,
  responsibility: z.string().max(600).default(""),
  technology: z.string().max(120).optional(),
  /** Set when this component is mirrored by a node on the canvas. */
  canvasNodeId: z.string().max(80).optional(),
  /**
   * True when the canvas node was deleted but requirements still depend on it.
   * Orphaned components are never deleted silently — they raise a blocking
   * decision instead, which is where this design earns its keep.
   */
  orphaned: z.boolean().default(false),
});

export const DecisionEntity = z.object({
  ...base,
  kind: z.literal("decision"),
  choice: z.string().max(300),
  rationale: z.string().max(800).default(""),
  /**
   * At least one rejected alternative is REQUIRED. A "decision" with nothing
   * rejected is a default, and defaults belong in assumptions.
   */
  alternatives: z
    .array(
      z.object({
        option: z.string().max(160),
        rejectedBecause: z.string().max(400),
      })
    )
    .min(1)
    .max(5),
  reversibility: z.enum(["one-way", "costly", "cheap"]).default("cheap"),
  /** What would make us revisit this. */
  revisitTriggers: z.array(z.string().max(200)).max(5).default([]),
  /** Supersedes an earlier decision — decisions are append-only. */
  supersedes: idField.optional(),
});

export const openDecisionCategoryEnum = z.enum([
  "scope",
  "actors",
  "data",
  "auth",
  "integration",
  "scale",
  "compliance",
  "budget",
  "stack",
  "operations",
]);

export const OpenDecisionEntity = z.object({
  ...base,
  kind: z.literal("openDecision"),
  /** Asked in plain language. No jargon — a founder must be able to answer it. */
  question: z.string().max(300),
  /** What breaks if it stays unanswered. */
  why: z.string().max(300).default(""),
  category: openDecisionCategoryEnum,
  options: z
    .array(
      z.object({
        label: z.string().max(100),
        implication: z.string().max(240),
        isDefault: z.boolean().default(false),
      })
    )
    .max(4)
    .default([]),
  impact: z.object({
    affectsComponents: z.array(idField).max(20).default([]),
    affectsRequirements: z.array(idField).max(20).default([]),
    severity: z.enum(["blocking", "material", "cosmetic"]),
  }),
  resolvedAt: z.string().optional(),
  resolution: z.string().max(600).optional(),
});

export const TermEntity = z.object({
  ...base,
  kind: z.literal("term"),
  definition: z.string().max(600),
});

/**
 * The missing link between "what the client asked for" and "what the system needs".
 *
 * "Users upload 2GB videos" does not imply S3. It implies: uploads exceed a single
 * request, therefore resumable multipart upload; processing exceeds a request
 * timeout, therefore async work with job state; users need to know it is working,
 * therefore progress reporting; any of it can fail, therefore recovery. THOSE imply
 * object storage and a queue. Technology is the last step, never the first.
 */
export const ImplicationEntity = z.object({
  ...base,
  kind: z.literal("implication"),
  statement: z.string().max(500),
  /** What in the requirements triggered it — shown in the "why" trace. */
  trigger: z.string().max(300).default(""),
  /**
   * A rule-derived implication is reproducible and free; a model-derived one is
   * neither. Tracking which is which is how we measure whether the rulebook is
   * carrying its weight rather than the model quietly doing all the work.
   */
  source: z.enum(["rule", "model"]),
  /** Capability classes this implication demands. Validated against the registry. */
  demands: z.array(z.string().max(40)).max(6).default([]),
});

export const TradeoffEntity = z.object({
  ...base,
  kind: z.literal("tradeoff"),
  statement: z.string().max(400),
  gains: z.array(z.string().max(200)).max(5).default([]),
  costs: z.array(z.string().max(200)).max(5).default([]),
});

// ─── Unit 3: the business ────────────────────────────────────────────────────

/**
 * A thing the business actually has: an Order, a Tenant, a Lease, a Shot.
 *
 * Distinct from a component. "Order Service" is a component; "Order" is the thing
 * it manages. Conflating them is why generated designs can look complete while
 * implementing nothing the client recognises.
 */
export const DomainEntityEntity = z.object({
  ...base,
  kind: z.literal("domainEntity"),
  description: z.string().max(500).default(""),
  /** Attributes that matter to the business, not a full column list. */
  keyAttributes: z.array(z.string().max(120)).max(12).default([]),
  /** True when this entity is scoped to a tenant/organisation. */
  tenantScoped: z.boolean().default(false),
  /** True when it records money movement — triggers stricter checks. */
  financial: z.boolean().default(false),
});

/**
 * A rule the system must never violate.
 *
 * "An order cannot be paid twice." "Inventory cannot go negative." "A user cannot
 * read another tenant's data." These are laws, not preferences — the architecture,
 * the implementation and the tests all derive from them, and Unit 5 tests scenarios
 * against them.
 */
export const InvariantEntity = z.object({
  ...base,
  kind: z.literal("invariant"),
  statement: z.string().max(400),
  category: z.enum([
    "uniqueness",
    "conservation", // a quantity must not go negative or be created from nothing
    "authorization",
    "lifecycle",
    "consistency",
    "privacy",
    "financial",
  ]),
  /** How it is enforced. Absence of an answer is itself the finding. */
  enforcement: z.string().max(300).default(""),
  /** What goes wrong when it is violated — makes severity concrete. */
  violationConsequence: z.string().max(300).default(""),
  severity: z.enum(["critical", "important"]).default("critical"),
});

/** A named state in an entity's lifecycle. */
export const StateEntity = z.object({
  ...base,
  kind: z.literal("state"),
  /** Which domain entity this state belongs to. */
  entityTitle: z.string().max(120),
  isInitial: z.boolean().default(false),
  isTerminal: z.boolean().default(false),
});

/**
 * A LEGAL transition. Transitions not listed are illegal by construction, which
 * is the point: "cancelled → shipped" should be absent, not merely discouraged.
 */
export const TransitionEntity = z.object({
  ...base,
  kind: z.literal("transition"),
  entityTitle: z.string().max(120),
  from: z.string().max(80),
  to: z.string().max(80),
  trigger: z.string().max(200).default(""),
  /** Conditions that must hold. An unguarded money transition is a finding. */
  guard: z.string().max(200).default(""),
});

export const WorkflowEntity = z.object({
  ...base,
  kind: z.literal("workflow"),
  description: z.string().max(400).default(""),
  steps: z.array(z.string().max(200)).max(15).default([]),
  /** What happens when a step fails. Silence here is how automations rot. */
  failureHandling: z.string().max(300).default(""),
});

/**
 * Adding a kind here is the ONLY change a future unit needs to introduce a new
 * concept. Envelope, storage, migration and existing views stay untouched.
 *   domain unit → domainEntity, invariant, workflow, state, transition, dataStore, api, event
 *   council     → finding, discipline
 *   validation  → scenario, failureMode, slo
 *   providers   → provider, providerBinding
 *   execution   → task, milestone, acceptanceTest
 */
export const EntitySchema = z.discriminatedUnion("kind", [
  ProductEntity,
  ActorEntity,
  RequirementEntity,
  ConstraintEntity,
  AssumptionEntity,
  UnknownEntity,
  UseCaseEntity,
  CapabilityEntity,
  ComponentEntity,
  DecisionEntity,
  OpenDecisionEntity,
  TermEntity,
  ImplicationEntity,
  TradeoffEntity,
  DomainEntityEntity,
  InvariantEntity,
  StateEntity,
  TransitionEntity,
  WorkflowEntity,
]);
export type Entity = z.infer<typeof EntitySchema>;

// ─── Relations ───────────────────────────────────────────────────────────────

/**
 * Typed edges. These are what make "why does this component exist?" a graph
 * traversal instead of a guess, and what let the integrity checks find an
 * unjustified component deterministically and for free.
 */
export const relationTypeEnum = z.enum([
  "actsOn", // actor    → useCase
  "requires", // requirement | implication → capability
  "satisfies", // component → requirement     ← absence of this is an orphan
  "realizes", // component → capability
  "dependsOn", // component → component       ← this is the canvas edge
  "causedBy", // decision  → requirement | constraint
  "decides", // decision  → component | capability
  "assumes", // decision  → assumption
  "blocks", // openDecision → any
  "constrains", // constraint → any
  "implies", // requirement | constraint → implication
  "governs", // invariant → domainEntity | workflow | component
  "manages", // component → domainEntity
  "transitions", // transition → state
  "partOf", // state | transition → domainEntity
]);
export type RelationType = z.infer<typeof relationTypeEnum>;

export const RelationSchema = z.object({
  id: z.string().min(2).max(80),
  type: relationTypeEnum,
  from: idField,
  to: idField,
  note: z.string().max(200).optional(),
  ...provenance,
});
export type Relation = z.infer<typeof RelationSchema>;

// ─── Complexity ──────────────────────────────────────────────────────────────

export const complexityLabelEnum = z.enum([
  "script",
  "tool",
  "app",
  "product",
  "platform",
  "mission-critical",
]);

/**
 * Derived from the tier by code, never chosen by a model. Injected into
 * generation prompts as hard prohibitions, which is what stops a tier-1 internal
 * tool shipping with a message bus.
 */
export const BudgetSchema = z.object({
  maxComponents: z.number().int().min(1).max(60),
  allowAsyncMessaging: z.boolean(),
  allowCaching: z.boolean(),
  allowServiceDecomposition: z.boolean(),
  allowMultiRegion: z.boolean(),
  requiresFormalNfrs: z.boolean(),
  /** Highest capability tierFloor permitted at this tier. */
  maxCapabilityTier: z.number().int().min(0).max(5),
});
export type Budget = z.infer<typeof BudgetSchema>;

export const ComplexitySchema = z.object({
  tier: z.number().int().min(0).max(5),
  label: complexityLabelEnum,
  rationale: z.string().max(600).default(""),
  /** What drove the classification — shown to the user, so it must be concrete. */
  signals: z.array(z.string().max(160)).max(8).default([]),
  budget: BudgetSchema,
  ...provenance,
});
export type Complexity = z.infer<typeof ComplexitySchema>;

// ─── Integrity findings ──────────────────────────────────────────────────────

export const integritySeverityEnum = z.enum(["blocking", "material", "cosmetic"]);

/**
 * Computed by integrity.ts. NEVER model-authored — that is the point: these are
 * the claims we can make without trusting anything the model said.
 */
export const IntegrityFindingSchema = z.object({
  rule: z.string().max(60),
  severity: integritySeverityEnum,
  message: z.string().max(400),
  /** Entities or relations the finding is about. */
  subjects: z.array(z.string().max(80)).max(20).default([]),
});
export type IntegrityFinding = z.infer<typeof IntegrityFindingSchema>;

// ─── Envelope ────────────────────────────────────────────────────────────────

export const ussDomainEnum = z.enum([
  "software",
  "automation",
  "video",
  "image",
  "music",
  "writing",
  "marketing",
  "business",
]);

/** What the user is doing. Greenfield design is only one of these. */
export const ussModeEnum = z.enum([
  "build",
  "analyze",
  "improve",
  "migrate",
  "integrate",
  "replicate",
  "audit",
  "plan",
]);

export const MetaSchema = z.object({
  /** Tier-weighted, computed by gaps.ts. A simple project can honestly reach 100. */
  completeness: z.number().int().min(0).max(100).default(0),
  sourceKinds: z.array(evidenceKindEnum).max(8).default([]),
  lastExtractedAt: z.string().optional(),
});

export const UssSchema = z
  .object({
    ussVersion: z.literal(USS_VERSION),
    specId: z.string().min(1).max(60),
    projectId: z.string().min(1).max(60),
    domain: ussDomainEnum.default("software"),
    mode: ussModeEnum.default("build"),
    complexity: ComplexitySchema,
    /**
     * An ARRAY, not a keyed record. Deliberate: it keeps insertion order (so
     * versions diff readably), avoids `additionalProperties` in the derived JSON
     * Schema, and graph.ts builds the id→entity Map at load. Uniqueness is
     * enforced below rather than by the container type.
     */
    entities: z.array(EntitySchema).max(2000).default([]),
    relations: z.array(RelationSchema).max(4000).default([]),
    integrity: z.array(IntegrityFindingSchema).max(200).default([]),
    meta: MetaSchema,
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    for (const e of doc.entities) {
      if (ids.has(e.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate entity id "${e.id}"`,
          path: ["entities"],
        });
      }
      ids.add(e.id);
    }
    // Referential integrity. A relation pointing at nothing is a corrupt graph,
    // not a finding to report — so it is rejected here rather than written.
    for (const r of doc.relations) {
      if (!ids.has(r.from) || !ids.has(r.to)) {
        ctx.addIssue({
          code: "custom",
          message: `Relation ${r.id} (${r.type}) references a missing entity: ${
            !ids.has(r.from) ? r.from : r.to
          }`,
          path: ["relations"],
        });
      }
    }
  });

export type Uss = z.infer<typeof UssSchema>;

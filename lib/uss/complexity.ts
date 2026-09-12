import { getCapability } from "@/lib/capabilities/registry";
import type { Budget, Complexity, Uss } from "@/lib/uss/schema";

/**
 * Complexity tier → budget.
 *
 * A model may CLASSIFY the tier. It may not negotiate the budget: `deriveBudget`
 * is pure code, and every write overwrites whatever the model proposed. The
 * budget is then injected into generation prompts as explicit prohibitions.
 *
 * This is the mechanism that answers the single most common failure in the
 * baseline: an 8-user internal tool arriving with a cache layer, or a marketplace
 * arriving with 26 components against a budget of 18.
 */

export const TIER_LABELS = [
  "script",
  "tool",
  "app",
  "product",
  "platform",
  "mission-critical",
] as const;

export type TierLabel = (typeof TIER_LABELS)[number];

export interface TierDef {
  tier: number;
  label: TierLabel;
  description: string;
  /** Rough shape of what belongs at this tier — used in prompts. */
  guidance: string;
}

export const TIERS: TierDef[] = [
  {
    tier: 0,
    label: "script",
    description: "One process, one job, run by its author.",
    guidance: "A single program plus whatever it reads and writes. No services, no infrastructure.",
  },
  {
    tier: 1,
    label: "tool",
    description: "A small application for a known, small group of people.",
    guidance:
      "An interface, an application, a database. Authentication because it is not public. Nothing else unless the requirements demand it.",
  },
  {
    tier: 2,
    label: "app",
    description: "A real product with external users and money or data at stake.",
    guidance:
      "Add file storage, background work and observability as requirements justify. Still one application, not a fleet of services.",
  },
  {
    tier: 3,
    label: "product",
    description: "Multi-tenant, growing, with meaningful availability expectations.",
    guidance:
      "Caching, asynchronous processing and clear boundaries between concerns become justifiable. Decomposition still needs a reason.",
  },
  {
    tier: 4,
    label: "platform",
    description: "Significant scale, several teams, or regulated data.",
    guidance:
      "Service decomposition, event streaming and read replicas are on the table where a requirement demands them.",
  },
  {
    tier: 5,
    label: "mission-critical",
    description: "Failure causes serious harm: financial, legal, or physical.",
    guidance:
      "Redundancy, multi-region, formal SLOs, explicit threat modelling and audited data handling are mandatory rather than optional.",
  },
];

/** Pure function. The single source of truth for what a tier permits. */
export function deriveBudget(tier: number): Budget {
  const t = Math.max(0, Math.min(5, Math.round(tier)));
  const byTier: Budget[] = [
    // 0 — script
    { maxComponents: 3, allowAsyncMessaging: false, allowCaching: false, allowServiceDecomposition: false, allowMultiRegion: false, requiresFormalNfrs: false, maxCapabilityTier: 0 },
    // 1 — tool
    { maxComponents: 6, allowAsyncMessaging: false, allowCaching: false, allowServiceDecomposition: false, allowMultiRegion: false, requiresFormalNfrs: false, maxCapabilityTier: 1 },
    // 2 — app
    { maxComponents: 10, allowAsyncMessaging: true, allowCaching: false, allowServiceDecomposition: false, allowMultiRegion: false, requiresFormalNfrs: false, maxCapabilityTier: 2 },
    // 3 — product
    { maxComponents: 16, allowAsyncMessaging: true, allowCaching: true, allowServiceDecomposition: false, allowMultiRegion: false, requiresFormalNfrs: true, maxCapabilityTier: 3 },
    // 4 — platform
    { maxComponents: 24, allowAsyncMessaging: true, allowCaching: true, allowServiceDecomposition: true, allowMultiRegion: false, requiresFormalNfrs: true, maxCapabilityTier: 4 },
    // 5 — mission-critical
    { maxComponents: 40, allowAsyncMessaging: true, allowCaching: true, allowServiceDecomposition: true, allowMultiRegion: true, requiresFormalNfrs: true, maxCapabilityTier: 5 },
  ];
  return byTier[t];
}

export function tierLabel(tier: number): TierLabel {
  return TIER_LABELS[Math.max(0, Math.min(5, Math.round(tier)))];
}

export function tierDef(tier: number): TierDef {
  return TIERS[Math.max(0, Math.min(5, Math.round(tier)))];
}

/**
 * Normalise a model-proposed complexity: clamp the tier, force the label to match
 * it, and OVERWRITE the budget with the derived one. Call this on every write.
 */
export function normaliseComplexity(proposed: Complexity): Complexity {
  const tier = Math.max(0, Math.min(5, Math.round(proposed.tier)));
  return {
    ...proposed,
    tier,
    label: tierLabel(tier),
    budget: deriveBudget(tier),
  };
}

/**
 * Render the budget as prohibitions for a prompt. Phrased as rules rather than
 * preferences, because "prefer simplicity" demonstrably does not work — the
 * baseline is full of designs that were told to keep it practical and did not.
 */
export function renderBudgetForPrompt(complexity: Complexity): string {
  const { tier, label, budget } = complexity;
  const def = tierDef(tier);
  const bans: string[] = [];

  if (!budget.allowAsyncMessaging) bans.push("message queues, event buses, pub/sub, or streaming");
  if (!budget.allowCaching) bans.push("a dedicated cache tier (Redis, Memcached, CDN caching)");
  if (!budget.allowServiceDecomposition) bans.push("splitting the system into multiple services or a service mesh");
  if (!budget.allowMultiRegion) bans.push("multi-region deployment, geo-replication, or cross-region failover");

  return [
    `COMPLEXITY BUDGET — tier ${tier} (${label}): ${def.description}`,
    def.guidance,
    `Hard limit: at most ${budget.maxComponents} components.`,
    // The benchmark caught a design meeting its budget by dropping authentication
    // and spending the slot on a read replica. The limit must bind OPTIONAL
    // infrastructure; it must never be satisfied by omitting something required.
    `The limit applies to OPTIONAL infrastructure — replicas, caches, extra services, ` +
      `nice-to-haves. NEVER meet this limit by omitting a component that a stated ` +
      `requirement or implication demands. If you cannot fit everything required, ` +
      `include what is required and drop the optional extras instead.`,
    bans.length
      ? `DO NOT include ${bans.join("; ")}. These are not justified at this tier, however standard they may seem.`
      : "All architectural patterns are available if a requirement justifies them.",
    budget.requiresFormalNfrs
      ? "Non-functional requirements must carry measurable targets, not adjectives."
      : "Keep non-functional requirements proportionate; do not invent SLOs nobody asked for.",
  ].join("\n");
}

/** Capabilities present in the spec that the tier does not justify. */
export function capabilitiesOverBudget(doc: Uss): string[] {
  const max = doc.complexity.budget.maxCapabilityTier;
  const over: string[] = [];
  for (const e of doc.entities) {
    if (e.kind !== "capability") continue;
    const def = getCapability(e.capabilityClass);
    if (def && def.tierFloor > max) over.push(e.capabilityClass);
  }
  return [...new Set(over)];
}

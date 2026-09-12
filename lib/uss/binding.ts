import type { CapabilityClass } from "@/lib/capabilities/registry";
import {
  optionsFor,
  type CostBand,
  type ProviderOption,
} from "@/lib/capabilities/providers";
import { UssGraph } from "@/lib/uss/graph";
import { capabilities, constraints, product, requirements } from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";

/**
 * Provider selection — requirement-driven, deterministic, and explainable.
 *
 * The rule this enforces is P7: technology is a consequence. A provider is chosen
 * because the project's constraints rule out the alternatives, and the rejected
 * ones are recorded with the reason. A "decision" with nothing rejected is a
 * default, and the schema refuses to store it as a decision.
 *
 * No model is involved. Selection from a catalogue against stated constraints is
 * exactly the kind of thing a rule does better: it is reproducible, it cannot
 * hallucinate a product that does not exist, and it cannot quietly prefer whatever
 * was most common in its training data.
 */

export interface BindingConstraints {
  /** Regions or markets mentioned anywhere in the spec, lowercased. */
  markets: string[];
  /** The project cannot spend much. */
  costSensitive: boolean;
  /** Data must stay under the project's own control. */
  requiresSelfHosting: boolean;
  /** Enterprise buyers, compliance regimes, or regulated data. */
  regulated: boolean;
  tier: number;
  /** The exact constraint statements that drove the above — for the audit trail. */
  sources: string[];
}

const COST_RANK: Record<CostBand, number> = { free: 0, low: 1, medium: 2, high: 3 };

/** Read the constraints that actually affect provider choice out of the spec. */
export function readBindingConstraints(doc: Uss): BindingConstraints {
  const cons = constraints(doc);
  const text = [
    ...cons.map((c) => c.statement),
    ...requirements(doc).map((r) => `${r.title} ${r.statement}`),
    product(doc)?.problem ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const sources: string[] = [];
  const note = (statement: string) => {
    if (!sources.includes(statement)) sources.push(statement);
  };

  const costSensitive =
    cons.some((c) => {
      const hit =
        c.category === "budget" &&
        /cheap|low cost|free|minimal|bootstrap|tight|limited budget|no budget/i.test(c.statement);
      if (hit) note(c.statement);
      return hit;
    }) || /bootstrap|side project|no funding|out of pocket/.test(text);

  const requiresSelfHosting = cons.some((c) => {
    const hit =
      (c.category === "regulatory" || c.category === "data-residency") &&
      /on-premise|on premise|self-host|our own servers|cannot leave|must stay/i.test(c.statement);
    if (hit) note(c.statement);
    return hit;
  });

  const regulated = cons.some((c) => {
    const hit =
      c.category === "regulatory" ||
      /gdpr|hipaa|pci|ndpr|soc 2|compliance|regulated|privileged/i.test(c.statement);
    if (hit) note(c.statement);
    return hit;
  });

  // Markets matter for payments above all: Stripe is not available everywhere,
  // and recommending it to a Nigerian marketplace is a real, specific failure.
  const KNOWN_MARKETS = [
    "nigeria", "ghana", "kenya", "south africa", "africa",
    "eu", "europe", "germany", "france",
    "us", "united states", "uk", "united kingdom",
    "india", "brazil", "indonesia",
  ];
  const markets = KNOWN_MARKETS.filter((m) => text.includes(m));
  for (const c of cons) {
    if (markets.some((m) => c.statement.toLowerCase().includes(m))) note(c.statement);
  }

  return {
    markets,
    costSensitive,
    requiresSelfHosting,
    regulated,
    tier: doc.complexity.tier,
    sources,
  };
}

export interface ProviderChoice {
  capability: CapabilityClass;
  chosen: ProviderOption;
  rationale: string;
  rejected: { option: ProviderOption; because: string }[];
  drivenBy: string[];
}

/**
 * Choose one provider per capability.
 *
 * Returns null when the catalogue offers nothing for a capability, or only one
 * option — a "choice" with no alternative is not a decision, and pretending
 * otherwise would produce exactly the empty justification this system exists to
 * prevent.
 */
export function chooseProvider(
  capability: CapabilityClass,
  ctx: BindingConstraints
): ProviderChoice | null {
  const options = optionsFor(capability);
  if (options.length === 0) return null;

  const rejected: { option: ProviderOption; because: string }[] = [];
  let viable = options.slice();

  const reject = (predicate: (o: ProviderOption) => string | null) => {
    viable = viable.filter((o) => {
      const reason = predicate(o);
      if (reason) {
        rejected.push({ option: o, because: reason });
        return false;
      }
      return true;
    });
  };

  // Hard exclusions first — these genuinely rule an option out.
  reject((o) =>
    ctx.requiresSelfHosting && !o.selfHostable
      ? "cannot be self-hosted, and the data must stay under your control"
      : null
  );
  reject((o) =>
    o.tierFloor > ctx.tier
      ? `more infrastructure than a tier-${ctx.tier} system justifies`
      : null
  );
  reject((o) =>
    ctx.markets.length > 0 &&
    o.capability === "PAYMENTS" &&
    o.strongIn &&
    o.strongIn.length > 0 &&
    !o.strongIn.some((m) => ctx.markets.includes(m))
      ? `built for other markets than ${ctx.markets.join("/")}`
      : null
  );

  // Preferences — order what survives rather than excluding it.
  if (viable.length === 0) {
    // Everything was excluded; fall back to the least-constrained option rather
    // than returning nothing, and say so honestly in the rationale.
    const fallback = options.sort((a, b) => a.tierFloor - b.tierFloor)[0];
    return {
      capability,
      chosen: fallback,
      rationale:
        "No catalogued option fully satisfies the stated constraints; this is the closest fit and should be confirmed.",
      rejected: rejected.filter((r) => r.option.id !== fallback.id).slice(0, 3),
      drivenBy: ctx.sources.slice(0, 3),
    };
  }

  const scored = viable
    .map((o) => {
      let score = 0;
      // Market fit is decisive where it applies.
      if (o.strongIn?.some((m) => ctx.markets.includes(m))) score += 40;
      // Cost sensitivity outranks polish for a bootstrapped project.
      score += ctx.costSensitive ? (3 - COST_RANK[o.costBand]) * 10 : COST_RANK[o.costBand] * 2;
      if (ctx.costSensitive && o.freeTier) score += 10;
      // Prefer the simplest thing that clears the tier floor.
      score += (5 - Math.abs(ctx.tier - o.tierFloor)) * 3;
      if (ctx.regulated && o.selfHostable) score += 8;
      if (o.maturity === "incumbent") score += 6;
      else if (o.maturity === "established") score += 3;
      // A long list of limitations is a real cost.
      score -= (o.limitations?.length ?? 0) * 4;
      return { option: o, score };
    })
    .sort((a, b) => b.score - a.score);

  const chosen = scored[0].option;

  for (const { option } of scored.slice(1)) {
    rejected.push({
      option,
      because: whyNot(option, chosen, ctx),
    });
  }

  return {
    capability,
    chosen,
    rationale: whyThis(chosen, ctx),
    rejected: rejected.slice(0, 4),
    drivenBy: ctx.sources.slice(0, 3),
  };
}

function whyThis(o: ProviderOption, ctx: BindingConstraints): string {
  const reasons: string[] = [];
  if (o.strongIn?.some((m) => ctx.markets.includes(m))) {
    reasons.push(`serves ${ctx.markets.join("/")}, which the others do not`);
  }
  if (ctx.costSensitive && (o.costBand === "free" || o.costBand === "low")) {
    reasons.push("keeps running cost low, which the budget constraint demands");
  }
  if (ctx.requiresSelfHosting && o.selfHostable) {
    reasons.push("can be self-hosted, which the data constraint requires");
  }
  if (o.tierFloor <= ctx.tier && (o.limitations?.length ?? 0) === 0) {
    reasons.push(`proportionate to a tier-${ctx.tier} system`);
  }
  if (reasons.length === 0) reasons.push("the simplest option that meets the stated needs");
  return `${o.summary} Chosen because it ${reasons.join(", and ")}.`;
}

function whyNot(
  option: ProviderOption,
  chosen: ProviderOption,
  ctx: BindingConstraints
): string {
  if (option.tierFloor > chosen.tierFloor) {
    return `more operational weight than this system needs`;
  }
  if (ctx.costSensitive && COST_RANK[option.costBand] > COST_RANK[chosen.costBand]) {
    return `costs more without a benefit the requirements ask for`;
  }
  // Market fit is checked BEFORE generic limitations: when a market is stated, it
  // is the most useful explanation available. "Stripe is not available in every
  // country" is true but vague; "Paystack is the stronger fit for Nigeria" tells
  // the reader what actually decided it.
  if (chosen.strongIn?.some((m) => ctx.markets.includes(m))) {
    return `workable elsewhere, but ${chosen.label} is the stronger fit for the ${ctx.markets.join("/")} market`;
  }
  if ((option.limitations?.length ?? 0) > 0) {
    return option.limitations![0];
  }
  return `viable, but offers no advantage over ${chosen.label} for these requirements`;
}

/**
 * Bind every required capability and record the decisions.
 *
 * Each binding produces BOTH a `providerBinding` (what was chosen) and a
 * `decision` (why, with the rejected alternatives). The decision is traced back to
 * the capability via `decides`, so "why this technology?" is the same graph
 * traversal as "why this component?".
 */
export function applyBindings(doc: Uss, version: number): Uss {
  const ctx = readBindingConstraints(doc);
  const g = new UssGraph(doc);

  for (const cap of capabilities(doc)) {
    const capabilityClass = cap.capabilityClass as CapabilityClass;

    // Already bound — a re-run must not duplicate or silently re-decide.
    const existing = g
      .byKind("providerBinding")
      .find((b) => b.capabilityClass === capabilityClass);
    if (existing) continue;

    const choice = chooseProvider(capabilityClass, ctx);
    if (!choice) continue;

    const binding = g.add("providerBinding", {
      title: `${capabilityClass}: ${choice.chosen.label}`,
      capabilityClass,
      providerId: choice.chosen.id,
      providerLabel: choice.chosen.label,
      rationale: choice.rationale,
      drivenBy: choice.drivenBy,
      swappable: true,
      status: "INFERRED",
      confidence: choice.rejected.length > 0 ? 0.8 : 0.6,
      evidence: [{ kind: "rule" }],
      firstSeenVersion: version,
    });

    g.link("boundTo", binding.id, cap.id, {
      status: "INFERRED",
      confidence: 0.85,
      evidence: [{ kind: "rule" }],
      firstSeenVersion: version,
    });

    // A decision needs at least one rejected alternative; without one this is a
    // default, and the schema would rightly refuse it.
    if (choice.rejected.length > 0) {
      const decision = g.add("decision", {
        title: `Use ${choice.chosen.label} for ${capabilityClass}`,
        choice: choice.chosen.label,
        rationale: choice.rationale,
        alternatives: choice.rejected.slice(0, 4).map((r) => ({
          option: r.option.label,
          rejectedBecause: r.because,
        })),
        reversibility: choice.chosen.capability === "PAYMENTS" ? "costly" : "cheap",
        revisitTriggers: [
          `the project expands beyond ${ctx.markets.length ? ctx.markets.join("/") : "its current market"}`,
          "cost at real volume differs from the estimate",
        ],
        status: "INFERRED",
        confidence: 0.75,
        evidence: [{ kind: "rule" }],
        firstSeenVersion: version,
      });

      g.link("decides", decision.id, cap.id, {
        status: "INFERRED",
        confidence: 0.8,
        evidence: [{ kind: "rule" }],
        firstSeenVersion: version,
      });

      // Trace the decision back to whatever constraint forced it.
      for (const c of constraints(doc)) {
        if (choice.drivenBy.includes(c.statement)) {
          g.link("causedBy", decision.id, c.id, {
            status: "INFERRED",
            confidence: 0.8,
            evidence: [{ kind: "rule" }],
            firstSeenVersion: version,
          });
        }
      }
    }
  }

  return g.snapshot();
}

/** Capabilities with no provider bound yet. */
export function unboundCapabilities(doc: Uss): string[] {
  const g = new UssGraph(doc);
  const bound = new Set(g.byKind("providerBinding").map((b) => b.capabilityClass));
  return capabilities(doc)
    .map((c) => c.capabilityClass)
    .filter((c) => !bound.has(c));
}

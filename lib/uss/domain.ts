import { UssGraph } from "@/lib/uss/graph";
import { capabilities, constraints, requirements } from "@/lib/uss/views";
import type { IntegrityFinding, Uss } from "@/lib/uss/schema";

/**
 * Domain checks and the invariant seed catalogue.
 *
 * Unit 2 made architecture a consequence of requirements. This makes it a
 * consequence of the BUSINESS: what things exist, what states they move through,
 * and what must never be true of them.
 *
 * The invariant catalogue is deterministic, for the same reason the implication
 * rulebook is: "an order cannot be paid twice" is not a creative insight, it is
 * something every marketplace needs and every model eventually forgets. The
 * baseline proved exactly that.
 */

export interface InvariantSeed {
  statement: string;
  category:
    | "uniqueness"
    | "conservation"
    | "authorization"
    | "lifecycle"
    | "consistency"
    | "privacy"
    | "financial";
  violationConsequence: string;
  severity: "critical" | "important";
  /** Domain entity titles this applies to, matched case-insensitively. */
  appliesTo: string[];
}

/**
 * Invariants seeded from what the system does, not from what it is called.
 * Keyed by a signal in the spec rather than by domain, so they fire for a
 * marketplace, a booking system and a ticketing platform alike.
 */
export function seedInvariants(doc: Uss): InvariantSeed[] {
  const caps = new Set(capabilities(doc).map((c) => c.capabilityClass));
  const text = [
    ...requirements(doc).map((r) => `${r.title} ${r.statement}`),
    ...constraints(doc).map((c) => c.statement),
  ]
    .join(" ")
    .toLowerCase();
  const mentions = (...t: string[]) => t.some((x) => text.includes(x));

  const seeds: InvariantSeed[] = [];

  if (caps.has("PAYMENTS") || mentions("payment", "checkout", "billing", "subscription")) {
    seeds.push(
      {
        statement: "A single payment can be recorded at most once, however many times the provider notifies us",
        category: "uniqueness",
        violationConsequence: "The customer is charged twice, or credited twice for one payment",
        severity: "critical",
        appliesTo: ["payment", "order", "subscription", "invoice"],
      },
      {
        statement: "Value is only granted after the payment provider confirms it, never on a client-side signal",
        category: "financial",
        violationConsequence: "Anyone can obtain paid goods or access without paying",
        severity: "critical",
        appliesTo: ["payment", "order", "subscription"],
      },
      {
        statement: "Every change to a balance or amount is recorded in an append-only history",
        category: "financial",
        violationConsequence: "Money cannot be reconciled and discrepancies cannot be explained",
        severity: "critical",
        appliesTo: ["payment", "payout", "invoice", "ledger", "balance"],
      }
    );
  }

  if (mentions("inventory", "stock", "seat", "ticket", "slot", "booking", "availability")) {
    seeds.push({
      statement: "The available quantity of a finite resource can never go below zero",
      category: "conservation",
      violationConsequence: "The business sells something it does not have and must disappoint a customer",
      severity: "critical",
      appliesTo: ["inventory", "stock", "product", "seat", "ticket", "slot"],
    });
  }

  if (caps.has("AUTHZ") || mentions("organisation", "organization", "tenant", "company", "workspace", "team")) {
    seeds.push({
      statement: "A request may only read or change data belonging to the requester's own organisation",
      category: "privacy",
      violationConsequence: "One customer sees another customer's data — the most damaging bug a multi-customer product can ship",
      severity: "critical",
      appliesTo: ["*"],
    });
  }

  if (mentions("order", "booking", "request", "application", "claim", "shipment", "job")) {
    seeds.push({
      statement: "An item may only move between states along a defined transition; any other move is rejected",
      category: "lifecycle",
      violationConsequence: "Impossible states occur — a cancelled order ships, a refunded order is fulfilled",
      severity: "critical",
      appliesTo: ["order", "booking", "request", "application", "claim", "shipment", "job"],
    });
  }

  if (caps.has("OBJECT_STORAGE") || mentions("upload", "document", "file")) {
    seeds.push({
      statement: "A stored file is only readable by someone authorised for the record it belongs to",
      category: "authorization",
      violationConsequence: "Private documents become publicly reachable by anyone with the URL",
      severity: "critical",
      appliesTo: ["*"],
    });
  }

  if (caps.has("QUEUE") || caps.has("WORKFLOW_ENGINE") || caps.has("SCHEDULER")) {
    seeds.push({
      statement: "Running the same background job twice produces the same result as running it once",
      category: "uniqueness",
      violationConsequence: "Retries duplicate work: double emails, double charges, double records",
      severity: "critical",
      appliesTo: ["*"],
    });
  }

  return seeds;
}

/** Write seeded invariants into the graph, linked to the entities they govern. */
export function applyInvariants(doc: Uss, seeds: InvariantSeed[], version: number): Uss {
  const g = new UssGraph(doc);
  const domainEntities = g.byKind("domainEntity");

  for (const seed of seeds) {
    const existing = g
      .byKind("invariant")
      .find((i) => i.statement.toLowerCase() === seed.statement.toLowerCase());
    if (existing) continue;

    const invariant = g.add("invariant", {
      title: seed.statement.slice(0, 120),
      statement: seed.statement,
      category: seed.category,
      enforcement: "",
      violationConsequence: seed.violationConsequence,
      severity: seed.severity,
      status: "INFERRED",
      confidence: 0.85,
      evidence: [{ kind: "rule" }],
      firstSeenVersion: version,
    });

    const targets = seed.appliesTo.includes("*")
      ? domainEntities
      : domainEntities.filter((e) =>
          seed.appliesTo.some((t) => e.title.toLowerCase().includes(t))
        );

    for (const target of targets) {
      g.link("governs", invariant.id, target.id, {
        status: "INFERRED",
        confidence: 0.8,
        evidence: [{ kind: "rule" }],
        firstSeenVersion: version,
      });
    }
  }

  return g.snapshot();
}

/**
 * Domain-level integrity checks.
 *
 * These are the "business correctness" dimension made computable. An invariant
 * nothing enforces is the single most valuable finding a design review can
 * produce, because it looks fine on a diagram and fails in production.
 */
export function checkDomainIntegrity(doc: Uss): IntegrityFinding[] {
  const g = new UssGraph(doc);
  const findings: IntegrityFinding[] = [];

  const invariants = g.byKind("invariant");
  const domainEntities = g.byKind("domainEntity");
  const transitions = g.byKind("transition");
  const states = g.byKind("state");

  // An invariant with no component enforcing it is a rule nobody implements.
  const unenforced = invariants.filter(
    (i) => !i.enforcement && g.neighbours(i.id, "governs").length === 0
  );
  if (unenforced.length > 0) {
    findings.push({
      rule: "unenforced-invariant",
      severity: "blocking",
      message: `${unenforced.length} rule(s) the system must never violate have nothing enforcing them: ${unenforced
        .map((i) => i.title)
        .slice(0, 3)
        .join("; ")}`,
      subjects: unenforced.map((i) => i.id),
    });
  }

  // A domain entity nothing manages will not exist in the built system.
  const unmanaged = domainEntities.filter((e) => g.to(e.id, "manages").length === 0);
  if (unmanaged.length > 0) {
    findings.push({
      rule: "unmanaged-domain-entity",
      severity: "material",
      message: `No component owns ${unmanaged.map((e) => e.title).join(", ")}`,
      subjects: unmanaged.map((e) => e.id),
    });
  }

  // A lifecycle with no terminal state never completes.
  const byEntity = new Map<string, typeof states>();
  for (const s of states) {
    const list = byEntity.get(s.entityTitle) ?? [];
    list.push(s);
    byEntity.set(s.entityTitle, list);
  }
  for (const [entity, list] of byEntity) {
    if (list.length > 1 && !list.some((s) => s.isTerminal)) {
      findings.push({
        rule: "lifecycle-never-ends",
        severity: "material",
        message: `${entity} has states but none of them is final — nothing ever completes`,
        subjects: list.map((s) => s.id),
      });
    }
  }

  // A transition that moves money or grants value with no guard.
  const unguarded = transitions.filter(
    (t) =>
      !t.guard &&
      /paid|refund|ship|fulfil|fulfill|approve|activate|grant|complete/i.test(`${t.to} ${t.trigger}`)
  );
  if (unguarded.length > 0) {
    findings.push({
      rule: "unguarded-transition",
      severity: "blocking",
      message: `${unguarded
        .map((t) => `${t.entityTitle}: ${t.from} → ${t.to}`)
        .slice(0, 3)
        .join("; ")} — no condition prevents this happening when it should not`,
      subjects: unguarded.map((t) => t.id),
    });
  }

  // Tenant-scoped data with no authorization invariant governing it.
  const tenantScoped = domainEntities.filter((e) => e.tenantScoped);
  const hasIsolation = invariants.some((i) => i.category === "privacy" || i.category === "authorization");
  if (tenantScoped.length > 0 && !hasIsolation) {
    findings.push({
      rule: "missing-tenant-isolation",
      severity: "blocking",
      message: `${tenantScoped.length} entity type(s) belong to specific customers, but no rule states that one customer cannot read another's`,
      subjects: tenantScoped.map((e) => e.id),
    });
  }

  // Money without an append-only history.
  const financial = domainEntities.filter((e) => e.financial);
  const hasLedger = invariants.some((i) => i.category === "financial");
  if (financial.length > 0 && !hasLedger) {
    findings.push({
      rule: "money-without-audit",
      severity: "blocking",
      message: `${financial.map((e) => e.title).join(", ")} record money, but nothing requires an auditable history of changes`,
      subjects: financial.map((e) => e.id),
    });
  }

  return findings;
}

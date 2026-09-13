import type { CapabilityClass } from "@/lib/capabilities/registry";
import { UssGraph } from "@/lib/uss/graph";
import { MECHANISMS, componentsDemonstrating, type Mechanism } from "@/lib/uss/proof";
import {
  actors,
  capabilities,
  components,
  domainEntities,
  requirements,
  transitions,
} from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";

/**
 * Validation by scenario — by STRUCTURAL PROOF.
 *
 * ── What this file used to do, and why it was worthless ──────────────────────
 * Every scenario searched one blob of text built from implications + invariants +
 * requirements + components. The payments implication rule writes "payment
 * notifications must be idempotent" into the spec; the webhook-replay scenario
 * then searched that same spec for "idempot" and found it. PASS. A rule firing
 * made the scenario pass. Worse, on the live path scenarios run before the
 * architecture is generated, so the verdict was decided on a document with zero
 * components — it could only ever have been measuring the rulebook.
 *
 * ── What counts as proof now ─────────────────────────────────────────────────
 * A scenario passes only when something in the ARCHITECTURE demonstrably handles
 * it, ranked:
 *
 *   1. an `enforcedBy` edge from a relevant invariant to a component — a graph
 *      edge, the strongest evidence available
 *   2. a component whose OWN title/responsibility/technology demonstrates the
 *      mechanism, in a category where that mechanism can live
 *   3. transition guards and actor permissions — structural facts about the spec
 *
 * Explicitly NOT proof:
 *   · implications, requirements, invariant statements — these are what the system
 *     SAYS SHOULD happen. The whole question is whether the design does it.
 *   · provider bindings. Stripe offers signature verification; that a payment
 *     provider was chosen does not prove the design verifies anything.
 *   · a category alone. A `queue` node does not prove retries exist.
 *
 * ── The three outcomes ───────────────────────────────────────────────────────
 *   PASS     proof exists, and the result names what proved it
 *   GAP      no proof, and there WAS an architecture to inspect — a real finding
 *   UNKNOWN  no proof, and no architecture exists yet — an honest non-answer
 *
 * Unproven is never PASS. But silence in a written architecture is a finding,
 * while silence before any architecture exists is not, and collapsing those two
 * into UNKNOWN would delete the most valuable thing this system produces.
 */

export type ScenarioOutcome = "pass" | "gap" | "unknown";

export interface ScenarioResult {
  id: string;
  title: string;
  /** What is being tested, in plain language. */
  question: string;
  outcome: ScenarioOutcome;
  /** Why we reached that outcome — cites what in the spec decided it. */
  reasoning: string;
  /** What WOULD prove this is handled. Shown next to every gap and unknown. */
  proofDescription: string;
  /** Component ids that proved it. Empty unless the outcome is `pass`. */
  provenBy: string[];
  severity: "blocking" | "material" | "cosmetic";
}

export interface Proof {
  /** Entity ids that constitute the proof. */
  by: string[];
  /** One line naming the evidence, e.g. `Webhook Handler ("dedup")`. */
  detail: string;
}

export interface Scenario {
  id: string;
  title: string;
  question: string;
  severity: "blocking" | "material" | "cosmetic";
  /**
   * Where the evidence would live. `architecture` scenarios return UNKNOWN rather
   * than GAP when no components exist yet; `spec` scenarios are already gated on
   * their evidence source existing, so unproven is always a real gap.
   */
  evidenceSource: "architecture" | "spec";
  /** What would prove this is handled, in the reader's language. */
  proofDescription: string;
  /** Is this system EXPOSED to this failure? May read requirements and capabilities. */
  applies: (doc: Uss, ctx: ScenarioContext) => boolean;
  /** Structural proof. Reads the architecture, enforcedBy edges, guards, permissions. */
  proof: (doc: Uss, ctx: ScenarioContext) => Proof | null;
  /** A more specific explanation than proofDescription when unproven. */
  gapDetail?: (doc: Uss, ctx: ScenarioContext) => string | undefined;
}

interface ScenarioContext {
  caps: Set<CapabilityClass>;
  /**
   * Requirement and constraint text, lowercased. Used ONLY by `applies` — to ask
   * whether the system is exposed to a failure. Never by `proof`: what the brief
   * asks for cannot be evidence that the design delivers it.
   */
  intentText: string;
  tier: number;
  componentCount: number;
}

function buildContext(doc: Uss): ScenarioContext {
  const intentText = [
    ...requirements(doc).map((r) => `${r.title} ${r.statement}`),
    ...domainEntities(doc).map((e) => e.title),
  ]
    .join(" ")
    .toLowerCase();

  return {
    caps: new Set(capabilities(doc).map((c) => c.capabilityClass as CapabilityClass)),
    intentText,
    tier: doc.complexity.tier,
    componentCount: components(doc).length,
  };
}

const has = (ctx: ScenarioContext, ...c: CapabilityClass[]) => c.some((x) => ctx.caps.has(x));
const mentions = (ctx: ScenarioContext, ...terms: string[]) =>
  terms.some((t) => ctx.intentText.includes(t));

/** Proof #2: a component's own description demonstrates the mechanism. */
function byComponent(doc: Uss, m: Mechanism): Proof | null {
  const demos = componentsDemonstrating(doc, m);
  if (demos.length === 0) return null;
  return {
    by: demos.map((d) => d.componentId),
    detail: demos.map((d) => `${d.componentTitle} ("${d.matched}")`).join(", "),
  };
}

/** Proof #1: an invariant of a relevant category has an `enforcedBy` edge. */
function byInvariant(doc: Uss, ...categories: string[]): Proof | null {
  const g = new UssGraph(doc);
  const by: string[] = [];
  const names: string[] = [];

  for (const inv of g.byKind("invariant")) {
    if (!categories.includes(inv.category)) continue;
    const edges = g.from(inv.id, "enforcedBy");
    if (edges.length === 0) continue;
    for (const e of edges) {
      by.push(e.to);
      const c = g.get(e.to);
      if (c && "title" in c) names.push(c.title);
    }
  }

  if (by.length === 0) return null;
  return { by, detail: `enforced by ${[...new Set(names)].join(", ")}` };
}

/** Either form of proof. Component evidence is checked first — it is more specific. */
function either(...proofs: (Proof | null)[]): Proof | null {
  return proofs.find((p): p is Proof => p !== null) ?? null;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "webhook-replay",
    title: "The payment webhook arrives three times",
    question: "A provider retries a notification. Does the system charge or fulfil once, or three times?",
    severity: "blocking",
    evidenceSource: "architecture",
    proofDescription:
      "A component that states it deduplicates provider notifications — by event id, an idempotency key, or a uniqueness constraint.",
    applies: (_d, ctx) => has(ctx, "PAYMENTS"),
    proof: (d) => either(byComponent(d, MECHANISMS.idempotency), byInvariant(d, "uniqueness")),
  },
  {
    id: "payment-unverified",
    title: "A client claims a payment succeeded",
    question: "Can someone obtain paid value by telling the system the payment worked?",
    severity: "blocking",
    evidenceSource: "architecture",
    proofDescription:
      "A component that states it verifies the provider's signature, or confirms payment server-side with the provider before granting value.",
    applies: (_d, ctx) => has(ctx, "PAYMENTS"),
    proof: (d) =>
      either(byComponent(d, MECHANISMS["webhook-verification"]), byInvariant(d, "financial")),
  },
  {
    id: "cross-tenant",
    title: "A user requests another organisation's record by id",
    question: "Does authorization stop them, or does the interface simply not show a link?",
    severity: "blocking",
    evidenceSource: "architecture",
    proofDescription:
      "A component that states it scopes every request to the caller's organisation — row-level security, a tenant filter, or a per-request authorization check.",
    applies: (d, ctx) => has(ctx, "AUTHZ") || domainEntities(d).some((e) => e.tenantScoped),
    proof: (d) =>
      either(
        byComponent(d, MECHANISMS["tenant-isolation"]),
        byInvariant(d, "authorization", "privacy")
      ),
  },
  {
    id: "provider-down",
    title: "The external provider is down or rate-limiting",
    question: "What does the user see, and what happens to work already in flight?",
    severity: "material",
    evidenceSource: "architecture",
    proofDescription:
      "A component that states its behaviour when a dependency fails — retry with backoff, a circuit breaker, a timeout, or a degraded path.",
    applies: (_d, ctx) =>
      has(ctx, "LLM", "VIDEO_GEN", "IMAGE_GEN", "AUDIO_GEN", "PAYMENTS", "EMAIL", "SMS"),
    proof: (d) => {
      const direct = byComponent(d, MECHANISMS.resilience);
      if (direct) return direct;
      // A dependency edge can carry the behaviour instead of the component text.
      const g = new UssGraph(d);
      const noted = g
        .relations()
        .filter(
          (r) =>
            r.type === "dependsOn" &&
            r.note &&
            MECHANISMS.resilience.terms.some((t) => r.note!.toLowerCase().includes(t))
        );
      if (noted.length === 0) return null;
      return { by: noted.map((r) => r.from), detail: `dependency notes: ${noted.map((r) => r.note).join("; ")}` };
    },
  },
  {
    id: "concurrent-claim",
    title: "Two people claim the last one at the same moment",
    question: "Can the available quantity go negative?",
    severity: "blocking",
    evidenceSource: "architecture",
    proofDescription:
      "A component that states how the finite resource is allocated atomically — a reservation, a lock, or a single transaction that decrements and claims together.",
    applies: (_d, ctx) =>
      mentions(ctx, "inventory", "stock", "seat", "ticket", "slot", "booking", "availab"),
    proof: (d) => {
      const guarded = transitions(d).filter(
        (t) => t.guard && /stock|inventory|availab|quantity|capacity|seat/i.test(t.guard)
      );
      if (guarded.length > 0) {
        return {
          by: guarded.map((t) => t.id),
          detail: `guarded transitions: ${guarded.map((t) => `${t.from}→${t.to}`).join(", ")}`,
        };
      }
      return either(byComponent(d, MECHANISMS["atomic-allocation"]), byInvariant(d, "conservation"));
    },
  },
  {
    id: "job-crash",
    title: "A background worker crashes mid-job",
    question: "Is the work lost, retried, or half-applied?",
    severity: "material",
    evidenceSource: "architecture",
    proofDescription:
      "A queue or worker component that states its recovery behaviour — persisted job state, retries, a dead-letter path, or resumption from a checkpoint.",
    applies: (_d, ctx) => has(ctx, "QUEUE", "SCHEDULER", "WORKFLOW_ENGINE"),
    proof: (d) => {
      // Both halves must be true: something asynchronous exists, AND it says what
      // happens when it dies. A queue on its own proves nothing.
      const hasAsync = components(d).some((c) => c.category === "queue" || c.category === "compute");
      if (!hasAsync) return null;
      return byComponent(d, MECHANISMS["durable-work"]);
    },
  },
  {
    id: "upload-interrupted",
    title: "A large upload is interrupted at 80%",
    question: "Can it resume, or must the user start again — and is a partial file left behind?",
    severity: "material",
    evidenceSource: "architecture",
    proofDescription:
      "A storage or upload component that states it uses multipart or resumable uploads, or direct-to-storage presigned uploads.",
    applies: (_d, ctx) => has(ctx, "OBJECT_STORAGE"),
    proof: (d) => byComponent(d, MECHANISMS["resumable-upload"]),
  },
  {
    id: "database-unavailable",
    title: "The primary database is unavailable for ten minutes",
    question: "What does the user see, and does anything get lost?",
    severity: "material",
    evidenceSource: "architecture",
    proofDescription:
      "A database or storage component that states its durability posture — a replica, failover, point-in-time recovery, or a stated backup policy.",
    applies: (_d, ctx) => ctx.tier >= 3 && has(ctx, "RELATIONAL_STORE", "DOCUMENT_STORE"),
    proof: (d) => byComponent(d, MECHANISMS["data-durability"]),
  },
  {
    id: "illegal-transition",
    title: "Something tries to move to a state it should not reach",
    question: "Is the move rejected, or merely not offered in the interface?",
    severity: "blocking",
    evidenceSource: "spec",
    proofDescription:
      "Every significant transition — paid, shipped, approved, refunded — carries a condition that must hold before it is allowed.",
    applies: (d) => transitions(d).length > 0,
    proof: (d) => {
      const significant = transitions(d).filter((t) =>
        /paid|ship|fulfil|fulfill|approve|complete|refund/i.test(t.to)
      );
      const unguarded = significant.filter((t) => !t.guard);
      if (unguarded.length > 0) return null;
      const guarded = significant.filter((t) => t.guard);
      if (guarded.length === 0) return null;
      return {
        by: guarded.map((t) => t.id),
        detail: guarded.map((t) => `${t.from}→${t.to} (only if ${t.guard})`).join(", "),
      };
    },
    gapDetail: (d) => {
      const unguarded = transitions(d).filter(
        (t) => !t.guard && /paid|ship|fulfil|fulfill|approve|complete|refund/i.test(t.to)
      );
      if (unguarded.length === 0) return undefined;
      return `${unguarded
        .map((t) => `${t.entityTitle}: ${t.from}→${t.to}`)
        .join(", ")} has no condition that must hold first.`;
    },
  },
  {
    id: "expired-link",
    title: "Someone opens a file link a month later",
    question: "Does it still work, and should it?",
    severity: "material",
    evidenceSource: "architecture",
    proofDescription:
      "A storage or gateway component that states file access uses short-lived signed URLs with an expiry.",
    applies: (_d, ctx) => has(ctx, "OBJECT_STORAGE"),
    proof: (d) => byComponent(d, MECHANISMS["expiring-access"]),
  },
  {
    id: "model-wrong",
    title: "The model returns a confident, wrong answer",
    question: "Does a human check it, is it cited, or does the user simply act on it?",
    severity: "blocking",
    evidenceSource: "architecture",
    proofDescription:
      "A component that states what checks model output — human review, citations back to sources, an evaluation step, or a guardrail.",
    applies: (_d, ctx) => has(ctx, "LLM", "VECTOR_SEARCH"),
    proof: (d) => byComponent(d, MECHANISMS["output-checking"]),
  },
  {
    id: "unbounded-cost",
    title: "One user runs the expensive operation a thousand times",
    question: "What stops them, and what does it cost you?",
    severity: "material",
    evidenceSource: "architecture",
    proofDescription:
      "A component that states a per-user bound — a quota, a credit balance, rate limiting, or a spend cap.",
    applies: (_d, ctx) => has(ctx, "LLM", "VIDEO_GEN", "IMAGE_GEN", "AUDIO_GEN"),
    proof: (d) => byComponent(d, MECHANISMS["cost-bounding"]),
  },
  {
    id: "no-actor-permissions",
    title: "A second kind of user signs in",
    question: "Does the system know what they may and may not do?",
    severity: "blocking",
    evidenceSource: "spec",
    proofDescription: "Every kind of human user has recorded permissions.",
    applies: (d) => actors(d).filter((a) => a.isHuman).length >= 2,
    proof: (d) => {
      const humans = actors(d).filter((a) => a.isHuman);
      const withPerms = humans.filter((a) => a.permissions.length > 0);
      if (withPerms.length !== humans.length) return null;
      return { by: humans.map((a) => a.id), detail: "every role has stated permissions" };
    },
    gapDetail: (d) => {
      const missing = actors(d).filter((a) => a.isHuman && a.permissions.length === 0);
      if (missing.length === 0) return undefined;
      return `${missing
        .map((a) => a.title)
        .join(", ")} — no permissions recorded, so authorization cannot be built.`;
    },
  },
];

/** Run every applicable scenario. Pure, free, no model. */
export function runScenarios(doc: Uss): ScenarioResult[] {
  const ctx = buildContext(doc);
  const results: ScenarioResult[] = [];

  for (const s of SCENARIOS) {
    if (!s.applies(doc, ctx)) continue;

    const proof = s.proof(doc, ctx);
    if (proof) {
      results.push({
        id: s.id,
        title: s.title,
        question: s.question,
        outcome: "pass",
        reasoning: `Handled by ${proof.detail}.`,
        proofDescription: s.proofDescription,
        provenBy: proof.by,
        severity: s.severity,
      });
      continue;
    }

    // Unproven. Whether that is a finding or an honest non-answer depends on
    // whether there was anything to inspect.
    const noArchitecture = s.evidenceSource === "architecture" && ctx.componentCount === 0;
    results.push({
      id: s.id,
      title: s.title,
      question: s.question,
      outcome: noArchitecture ? "unknown" : "gap",
      reasoning: noArchitecture
        ? "No architecture has been generated yet, so nothing can demonstrate this either way."
        : (s.gapDetail?.(doc, ctx) ??
          `Nothing in the architecture demonstrates this. ${s.proofDescription}`),
      proofDescription: s.proofDescription,
      provenBy: [],
      severity: s.severity,
    });
  }

  // Gaps first, then unknowns, then passes — the useful order to read.
  const rank = { gap: 0, unknown: 1, pass: 2 };
  return results.sort((a, b) => rank[a.outcome] - rank[b.outcome]);
}

export interface ScenarioSummary {
  total: number;
  passed: number;
  gaps: number;
  unknown: number;
  blockingGaps: number;
  /** 0-100, counting only what was actually decided. Null below 3 decided. */
  score: number | null;
}

export function summariseScenarios(results: ScenarioResult[]): ScenarioSummary {
  const passed = results.filter((r) => r.outcome === "pass").length;
  const gaps = results.filter((r) => r.outcome === "gap").length;
  const unknown = results.filter((r) => r.outcome === "unknown").length;
  const decided = passed + gaps;

  return {
    total: results.length,
    passed,
    gaps,
    unknown,
    blockingGaps: results.filter((r) => r.outcome === "gap" && r.severity === "blocking").length,
    // Unknowns are excluded rather than counted as failures: a scenario nothing
    // could yet demonstrate is not evidence of a bad design. And below three
    // decided scenarios there is no score worth printing — "2/2 handled" is a
    // headline built from noise.
    score: decided < 3 ? null : Math.round((passed / decided) * 100),
  };
}

/** Scenario gaps as integrity findings, so they surface with everything else. */
export function scenarioFindings(doc: Uss) {
  return runScenarios(doc)
    .filter((r) => r.outcome === "gap")
    .map((r) => ({
      rule: `scenario:${r.id}`,
      severity: r.severity,
      message: `${r.title} — ${r.reasoning}`,
      subjects: [],
    }));
}

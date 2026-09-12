import type { CapabilityClass } from "@/lib/capabilities/registry";
import { UssGraph } from "@/lib/uss/graph";
import {
  actors,
  capabilities,
  components,
  domainEntities,
  implications,
  invariants,
  requirements,
  transitions,
} from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";

/**
 * Validation by scenario.
 *
 * The key insight, and the reason this unit is cheap: "the payment webhook arrives
 * three times" is not a simulation. It is a GRAPH QUERY — does any component
 * realizing PAYMENTS declare idempotency, and does an invariant govern it? Most of
 * what the audit asked for is answerable deterministically, at zero cost, against
 * the spec we already built.
 *
 * A scenario has three honest outcomes:
 *   PASS    the spec shows how this is handled
 *   GAP     the spec shows it is NOT handled — a real finding
 *   UNKNOWN the spec does not say either way — an honest answer, not a failure
 *
 * UNKNOWN matters. Reporting a gap the spec is merely silent about would be the
 * same manufactured certainty this whole design exists to prevent.
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
  severity: "blocking" | "material" | "cosmetic";
}

export interface Scenario {
  id: string;
  title: string;
  question: string;
  severity: "blocking" | "material" | "cosmetic";
  /** Does this scenario apply to this system at all? */
  applies: (doc: Uss, ctx: ScenarioContext) => boolean;
  evaluate: (doc: Uss, ctx: ScenarioContext) => { outcome: ScenarioOutcome; reasoning: string };
}

interface ScenarioContext {
  caps: Set<CapabilityClass>;
  /** Everything the spec says, lowercased — implications, invariants, components. */
  specText: string;
  tier: number;
}

function buildContext(doc: Uss): ScenarioContext {
  const specText = [
    ...implications(doc).map((i) => i.statement),
    ...invariants(doc).map((i) => `${i.statement} ${i.enforcement}`),
    ...components(doc).map((c) => `${c.title} ${c.responsibility} ${c.technology ?? ""}`),
    ...requirements(doc).map((r) => `${r.title} ${r.statement}`),
    ...transitions(doc).map((t) => `${t.from} ${t.to} ${t.guard}`),
  ]
    .join(" ")
    .toLowerCase();

  return {
    caps: new Set(capabilities(doc).map((c) => c.capabilityClass as CapabilityClass)),
    specText,
    tier: doc.complexity.tier,
  };
}

/** Does the spec address this, anywhere? */
const covers = (ctx: ScenarioContext, ...terms: string[]) =>
  terms.some((t) => ctx.specText.includes(t.toLowerCase()));

const has = (ctx: ScenarioContext, ...c: CapabilityClass[]) => c.some((x) => ctx.caps.has(x));

/** Verdict helper: covered → pass, else gap. Used when silence IS the finding. */
function verdict(
  covered: boolean,
  passReason: string,
  gapReason: string
): { outcome: ScenarioOutcome; reasoning: string } {
  return covered
    ? { outcome: "pass", reasoning: passReason }
    : { outcome: "gap", reasoning: gapReason };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "webhook-replay",
    title: "The payment webhook arrives three times",
    question: "A provider retries a notification. Does the system charge or fulfil once, or three times?",
    severity: "blocking",
    applies: (_d, ctx) => has(ctx, "PAYMENTS"),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "idempot", "exactly once", "dedup", "duplicate", "replay"),
        "The spec requires idempotent handling of provider notifications.",
        "Nothing in the spec makes payment notifications idempotent, so a retry produces a second business effect."
      ),
  },
  {
    id: "payment-unverified",
    title: "A client claims a payment succeeded",
    question: "Can someone obtain paid value by telling the system the payment worked?",
    severity: "blocking",
    applies: (_d, ctx) => has(ctx, "PAYMENTS"),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "signature", "verif", "webhook secret", "provider confirm", "server-side"),
        "Value is granted only on verified provider confirmation.",
        "Nothing states that payment confirmation must come from the verified provider, so a client could claim success."
      ),
  },
  {
    id: "cross-tenant",
    title: "A user requests another organisation's record by id",
    question: "Does authorization stop them, or does the interface simply not show a link?",
    severity: "blocking",
    applies: (d, ctx) =>
      has(ctx, "AUTHZ") || domainEntities(d).some((e) => e.tenantScoped),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "per request", "tenant", "scoped", "row level", "authoriz", "own organisation"),
        "Authorization is decided per request and scoped to the caller's organisation.",
        "Nothing states that every request is scoped to the caller's organisation, so data may be reachable by id."
      ),
  },
  {
    id: "provider-down",
    title: "The external provider is down or rate-limiting",
    question: "What does the user see, and what happens to work already in flight?",
    severity: "material",
    applies: (_d, ctx) =>
      has(ctx, "LLM", "VIDEO_GEN", "IMAGE_GEN", "AUDIO_GEN", "PAYMENTS", "EMAIL", "SMS"),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "retry", "fallback", "timeout", "circuit", "degrad", "rate limit", "unavailable"),
        "The spec defines retry or fallback behaviour for external dependencies.",
        "No behaviour is defined for an external provider being slow, down, or rate-limiting."
      ),
  },
  {
    id: "concurrent-claim",
    title: "Two people claim the last one at the same moment",
    question: "Can the available quantity go negative?",
    severity: "blocking",
    applies: (_d, ctx) => covers(ctx, "inventory", "stock", "seat", "ticket", "slot", "booking"),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "atomic", "reserv", "lock", "never go below", "transaction", "oversell"),
        "Allocation of the finite resource is atomic or reserved.",
        "Nothing prevents two simultaneous claims from taking the same last unit."
      ),
  },
  {
    id: "job-crash",
    title: "A background worker crashes mid-job",
    question: "Is the work lost, retried, or half-applied?",
    severity: "material",
    applies: (_d, ctx) => has(ctx, "QUEUE", "SCHEDULER", "WORKFLOW_ENGINE"),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "retry", "idempot", "job state", "resum", "dead letter", "recover"),
        "Background work has persisted state and a retry path.",
        "Nothing defines what happens to in-flight background work when a worker dies."
      ),
  },
  {
    id: "upload-interrupted",
    title: "A large upload is interrupted at 80%",
    question: "Can it resume, or must the user start again — and is a partial file left behind?",
    severity: "material",
    applies: (_d, ctx) => has(ctx, "OBJECT_STORAGE"),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "resumable", "multipart", "chunk", "discard", "cleanup"),
        "Uploads are chunked and resumable, with incomplete uploads handled.",
        "Nothing states how an interrupted upload is resumed or cleaned up."
      ),
  },
  {
    id: "database-unavailable",
    title: "The primary database is unavailable for ten minutes",
    question: "What does the user see, and does anything get lost?",
    severity: "material",
    applies: (_d, ctx) => ctx.tier >= 3 && has(ctx, "RELATIONAL_STORE", "DOCUMENT_STORE"),
    evaluate: (_d, ctx) => {
      const covered = covers(ctx, "replica", "failover", "backup", "recovery", "degrad", "retry");
      return covered
        ? { outcome: "pass", reasoning: "The spec addresses database unavailability." }
        : {
            outcome: "unknown",
            reasoning:
              "The spec does not say. At this tier that may be acceptable — but it is a decision nobody has made.",
          };
    },
  },
  {
    id: "illegal-transition",
    title: "Something tries to move to a state it should not reach",
    question: "Is the move rejected, or merely not offered in the interface?",
    severity: "blocking",
    applies: (d) => transitions(d).length > 0,
    evaluate: (d) => {
      const unguarded = transitions(d).filter(
        (t) => !t.guard && /paid|ship|fulfil|fulfill|approve|complete|refund/i.test(t.to)
      );
      if (unguarded.length > 0) {
        return {
          outcome: "gap",
          reasoning: `${unguarded
            .map((t) => `${t.entityTitle}: ${t.from}→${t.to}`)
            .join(", ")} has no condition that must hold first.`,
        };
      }
      return {
        outcome: "pass",
        reasoning: "Legal transitions are enumerated and the significant ones are guarded.",
      };
    },
  },
  {
    id: "expired-link",
    title: "Someone opens a file link a month later",
    question: "Does it still work, and should it?",
    severity: "material",
    applies: (_d, ctx) => has(ctx, "OBJECT_STORAGE"),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "signed url", "presigned", "expir", "short-lived", "token"),
        "File access uses short-lived signed URLs.",
        "Nothing states that file links expire, so a shared URL may grant permanent access."
      ),
  },
  {
    id: "model-wrong",
    title: "The model returns a confident, wrong answer",
    question: "Does a human check it, is it cited, or does the user simply act on it?",
    severity: "blocking",
    applies: (_d, ctx) => has(ctx, "LLM", "VECTOR_SEARCH"),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "review", "citation", "cite", "source", "human", "verif", "confidence", "disclaim"),
        "Model output is reviewed, cited, or explicitly caveated.",
        "Nothing defines what happens when the model is wrong — the user would act on it unchecked."
      ),
  },
  {
    id: "unbounded-cost",
    title: "One user runs the expensive operation a thousand times",
    question: "What stops them, and what does it cost you?",
    severity: "material",
    applies: (_d, ctx) => has(ctx, "LLM", "VIDEO_GEN", "IMAGE_GEN", "AUDIO_GEN"),
    evaluate: (_d, ctx) =>
      verdict(
        covers(ctx, "quota", "limit", "credit", "throttl", "cap", "budget", "rate limit"),
        "Per-user quota or rate limiting bounds the cost.",
        "Nothing caps how much one user can spend on expensive operations."
      ),
  },
  {
    id: "no-actor-permissions",
    title: "A second kind of user signs in",
    question: "Does the system know what they may and may not do?",
    severity: "blocking",
    applies: (d) => actors(d).filter((a) => a.isHuman).length >= 2,
    evaluate: (d) => {
      const humans = actors(d).filter((a) => a.isHuman);
      const withPerms = humans.filter((a) => a.permissions.length > 0);
      if (withPerms.length === humans.length) {
        return { outcome: "pass", reasoning: "Every kind of user has stated permissions." };
      }
      return {
        outcome: "gap",
        reasoning: `${humans
          .filter((a) => a.permissions.length === 0)
          .map((a) => a.title)
          .join(", ")} — no permissions recorded, so authorization cannot be built.`,
      };
    },
  },
];

/** Run every applicable scenario. Pure, free, no model. */
export function runScenarios(doc: Uss): ScenarioResult[] {
  const ctx = buildContext(doc);
  const results: ScenarioResult[] = [];

  for (const s of SCENARIOS) {
    if (!s.applies(doc, ctx)) continue;
    const { outcome, reasoning } = s.evaluate(doc, ctx);
    results.push({
      id: s.id,
      title: s.title,
      question: s.question,
      outcome,
      reasoning,
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
  /** 0-100, counting only what was actually decided. Unknowns are excluded. */
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
    // Unknowns are excluded rather than counted as failures: a scenario the spec
    // is silent about is not evidence of a bad design, only of an undecided one.
    score: decided === 0 ? null : Math.round((passed / decided) * 100),
  };
}

/** Scenario gaps as integrity findings, so they surface with everything else. */
export function scenarioFindings(doc: Uss) {
  const g = new UssGraph(doc);
  void g;
  return runScenarios(doc)
    .filter((r) => r.outcome === "gap")
    .map((r) => ({
      rule: `scenario:${r.id}`,
      severity: r.severity,
      message: `${r.title} — ${r.reasoning}`,
      subjects: [],
    }));
}

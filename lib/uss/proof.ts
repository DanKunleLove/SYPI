import type { NodeCategory } from "@/types/canvas";
import { components } from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";

/**
 * Structural proof: what in the ARCHITECTURE demonstrates that something is handled.
 *
 * ── The rule that makes this honest ──────────────────────────────────────────
 * The haystack is ONE COMPONENT'S OWN DESCRIPTION — its title, responsibility and
 * technology. Never the concatenated spec.
 *
 * That distinction is the entire point. The previous scenario evaluator searched a
 * blob built from implications + invariants + requirements + components. But the
 * implication rulebook WRITES "payment notifications must be idempotent" into the
 * spec, and the webhook-replay scenario then searched for "idempot" and found it.
 * A rule firing made the scenario pass. The system was grading its own homework
 * and awarding itself full marks.
 *
 * Searching a component's own text is still substring matching, and this file does
 * not pretend otherwise. The difference that matters: the text is a claim the
 * ARCHITECTURE made about a SPECIFIC component ("deduplicates by provider event
 * id"), not a sentence our own rulebook wrote into the document we are grading.
 * Something was built, and it says it does this thing. That is evidence. An
 * implication saying the system ought to is not.
 */

export interface Mechanism {
  id: string;
  /** Lowercase substrings. Any one matching a component's own text is evidence. */
  terms: string[];
  /** When set, only components of these categories can demonstrate it. */
  categories?: NodeCategory[];
}

export interface Demonstration {
  componentId: string;
  componentTitle: string;
  /** The term that matched — quoted back so a pass can name its own evidence. */
  matched: string;
}

/** The text a component asserts about ITSELF. Never the whole spec. */
export function componentText(c: {
  title: string;
  responsibility?: string;
  technology?: string;
}): string {
  return `${c.title} ${c.responsibility ?? ""} ${c.technology ?? ""}`.toLowerCase();
}

/** Components whose own description demonstrates this mechanism. */
export function componentsDemonstrating(doc: Uss, m: Mechanism): Demonstration[] {
  const out: Demonstration[] = [];
  for (const c of components(doc)) {
    if (m.categories && !m.categories.includes(c.category)) continue;
    const text = componentText(c);
    const matched = m.terms.find((t) => text.includes(t));
    if (matched) out.push({ componentId: c.id, componentTitle: c.title, matched });
  }
  return out;
}

/**
 * Mechanisms, keyed so that invariant categories and scenarios share one
 * implementation. Two parts of the system disagreeing about whether something is
 * enforced is exactly the bug this replaces.
 */
export const MECHANISMS = {
  // ─── by invariant category ───────────────────────────────────────────────
  uniqueness: {
    id: "uniqueness",
    terms: ["idempot", "dedup", "duplicate", "exactly once", "unique constraint", "event id", "replay"],
  },
  conservation: {
    id: "conservation",
    terms: ["atomic", "transaction", "reserv", "lock", "balance", "ledger", "never negative", "oversell"],
  },
  authorization: {
    id: "authorization",
    terms: ["authoriz", "permission", "role", "tenant", "scope", "row level", "rls", "access control"],
  },
  lifecycle: {
    id: "lifecycle",
    terms: ["state machine", "status", "transition", "workflow", "lifecycle", "guard"],
  },
  consistency: {
    id: "consistency",
    terms: ["transaction", "atomic", "consistent", "reconcil", "sync", "integrity"],
  },
  privacy: {
    id: "privacy",
    terms: ["encrypt", "redact", "anonymi", "pii", "consent", "retention", "tenant", "row level"],
  },
  financial: {
    id: "financial",
    terms: ["signature", "webhook secret", "verif", "ledger", "reconcil", "audit", "idempot"],
  },

  // ─── by scenario ─────────────────────────────────────────────────────────
  idempotency: {
    id: "idempotency",
    terms: ["idempot", "dedup", "exactly once", "duplicate", "event id", "replay"],
    categories: ["service", "compute", "gateway"] as NodeCategory[],
  },
  "webhook-verification": {
    id: "webhook-verification",
    terms: ["signature", "webhook secret", "verif", "hmac", "provider confirm"],
    categories: ["service", "compute", "gateway"] as NodeCategory[],
  },
  "tenant-isolation": {
    id: "tenant-isolation",
    terms: ["tenant", "row level", "rls", "scope", "authoriz", "permission", "organisation id", "organization id"],
    categories: ["service", "compute", "gateway", "database"] as NodeCategory[],
  },
  resilience: {
    id: "resilience",
    terms: ["retry", "circuit", "fallback", "timeout", "degrad", "backoff"],
  },
  "atomic-allocation": {
    id: "atomic-allocation",
    terms: ["reserv", "atomic", "lock", "transaction", "oversell", "hold"],
  },
  "durable-work": {
    id: "durable-work",
    terms: ["retry", "dead letter", "persisted", "resum", "checkpoint", "job state", "recover"],
  },
  "resumable-upload": {
    id: "resumable-upload",
    terms: ["multipart", "resumable", "chunk", "presigned", "direct upload"],
    categories: ["storage", "service", "gateway", "compute"] as NodeCategory[],
  },
  "expiring-access": {
    id: "expiring-access",
    terms: ["signed", "presigned", "expir", "short-lived", "ttl"],
    categories: ["storage", "gateway", "service", "compute"] as NodeCategory[],
  },
  "data-durability": {
    id: "data-durability",
    terms: ["replica", "failover", "backup", "point-in-time", "standby", "recovery"],
    categories: ["database", "storage"] as NodeCategory[],
  },
  "output-checking": {
    id: "output-checking",
    terms: ["review", "citation", "cite", "human", "eval", "guardrail", "moderat", "confidence"],
  },
  "cost-bounding": {
    id: "cost-bounding",
    terms: ["quota", "rate limit", "credit", "throttl", "budget", "cap per", "usage limit"],
  },
} as const satisfies Record<string, Mechanism>;

export type MechanismId = keyof typeof MECHANISMS;

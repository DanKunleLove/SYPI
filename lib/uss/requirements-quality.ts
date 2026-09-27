import { nonFunctional, product, requirements } from "@/lib/uss/views";
import type { Entity, IntegrityFinding, Uss } from "@/lib/uss/schema";

/**
 * Requirement quality — are the requirements testable, and do they agree with
 * each other?
 *
 * ZERO LLM CALLS, like the rest of the deterministic layer. Kiro checks
 * requirements with a formal solver; this is deliberately humbler — pattern and
 * overlap heuristics tuned to fire only when the conflict is plain. A checker
 * that cries wolf gets ignored, so every rule here prefers a miss to a false alarm.
 */

type Requirement = Extract<Entity, { kind: "requirement" }>;

// ─── EARS ────────────────────────────────────────────────────────────────────

/**
 * The EARS templates (Easy Approach to Requirements Syntax). Each shape names
 * WHEN the behaviour applies, so a criterion in one of them reads as a test.
 */
export type EarsPattern = "ubiquitous" | "event" | "state" | "unwanted" | "optional" | "complex";

const MODAL = /\b(shall|must|will)\b/i;

export function classifyEars(text: string): EarsPattern | null {
  const t = text.trim();
  if (!MODAL.test(t)) return null;
  if (/^while\b.+\bwhen\b/i.test(t)) return "complex";
  if (/^when\b/i.test(t)) return "event";
  if (/^while\b/i.test(t)) return "state";
  if (/^if\b/i.test(t)) return "unwanted";
  if (/^where\b/i.test(t)) return "optional";
  if (/^the\b/i.test(t)) return "ubiquitous";
  return null;
}

/**
 * Words that make a criterion unfalsifiable. "Loads quickly" cannot fail a test;
 * "loads in under 2 seconds" can. Kept to words that are almost never precise in
 * a requirement — "secure" and "real-time" are left out because they are often
 * followed by the specifics that make them testable.
 */
const VAGUE_TERMS = [
  "fast",
  "quick",
  "quickly",
  "easy",
  "easily",
  "user-friendly",
  "user friendly",
  "intuitive",
  "seamless",
  "seamlessly",
  "robust",
  "efficient",
  "efficiently",
  "flexible",
  "appropriate",
  "appropriately",
  "adequate",
  "reasonable",
  "as needed",
  "as appropriate",
  "if possible",
  "as soon as possible",
  "etc",
  "and so on",
  "optimal",
  "state of the art",
  "state-of-the-art",
  "best-in-class",
  "high quality",
  "high-quality",
];

export function vagueTermsIn(text: string): string[] {
  const lower = text.toLowerCase();
  return VAGUE_TERMS.filter((term) =>
    new RegExp(`(^|[^a-z-])${term.replace(/[-]/g, "\\-")}([^a-z-]|$)`).test(lower)
  );
}

export interface CriterionQuality {
  requirementId: string;
  text: string;
  ears: EarsPattern | null;
  vague: string[];
  /** In an EARS shape and free of vague terms. */
  testable: boolean;
}

export function criteriaQuality(doc: Uss): CriterionQuality[] {
  return requirements(doc).flatMap((r) =>
    r.acceptanceCriteria.map((text) => {
      const ears = classifyEars(text);
      const vague = vagueTermsIn(text);
      return { requirementId: r.id, text, ears, vague, testable: ears !== null && vague.length === 0 };
    })
  );
}

/**
 * Share of acceptance criteria that read as tests. Null when there are no
 * criteria at all — "nothing to measure" is not the same as "0% testable", and
 * the missing-criteria case already has its own integrity finding.
 */
export function testabilityScore(doc: Uss): number | null {
  const all = criteriaQuality(doc);
  if (all.length === 0) return null;
  return Math.round((all.filter((c) => c.testable).length / all.length) * 100);
}

// ─── Contradictions ──────────────────────────────────────────────────────────

const STOPWORDS = new Set(
  "a an the and or of to in on for with by from at as is are be been being it its this that these those their there they them can could should would may might do does done into over under than then when while if where which who whom whose what how all any each every some such only also just very more most other our your his her we you i me my system user users".split(
    " "
  )
);
const NEGATION = /\b(shall not|must not|will not|cannot|can not|can't|won't|never|no longer|not allowed|prohibited|forbidden|without)\b/i;
const MODAL_WORDS = new Set(["shall", "must", "will", "not", "never", "cannot", "without", "no", "longer", "allowed", "prohibited", "forbidden"]);

/** Crude stemming: enough to match "orders"/"order", "stored"/"store". */
function stem(word: string): string {
  return word.replace(/(ing|ed|es|s)$/, "");
}

export function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !MODAL_WORDS.has(w))
      .map(stem)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Share of `small`'s tokens that appear in `big`. */
function containment(small: Set<string>, big: Set<string>): number {
  if (small.size === 0) return 0;
  let shared = 0;
  for (const t of small) if (big.has(t)) shared++;
  return shared / small.size;
}

/** Everything a requirement asserts: its statement and each criterion. */
function claimsOf(r: Requirement): string[] {
  return [r.statement, ...r.acceptanceCriteria].filter(Boolean);
}

/**
 * Pairs where one requirement says the system does X and another says it must
 * not. Needs heavy overlap on what X is — "users can delete their account" vs
 * "the system shall not delete audit records" share a verb, not a subject, and
 * must NOT fire.
 */
function polarityConflicts(reqs: Requirement[]): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < reqs.length; i++) {
    for (let j = i + 1; j < reqs.length; j++) {
      const a = reqs[i];
      const b = reqs[j];
      for (const ca of claimsOf(a)) {
        for (const cb of claimsOf(b)) {
          const negA = NEGATION.test(ca);
          const negB = NEGATION.test(cb);
          if (negA === negB) continue;
          const ta = contentTokens(ca);
          const tb = contentTokens(cb);
          if (ta.size < 2 || tb.size < 2) continue;
          if (jaccard(ta, tb) < 0.6) continue;
          const key = `${a.id}|${b.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            rule: "contradictory-requirements",
            severity: "blocking",
            message: `${a.id} and ${b.id} contradict each other: "${ca.slice(0, 90)}" vs "${cb.slice(0, 90)}"`,
            subjects: [a.id, b.id],
          });
        }
      }
    }
  }
  return out;
}

/**
 * A requirement that asks for something the product explicitly put out of
 * scope. Only `must` and `should` count — a `could` is already a maybe.
 */
function scopeConflicts(doc: Uss, reqs: Requirement[]): IntegrityFinding[] {
  const p = product(doc);
  if (!p || p.outOfScope.length === 0) return [];
  const out: IntegrityFinding[] = [];
  for (const excluded of p.outOfScope) {
    const te = contentTokens(excluded);
    if (te.size === 0) continue;
    const hits = reqs.filter(
      (r) => r.priority !== "could" && claimsOf(r).some((c) => containment(te, contentTokens(c)) >= 0.99)
    );
    if (hits.length === 0) continue;
    out.push({
      rule: "requirement-out-of-scope",
      severity: "material",
      message: `"${excluded}" is out of scope, but ${hits.map((h) => h.id).join(", ")} require${hits.length === 1 ? "s" : ""} it`,
      subjects: hits.map((h) => h.id),
    });
  }
  return out;
}

/** A metric and the number a target sets for it. Units normalised to ms / %. */
interface TargetValue {
  metric: string;
  value: number;
}

const METRICS: { metric: string; pattern: RegExp }[] = [
  { metric: "p99 latency", pattern: /\bp99\b/i },
  { metric: "p95 latency", pattern: /\bp95\b/i },
  { metric: "availability", pattern: /\b(availability|uptime|sla)\b/i },
  { metric: "RPO", pattern: /\brpo\b/i },
  { metric: "RTO", pattern: /\brto\b/i },
];

export function parseTarget(target: string): TargetValue | null {
  const metric = METRICS.find((m) => m.pattern.test(target))?.metric;
  if (!metric) return null;
  const pct = target.match(/(\d+(?:\.\d+)?)\s*%/);
  if (metric === "availability") return pct ? { metric, value: Number(pct[1]) } : null;
  const dur = target.match(/(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|sec|seconds?|m|min|minutes?|h|hours?)\b/i);
  if (!dur) return null;
  const n = Number(dur[1]);
  const unit = dur[2].toLowerCase();
  const factor = unit.startsWith("ms") || unit.startsWith("milli")
    ? 1
    : unit.startsWith("h")
      ? 3_600_000
      : unit === "m" || unit.startsWith("min")
        ? 60_000
        : 1000;
  return { metric, value: n * factor };
}

/** Two non-functional requirements setting different numbers for one metric. */
function targetConflicts(doc: Uss): IntegrityFinding[] {
  const byMetric = new Map<string, { id: string; value: number; raw: string }[]>();
  for (const r of nonFunctional(doc)) {
    if (!r.target) continue;
    const parsed = parseTarget(r.target);
    if (!parsed) continue;
    const list = byMetric.get(parsed.metric) ?? [];
    list.push({ id: r.id, value: parsed.value, raw: r.target });
    byMetric.set(parsed.metric, list);
  }
  const out: IntegrityFinding[] = [];
  for (const [metric, list] of byMetric) {
    const distinct = new Set(list.map((l) => l.value));
    if (distinct.size < 2) continue;
    out.push({
      rule: "conflicting-targets",
      severity: "material",
      message: `${list.length} requirements set different ${metric} targets: ${list
        .map((l) => `${l.id} "${l.raw}"`)
        .join(", ")}. Pick one.`,
      subjects: list.map((l) => l.id),
    });
  }
  return out;
}

/** Vague words in acceptance criteria — one finding, listing the offenders. */
function vagueCriteria(doc: Uss): IntegrityFinding[] {
  const vague = criteriaQuality(doc).filter((c) => c.vague.length > 0);
  if (vague.length === 0) return [];
  const words = [...new Set(vague.flatMap((v) => v.vague))];
  return [
    {
      rule: "vague-criteria",
      severity: "material",
      message: `${vague.length} acceptance criteria use words no test can check (${words
        .slice(0, 5)
        .join(", ")}). Replace them with a number or an observable result.`,
      subjects: [...new Set(vague.map((v) => v.requirementId))].slice(0, 20),
    },
  ];
}

/** Every requirement-quality finding. Pure. */
export function checkRequirementQuality(doc: Uss): IntegrityFinding[] {
  const reqs = requirements(doc);
  return [
    ...polarityConflicts(reqs),
    ...scopeConflicts(doc, reqs),
    ...targetConflicts(doc),
    ...vagueCriteria(doc),
  ];
}

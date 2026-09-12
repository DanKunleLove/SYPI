import type { ArchitectureOutput } from "@/lib/ai/schemas";
import type { Uss } from "@/lib/uss/schema";
import {
  assumptions,
  constraints,
  implications,
  openDecisions,
  requirements,
} from "@/lib/uss/views";
import { ruleCoverage } from "@/lib/uss/reasoning";
import type { Brief, Detector, DimensionScore } from "./types";

/**
 * Deterministic scorers.
 *
 * These run over an ArchitectureOutput today (baseline mode) and will run over a
 * USS graph from Unit 1 onward. Dimensions that genuinely cannot be computed from
 * an ArchitectureOutput return `{ score: null, measurable: false }`. That is not
 * pedantry: an ArchitectureOutput has no evidence, status, assumption or open-decision
 * fields, so scoring those 0 today would manufacture a fake improvement the moment
 * the USS lands. We want Unit 1's gain to be real.
 */

// ─── Text extraction ─────────────────────────────────────────────────────────

/** Every piece of text the model produced, lowercased, for substring detection. */
export function architectureText(arch: ArchitectureOutput): string {
  const parts: string[] = [arch.reasoning];
  for (const n of arch.nodes) {
    parts.push(n.label, n.category, n.description ?? "");
    for (const [k, v] of Object.entries(n)) {
      if (k.startsWith("config") && typeof v === "string") parts.push(v);
    }
  }
  for (const e of arch.edges) {
    parts.push(e.sourceLabel, e.targetLabel, e.label ?? "");
  }
  return parts.join(" \n ").toLowerCase();
}

function matches(detector: Detector, text: string, categories: Set<string>): boolean {
  if (detector.categories?.some((c) => categories.has(c))) return true;
  if (detector.all && detector.all.length > 0) {
    return detector.all.every((t) => text.includes(t.toLowerCase()));
  }
  if (detector.any && detector.any.length > 0) {
    const hits = detector.any.filter((t) => text.includes(t.toLowerCase())).length;
    return hits >= (detector.minMatches ?? 1);
  }
  return false;
}

const SEVERITY_WEIGHT = { critical: 3, important: 2, nice: 1 } as const;

// ─── Deterministic dimensions ────────────────────────────────────────────────

export function scoreExpectedProperties(
  brief: Brief,
  arch: ArchitectureOutput
): DimensionScore {
  const text = architectureText(arch);
  const cats = new Set(arch.nodes.map((n) => n.category));

  let earned = 0;
  let total = 0;
  const missed: string[] = [];

  for (const p of brief.properties) {
    const w = SEVERITY_WEIGHT[p.severity];
    total += w;
    if (matches(p.detect, text, cats)) earned += w;
    else missed.push(`${p.severity === "critical" ? "!" : ""}${p.id}`);
  }

  return {
    dimension: "expected-properties",
    kind: "deterministic",
    measurable: true,
    score: total === 0 ? 100 : Math.round((earned / total) * 100),
    detail: missed.length ? `missing: ${missed.join(", ")}` : "all properties present",
  };
}

export function scoreRequirementsCompleteness(
  brief: Brief,
  arch: ArchitectureOutput
): DimensionScore {
  const text = architectureText(arch);
  const covered: string[] = [];
  const uncovered: string[] = [];

  for (const area of brief.ambiguityAreas) {
    const hit = area.keywords.some((k) => text.includes(k.toLowerCase()));
    (hit ? covered : uncovered).push(area.id);
  }

  const total = brief.ambiguityAreas.length;
  return {
    dimension: "requirements-completeness",
    kind: "deterministic",
    measurable: true,
    score: total === 0 ? 100 : Math.round((covered.length / total) * 100),
    detail: `${covered.length}/${total} question areas addressed${
      uncovered.length ? ` — silent on: ${uncovered.join(", ")}` : ""
    }`,
  };
}

export function scoreSimplicity(brief: Brief, arch: ArchitectureOutput): DimensionScore {
  const n = arch.nodes.length;
  const { min, max } = brief.componentBudget;

  let score: number;
  let detail: string;

  if (n > max) {
    // Over budget: lose 12 points per excess component. Over-engineering is the
    // failure mode this benchmark exists to catch, so the penalty is steep.
    score = Math.max(0, 100 - (n - max) * 12);
    detail = `${n} components vs budget ${min}-${max} — OVER by ${n - max}`;
  } else if (n < min) {
    // Under budget usually means the design skipped something real.
    score = Math.max(0, 100 - (min - n) * 10);
    detail = `${n} components vs budget ${min}-${max} — under by ${min - n}`;
  } else {
    score = 100;
    detail = `${n} components, within budget ${min}-${max}`;
  }

  return { dimension: "simplicity", kind: "deterministic", measurable: true, score, detail };
}

export function scoreOverEngineering(brief: Brief, arch: ArchitectureOutput): DimensionScore {
  const text = architectureText(arch);
  const hits = brief.forbidden.filter((f) =>
    f.keywords.some((k) => text.includes(k.toLowerCase()))
  );

  // 100 = clean. Each forbidden pattern present costs 25.
  const score = Math.max(0, 100 - hits.length * 25);
  return {
    dimension: "over-engineering",
    kind: "deterministic",
    measurable: true,
    score,
    detail: hits.length
      ? `unjustified for this tier: ${hits.map((h) => h.id).join(", ")}`
      : brief.forbidden.length
        ? "no forbidden patterns present"
        : "no forbidden patterns defined for this brief",
  };
}

export function scoreConnectivity(arch: ArchitectureOutput): DimensionScore {
  const labels = new Set(arch.nodes.map((n) => n.label));
  const connected = new Set<string>();
  let danglingEdges = 0;

  for (const e of arch.edges) {
    if (labels.has(e.sourceLabel)) connected.add(e.sourceLabel);
    else danglingEdges++;
    if (labels.has(e.targetLabel)) connected.add(e.targetLabel);
    else danglingEdges++;
  }

  const orphans = arch.nodes.filter((n) => !connected.has(n.label));
  const total = arch.nodes.length;
  const base = total === 0 ? 0 : Math.round(((total - orphans.length) / total) * 100);
  // A dangling edge endpoint is a referential-integrity failure the model produced.
  const score = Math.max(0, base - danglingEdges * 10);

  return {
    dimension: "connectivity",
    kind: "deterministic",
    measurable: true,
    score,
    detail:
      (orphans.length ? `orphan components: ${orphans.map((o) => o.label).join(", ")}` : "every component connected") +
      (danglingEdges ? ` | ${danglingEdges} edge endpoint(s) reference a non-existent component` : ""),
  };
}

export function scoreEdgeLabelling(arch: ArchitectureOutput): DimensionScore {
  const total = arch.edges.length;
  const labelled = arch.edges.filter((e) => (e.label ?? "").trim().length > 0).length;
  return {
    dimension: "edge-labelling",
    kind: "deterministic",
    measurable: true,
    score: total === 0 ? 0 : Math.round((labelled / total) * 100),
    detail: `${labelled}/${total} connections describe what actually flows`,
  };
}

// ─── Dimensions that require the USS (Unit 1+) ───────────────────────────────

const NOT_YET = (dimension: string, why: string): DimensionScore => ({
  dimension,
  kind: "deterministic",
  measurable: false,
  score: null,
  detail: `not measurable in architecture mode — ${why}`,
});

export function ussOnlyDimensions(): DimensionScore[] {
  return [
    NOT_YET("traceability", "no requirement→component relations exist"),
    NOT_YET("hallucination-rate", "no evidence/status fields to check claims against"),
    NOT_YET("unsupported-assumptions", "assumptions are not represented"),
    NOT_YET("unresolved-decisions", "open decisions are not surfaced at all"),
    NOT_YET("domain-correctness", "no domain entities or lifecycles are produced"),
    NOT_YET("data-correctness", "no ownership or transaction boundaries are produced"),
  ];
}

/**
 * Dimensions that become measurable once a USS exists.
 *
 * These REPLACE the corresponding NOT_YET entries. A first score here is a new
 * measurement, not an improvement over zero — `--compare` labels it as such,
 * because claiming a jump from 0 to 80 would be self-flattery, not progress.
 */
export function scoreUss(
  brief: Brief,
  doc: Uss,
  arch: ArchitectureOutput
): DimensionScore[] {
  const out: DimensionScore[] = [];
  const text = architectureText(arch);

  // Requirements coverage: did the spec capture the question areas the brief hides?
  const covered = brief.ambiguityAreas.filter((area) => {
    const haystack = (
      requirements(doc).map((r) => `${r.title} ${r.statement}`).join(" ") +
      openDecisions(doc).map((d) => `${d.question} ${d.title}`).join(" ") +
      constraints(doc).map((c) => c.statement).join(" ") +
      implications(doc).map((i) => i.statement).join(" ")
    ).toLowerCase();
    return area.keywords.some((k) => haystack.includes(k.toLowerCase()));
  });
  out.push({
    dimension: "spec-question-coverage",
    kind: "deterministic",
    measurable: true,
    score: brief.ambiguityAreas.length
      ? Math.round((covered.length / brief.ambiguityAreas.length) * 100)
      : 100,
    detail: `${covered.length}/${brief.ambiguityAreas.length} question areas raised by the spec`,
  });

  // Traceability: do generated components correspond to something required?
  const reqText = requirements(doc)
    .map((r) => `${r.title} ${r.statement}`)
    .join(" ")
    .toLowerCase();
  const implText = implications(doc).map((i) => i.statement).join(" ").toLowerCase();
  const traced = arch.nodes.filter((n) => {
    const words = n.label.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    return words.some((w) => reqText.includes(w) || implText.includes(w));
  });
  out.push({
    dimension: "traceability",
    kind: "deterministic",
    measurable: true,
    score: arch.nodes.length ? Math.round((traced.length / arch.nodes.length) * 100) : 0,
    detail: `${traced.length}/${arch.nodes.length} components trace to a requirement or implication`,
  });

  // Hallucination: entities asserted as fact with nothing backing them.
  const claimed = doc.entities.length;
  const unfounded = doc.entities.filter(
    (e) => e.status === "KNOWN" && e.evidence.length === 0
  ).length;
  out.push({
    dimension: "hallucination-rate",
    kind: "deterministic",
    measurable: true,
    // Inverted: 100 = nothing asserted without evidence.
    score: claimed === 0 ? 100 : Math.round(((claimed - unfounded) / claimed) * 100),
    detail: `${unfounded}/${claimed} entities claimed KNOWN with no evidence`,
  });

  // Unsupported assumptions: recorded ones are fine; SILENT ones are the problem.
  const assumptionCount = assumptions(doc).length;
  const surfaced = assumptions(doc).filter((a) => text.includes(a.statement.toLowerCase().slice(0, 25)));
  out.push({
    dimension: "unsupported-assumptions",
    kind: "deterministic",
    measurable: true,
    score: assumptionCount === 0 ? 100 : Math.round((surfaced.length / assumptionCount) * 100),
    detail:
      assumptionCount === 0
        ? "no assumptions recorded"
        : `${surfaced.length}/${assumptionCount} recorded assumptions visible in the output`,
  });

  // Unresolved critical decisions: blocking questions left unsurfaced.
  const blocking = openDecisions(doc).filter((d) => d.impact.severity === "blocking");
  out.push({
    dimension: "unresolved-decisions",
    kind: "deterministic",
    measurable: true,
    // Surfacing blockers is GOOD; this scores whether they were found at all.
    score: blocking.length > 0 ? 100 : 50,
    detail:
      blocking.length > 0
        ? `${blocking.length} blocking question(s) surfaced for the user`
        : "no blocking questions surfaced — either genuinely complete, or the gaps were missed",
  });

  // Reasoning depth: how much of the design was derived rather than guessed.
  const coverage = ruleCoverage(doc);
  out.push({
    dimension: "reasoning-depth",
    kind: "deterministic",
    measurable: true,
    score: Math.min(100, implications(doc).length * 10),
    detail: `${coverage.total} implications derived (${coverage.pct}% by rule, not by model)`,
  });

  return out;
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

export function scoreArchitecture(brief: Brief, arch: ArchitectureOutput): DimensionScore[] {
  return [
    scoreRequirementsCompleteness(brief, arch),
    scoreExpectedProperties(brief, arch),
    scoreSimplicity(brief, arch),
    scoreOverEngineering(brief, arch),
    scoreConnectivity(arch),
    scoreEdgeLabelling(arch),
    ...ussOnlyDimensions(),
  ];
}

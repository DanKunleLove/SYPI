import type { ArchitectureOutput } from "@/lib/ai/schemas";
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

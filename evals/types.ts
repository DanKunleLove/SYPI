/**
 * Evaluation harness types.
 *
 * The harness measures the QUALITY OF REASONING, not the transport: it calls the
 * generation pipeline's functions directly rather than going over HTTP, so no auth,
 * no quota, and no deployment is involved.
 *
 * The single most important rule in this file is the `measurable` flag on
 * DimensionScore. Several dimensions cannot be computed at all before the USS
 * exists (nothing in an ArchitectureOutput records evidence, assumptions, or open
 * decisions). Those MUST report `measurable: false` / `score: null` — never 0.
 * Scoring them 0 today would make Unit 1 look like a miracle when all it did was
 * start measuring something new. Averages skip unmeasurable dimensions.
 */

import type { NodeCategory } from "@/types/canvas";

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** How we detect that a design acknowledged a property, from its text. */
export interface Detector {
  /** Case-insensitive substrings; ANY match counts. */
  any?: string[];
  /** Case-insensitive substrings; ALL must appear. */
  all?: string[];
  /** At least one component of one of these categories must exist. */
  categories?: NodeCategory[];
  /** Minimum number of distinct `any` terms that must match (default 1). */
  minMatches?: number;
}

export interface ExpectedProperty {
  id: string;
  /** What a senior engineer would expect the design to demonstrate. */
  label: string;
  detect: Detector;
  severity: "critical" | "important" | "nice";
}

/** A question area a senior engineer must raise before designing. */
export interface AmbiguityArea {
  id: string;
  label: string;
  /** Terms that indicate the area was addressed somewhere in the output. */
  keywords: string[];
}

/** Technology that would be over-engineering for this brief. */
export interface ForbiddenPattern {
  id: string;
  label: string;
  keywords: string[];
}

export interface Brief {
  id: string;
  title: string;
  /** Written the way a client actually talks — vague, incomplete, non-technical. */
  brief: string;
  /** Expected complexity tier 0-5 (script → mission-critical). */
  expectedTier: number;
  /** Component-count budget. Exceeding `max` is over-engineering. */
  componentBudget: { min: number; max: number };
  properties: ExpectedProperty[];
  ambiguityAreas: AmbiguityArea[];
  forbidden: ForbiddenPattern[];
}

// ─── Results ─────────────────────────────────────────────────────────────────

export type ScoreMode = "architecture" | "uss";

export interface DimensionScore {
  dimension: string;
  /** 0-100, or null when this dimension cannot be measured in the current mode. */
  score: number | null;
  /** False = not measurable yet. Never conflate with a score of 0. */
  measurable: boolean;
  /** Deterministic scorer, or LLM judge. */
  kind: "deterministic" | "judge";
  detail: string;
}

export interface BriefResult {
  briefId: string;
  title: string;
  ok: boolean;
  error?: string;
  /** Milliseconds for the generation call. */
  latencyMs?: number;
  componentCount?: number;
  edgeCount?: number;
  scores: DimensionScore[];
  /** The raw output, kept so a regression can be diffed rather than guessed at. */
  raw?: unknown;
}

export interface EvalReport {
  /** ISO timestamp. */
  runAt: string;
  mode: ScoreMode;
  /** Resolved model id — a baseline is meaningless without it. */
  model: string;
  judgeModel: string | null;
  runs: number;
  gitCommit: string;
  /**
   * Was the USS understanding chain run? Comparing a report across conditions is
   * meaningless -- a no-USS run diffed against a USS baseline reads as a
   * catastrophic regression when nothing regressed at all.
   */
  ussEnabled: boolean;
  results: BriefResult[];
  /** Per-dimension mean across briefs, skipping unmeasurable entries. */
  summary: Record<string, { mean: number | null; measuredIn: number; of: number }>;
}

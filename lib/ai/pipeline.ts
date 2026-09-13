/**
 * The design pipeline, as DATA.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 * The whole reasoning chain used to live inside one request in
 * `app/api/ai/generate/route.ts`: five extraction calls, a design call, a
 * critique and a repair, back to back. On Vercel Hobby a function is killed at
 * 60 seconds, so that request could never have finished — and it never had a
 * caller to find out.
 *
 * Under a hard ceiling the client has to orchestrate and the server has to do
 * ONE bounded unit of work per request. That is not a workaround: it is also
 * exactly what makes the work visible. The user sees the whole plan up front,
 * watches each step tick over, and can retry a single failed step instead of
 * losing four minutes of work.
 *
 * ── The rule that keeps this extensible ──────────────────────────────────────
 * The steps are a table, consumed by a `switch` on the server and a `for` on the
 * client. Adding a step — cost, timeline, launch plan — must stay "append a row
 * and add a case". The moment the client hardcodes an order, every future step
 * becomes a rewrite. Nothing in the UI may branch on a specific step id.
 *
 * ── Why the steps are this small ─────────────────────────────────────────────
 * Measured on nemotron-3-super (scripts/time-pipeline.ts), one call per step:
 *
 *   intent 31s · complexity 30s · requirements 48s · capabilities 51s
 *   domain 33s · design 78s · critique 30s · repair 42s · record 10s
 *
 * `intent` originally did intent AND complexity in one request: 61s, over the
 * ceiling. `critique` did the review AND the repair: 72s, over the ceiling. Both
 * are split here for that reason and no other.
 *
 * `design` is ONE generateObject call and cannot be split further. At 78s on
 * nemotron it does not fit, and that is a real limit of running a slow reasoning
 * model on Hobby — not something more steps can fix. On Gemini flash, the
 * platform default, the same call runs in roughly a third of that. An admin
 * choosing a slower platform model at /admin/ai is choosing this risk.
 */

export const PIPELINE_STEPS = [
  {
    id: "start",
    /** Shown to the user. An outcome, never an internal pass name. */
    label: "Getting started",
    /** No model call — runs in milliseconds, so it gets no row in the UI. */
    deterministic: true,
  },
  {
    id: "intent",
    label: "Working out what you're building",
    deterministic: false,
  },
  {
    id: "complexity",
    label: "Sizing the project",
    deterministic: false,
  },
  {
    id: "requirements",
    label: "Writing down what it has to do",
    deterministic: false,
  },
  {
    id: "capabilities",
    label: "Working out what it needs to be able to do",
    deterministic: false,
  },
  {
    id: "domain",
    label: "Modelling the business rules",
    deterministic: false,
  },
  {
    id: "design",
    label: "Designing the architecture",
    deterministic: false,
  },
  {
    id: "critique",
    label: "Checking it over",
    deterministic: false,
  },
  {
    id: "repair",
    label: "Fixing what the review found",
    deterministic: false,
  },
  {
    id: "record",
    label: "Recording the design",
    deterministic: true,
  },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]["id"];

export const PIPELINE_STEP_IDS = PIPELINE_STEPS.map((s) => s.id) as readonly PipelineStepId[];

export function isPipelineStep(value: unknown): value is PipelineStepId {
  return typeof value === "string" && (PIPELINE_STEP_IDS as readonly string[]).includes(value);
}

export function stepLabel(id: PipelineStepId): string {
  return PIPELINE_STEPS.find((s) => s.id === id)?.label ?? id;
}

/** The step after this one, or null when the run is complete. */
export function nextStep(current: PipelineStepId): PipelineStepId | null {
  const i = PIPELINE_STEP_IDS.indexOf(current);
  if (i < 0 || i === PIPELINE_STEP_IDS.length - 1) return null;
  return PIPELINE_STEP_IDS[i + 1];
}

export const FIRST_STEP: PipelineStepId = PIPELINE_STEP_IDS[0];

// ─── Per-step state, shared by the runner and the UI ─────────────────────────

export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface PipelineStepState {
  id: PipelineStepId;
  label: string;
  status: StepStatus;
  /** One line of what actually happened — "5 requirements, 2 unknowns". */
  detail?: string;
  error?: string;
  ms?: number;
}

/** Every step pending. Seeded at run start so the user sees the plan up front. */
export function initialSteps(): PipelineStepState[] {
  return PIPELINE_STEPS.map((s) => ({ id: s.id, label: s.label, status: "pending" as const }));
}

/**
 * Steps worth showing. `start` and `record` are sub-second bookkeeping; a row
 * that appears and vanishes reads as noise, not as progress.
 */
export function visibleSteps(steps: PipelineStepState[]): PipelineStepState[] {
  const hidden = new Set<string>(PIPELINE_STEPS.filter((s) => s.deterministic).map((s) => s.id));
  return steps.filter((s) => !hidden.has(s.id) || s.status === "failed");
}

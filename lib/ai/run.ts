import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { checkAiQuota, type AiKind } from "@/lib/ai/limits";

/**
 * Multi-request runs.
 *
 * A design pipeline, a System Kit and a hand-off are all now several HTTP
 * requests rather than one, because a Vercel Hobby function dies at 60 seconds.
 * That raises two questions this module answers:
 *
 *   1. WHAT IS CHARGED. The run is charged once, at `startRun`. The steps are
 *      free. Otherwise a seven-file Kit would eat seven of the user's ten daily
 *      Kit credits and the cap would silently mean "one Kit and a bit".
 *
 *   2. WHAT STOPS A REPLAY. If steps are free and the client names the run, a
 *      client could replay an old runId forever and get unmetered model calls.
 *      `loadRun` refuses a run that is finished, belongs to another project, or
 *      is older than the window. That is the whole security model, so it is
 *      deliberately strict rather than convenient.
 *
 * No migration: `AIGeneration` already is a run record — projectId, prompt,
 * type, status, result, error, rating. Reusing its id as the runId also keeps
 * revert/restore/rate and /api/ai/feedback working untouched.
 */

/** A run must finish inside this, or its steps stop being free. */
const RUN_WINDOW_MS = 15 * 60_000;

export type RunKind = "pipeline" | "kit" | "handoff";

/** Which quota pool each kind of run draws on. */
const QUOTA_FOR: Record<RunKind, AiKind> = {
  pipeline: "generate",
  kit: "kit",
  // Same cost shape as a Kit — several sequential document generations.
  handoff: "kit",
};

export interface RunRecord {
  id: string;
  projectId: string;
  /** The brief, held server-side so it cannot change between steps. */
  brief: string;
  kind: RunKind;
  steps: Record<string, StepRecord>;
  /** Scratch space between steps — the draft architecture, the chosen domain. */
  meta: Record<string, unknown>;
}

export interface StepRecord {
  status: "running" | "done" | "skipped" | "failed";
  detail?: string;
  error?: string;
  ms?: number;
}

interface RunResultShape {
  kind?: RunKind;
  steps?: Record<string, StepRecord>;
  meta?: Record<string, unknown>;
}

function shape(row: { id: string; projectId: string; prompt: string; result: unknown }): RunRecord {
  const result = (row.result ?? {}) as RunResultShape;
  return {
    id: row.id,
    projectId: row.projectId,
    brief: row.prompt,
    kind: result.kind ?? "pipeline",
    steps: result.steps ?? {},
    meta: result.meta ?? {},
  };
}

/**
 * Begin a run. Charges quota ONCE — every step afterwards is free.
 * Returns a string error rather than throwing, so agent tools can surface it.
 */
export async function startRun(params: {
  projectId: string;
  userId: string;
  kind: RunKind;
  brief: string;
  meta?: Record<string, unknown>;
  /** The run makes no model calls (every file is deterministic), so charge nothing. */
  free?: boolean;
}): Promise<{ ok: true; run: RunRecord } | { ok: false; error: string; retryAfter: number }> {
  if (!params.free) {
    const quota = await checkAiQuota(params.userId, QUOTA_FOR[params.kind]);
    if (!quota.ok) return quota;
  }

  const row = await prisma.aIGeneration.create({
    data: {
      projectId: params.projectId,
      prompt: params.brief.slice(0, 4000),
      type: params.kind,
      status: "running",
      result: {
        kind: params.kind,
        steps: {},
        meta: params.meta ?? {},
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return { ok: true, run: shape(row) };
}

/**
 * Load a run that is still entitled to spend model calls.
 *
 * Every rejection here is a case where continuing would hand out unmetered
 * calls: a finished run, another project's run, or one old enough that its
 * single quota charge no longer plausibly covers the work being asked for.
 */
export type LoadRunFailure = "NOT_FOUND" | "WRONG_PROJECT" | "FINISHED" | "EXPIRED";

export async function loadRun(
  runId: string,
  projectId: string
): Promise<
  { ok: true; run: RunRecord } | { ok: false; error: string; code: LoadRunFailure }
> {
  const row = await prisma.aIGeneration.findUnique({ where: { id: runId } });

  if (!row) return { ok: false, code: "NOT_FOUND", error: "That run no longer exists — start again." };
  if (row.projectId !== projectId) {
    return { ok: false, code: "WRONG_PROJECT", error: "That run belongs to a different project." };
  }
  if (row.status !== "running") {
    return { ok: false, code: "FINISHED", error: "That run has already finished — start a new one." };
  }
  if (Date.now() - row.createdAt.getTime() > RUN_WINDOW_MS) {
    return { ok: false, code: "EXPIRED", error: "That run timed out. Start again." };
  }

  return { ok: true, run: shape(row) };
}

/**
 * Read a run for display, whatever its state. `loadRun` refuses finished or
 * expired runs because continuing them would be unmetered; observing one is
 * harmless, so progress queries use this instead.
 */
export async function readRun(
  runId: string,
  projectId: string
): Promise<{ run: RunRecord; status: string; error: string | null; createdAt: Date } | null> {
  const row = await prisma.aIGeneration.findUnique({ where: { id: runId } });
  if (!row || row.projectId !== projectId) return null;
  return { run: shape(row), status: row.status, error: row.error, createdAt: row.createdAt };
}

/** How long one claimed step may run before another caller may take it over. */
export const STEP_LEASE_MS = 90_000;

/**
 * Claim a step for execution — atomically.
 *
 * `markStep` is read-modify-write, which is fine while ONE client walks a run
 * in order, as the browser does. An MCP host is different: a chat client can
 * retry a tool call, or issue two at once, and two executors on the same step
 * would each spend a model call and each commit to the spec.
 *
 * The claim is a single conditional UPDATE, so exactly one caller wins. A step
 * that is already done or skipped is never re-claimed (the caller replays its
 * stored result instead), and a step another caller is running stays theirs until
 * the lease lapses — which is what lets a crashed function be retried at all.
 */
export async function claimStep(
  runId: string,
  stepId: string,
  leaseMs: number = STEP_LEASE_MS
): Promise<boolean> {
  const now = Date.now();
  const staleBefore = now - leaseMs;
  const claimed = JSON.stringify({ status: "running", claimedAt: now });

  const updated = await prisma.$executeRaw`
    UPDATE "AIGeneration"
    SET "result" = jsonb_set(
      jsonb_set(COALESCE("result", '{}'::jsonb), '{steps}', COALESCE("result"->'steps', '{}'::jsonb)),
      ARRAY['steps', ${stepId}::text],
      ${claimed}::jsonb
    )
    WHERE "id" = ${runId}
      AND "status" = 'running'
      AND COALESCE("result"->'steps'->${stepId}::text->>'status', '') NOT IN ('done', 'skipped')
      AND NOT (
        COALESCE("result"->'steps'->${stepId}::text->>'status', '') = 'running'
        AND COALESCE(("result"->'steps'->${stepId}::text->>'claimedAt')::bigint, 0) > ${staleBefore}
      )
  `;
  return updated === 1;
}

/** Record what happened in one step. Merges, never replaces. */
export async function markStep(
  runId: string,
  stepId: string,
  patch: StepRecord,
  meta?: Record<string, unknown>
): Promise<void> {
  const row = await prisma.aIGeneration.findUnique({ where: { id: runId } });
  if (!row) return;
  const result = (row.result ?? {}) as RunResultShape;

  await prisma.aIGeneration.update({
    where: { id: runId },
    data: {
      result: {
        ...result,
        steps: { ...(result.steps ?? {}), [stepId]: patch },
        meta: { ...(result.meta ?? {}), ...(meta ?? {}) },
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function finishRun(
  runId: string,
  status: "completed" | "failed",
  error?: string
): Promise<void> {
  await prisma.aIGeneration.update({
    where: { id: runId },
    data: { status, ...(error ? { error: error.slice(0, 1000) } : {}) },
  });
}

/**
 * The most recent resumable run for a project.
 *
 * Client orchestration's real cost is a closed tab mid-run. Every step commits
 * to the spec, so resuming is genuinely free — but only if the user is offered
 * it, which is why this exists rather than being a nice-to-have.
 */
export async function findResumableRun(
  projectId: string,
  kind: RunKind
): Promise<RunRecord | null> {
  const row = await prisma.aIGeneration.findFirst({
    where: {
      projectId,
      type: kind,
      status: "running",
      createdAt: { gte: new Date(Date.now() - RUN_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? shape(row) : null;
}

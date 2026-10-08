import { PIPELINE_STEPS, type PipelineStepId } from "@/lib/ai/pipeline";
import { beginPipelineRun, executeStep, MAX_BRIEF_CHARS } from "@/lib/ai/pipeline-run";
import { specSummary } from "@/lib/ai/pipeline-steps";
import {
  claimStep,
  findResumableRun,
  loadRun,
  readRun,
  type RunRecord,
} from "@/lib/ai/run";
import { getProjectAccessForUser, canEditProject } from "@/lib/project-access";
import { getSpec } from "@/lib/uss/store";
import { classifyStepError, accessError, toolError } from "@/lib/mcp/errors";

/**
 * Planning from a chat host: the actor-based half of start_plan / continue_plan
 * / get_run.
 *
 * Execution is CLIENT-DRIVEN, as the plan requires: `continue_plan` performs
 * exactly one bounded step and says what is next. Closing the chat pauses the
 * work; polling `get_run` never advances it. Nothing here is a background job.
 */

type Actor = { id: string; email: string };

const STEP_ORDER: PipelineStepId[] = PIPELINE_STEPS.map((s) => s.id).filter(
  (id) => id !== "start"
);

/** The first step that has not landed, or null when every step has. */
export function firstIncompleteStep(steps: RunRecord["steps"]): PipelineStepId | null {
  for (const id of STEP_ORDER) {
    const s = steps[id];
    if (!s || (s.status !== "done" && s.status !== "skipped")) return id;
  }
  return null;
}

function progress(run: RunRecord) {
  return PIPELINE_STEPS.filter((s) => !s.deterministic || s.id === "record").map((s) => ({
    step: s.id,
    label: s.label,
    status: run.steps[s.id]?.status ?? "pending",
    detail: run.steps[s.id]?.detail,
    error: run.steps[s.id]?.error,
  }));
}

async function authorise(actor: Actor, projectId: string) {
  const access = await getProjectAccessForUser(projectId, actor);
  if (!access.project) return { error: accessError(access.reason) };
  if (!canEditProject(access.role)) {
    return {
      error: toolError("FORBIDDEN", "Viewers can read a project but cannot run planning."),
    };
  }
  return { project: access.project };
}

async function startPlan(actor: Actor, projectId: string, brief: string) {
  const auth = await authorise(actor, projectId);
  if (auth.error) return auth.error;

  const text = brief.trim();
  if (!text) return toolError("BAD_REQUEST", "brief is required.");
  if (text.length > MAX_BRIEF_CHARS) {
    return toolError("BAD_REQUEST", `Brief too long (max ${MAX_BRIEF_CHARS} characters).`);
  }

  // A retried start_plan — the host timed out and sent it again — must not charge
  // twice or fork the run. Same brief, same project, still-live run: resume it.
  const existing = await findResumableRun(projectId, "pipeline");
  if (existing && existing.brief === text.slice(0, 4000) && existing.meta.startedBy === actor.id) {
    return {
      ok: true as const,
      resumed: true,
      run: existing,
    };
  }

  const started = await beginPipelineRun({ projectId, userId: actor.id, brief: text });
  if (!started.ok) {
    return toolError("QUOTA_EXCEEDED", started.error, started.retryAfter || undefined);
  }
  return { ok: true as const, resumed: false, run: started.run };
}

export async function startPlanResult(actor: Actor, projectId: string, brief: string) {
  const started = await startPlan(actor, projectId, brief);
  if ("isError" in started) return started;
  const { run, resumed } = started;
  const record = await getSpec(projectId);
  return {
    projectId,
    runId: run.id,
    resumed,
    version: record?.version ?? null,
    nextAction: {
      tool: "continue_plan",
      args: { projectId, runId: run.id },
      step: firstIncompleteStep(run.steps),
    },
    steps: progress(run),
  };
}

export async function continuePlan(actor: Actor, projectId: string, runId: string) {
  const auth = await authorise(actor, projectId);
  if (auth.error) return auth.error;

  const observed = await readRun(runId, projectId);
  if (!observed) return toolError("NOT_FOUND", "No such run in this project.");
  if (observed.run.meta.startedBy && observed.run.meta.startedBy !== actor.id) {
    return toolError("FORBIDDEN", "That run was started by someone else.");
  }
  if (observed.status === "completed") {
    return { done: true as const, run: observed.run, alreadyComplete: true };
  }

  const loaded = await loadRun(runId, projectId);
  if (!loaded.ok) {
    return toolError(
      loaded.code === "NOT_FOUND" || loaded.code === "WRONG_PROJECT" ? "NOT_FOUND" : "RUN_EXPIRED",
      loaded.error
    );
  }
  const run = loaded.run;

  const step = firstIncompleteStep(run.steps);
  if (!step) return { done: true as const, run, alreadyComplete: true };

  if (!(await claimStep(runId, step))) {
    return toolError(
      "STEP_IN_PROGRESS",
      `The "${step}" step is already running. Wait a moment and call continue_plan again.`,
      15
    );
  }

  const result = await executeStep({
    step: step as Exclude<PipelineStepId, "start">,
    projectId,
    userId: actor.id,
    run,
  });

  if (!result.ok) {
    return toolError(
      classifyStepError(result.error),
      `The "${step}" step failed: ${result.error.slice(0, 300)}. Calling continue_plan again retries it.`,
      10
    );
  }

  const after = await readRun(runId, projectId);
  const record = await getSpec(projectId);
  return {
    done: result.nextStep === null,
    step: result.step,
    detail: result.detail,
    skipped: result.skipped,
    ms: result.ms,
    run: after?.run ?? run,
    spec: record ? specSummary(record.doc) : null,
    version: record?.version ?? null,
  };
}

export async function getRunResult(actor: Actor, projectId: string, runId: string) {
  const access = await getProjectAccessForUser(projectId, actor);
  if (!access.project) return accessError(access.reason);

  const observed = await readRun(runId, projectId);
  if (!observed) return toolError("NOT_FOUND", "No such run in this project.");

  const record = await getSpec(projectId);
  const next = observed.status === "running" ? firstIncompleteStep(observed.run.steps) : null;
  return {
    projectId,
    runId,
    status: observed.status,
    error: observed.error,
    version: record?.version ?? null,
    steps: progress(observed.run),
    nextAction: next
      ? { tool: "continue_plan", args: { projectId, runId }, step: next }
      : null,
  };
}

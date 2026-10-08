import { nextStep, type PipelineStepId } from "@/lib/ai/pipeline";
import { runStep, type StepOutcome } from "@/lib/ai/pipeline-steps";
import { finishRun, markStep, startRun, type RunRecord } from "@/lib/ai/run";
import { extractUrls, researchSite } from "@/lib/ai/url-research";
import { getOrCreateSpec } from "@/lib/uss/store";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

/**
 * The design pipeline as a service taking an authenticated ACTOR (a user id),
 * not a Clerk session.
 *
 * The browser route and the MCP tools both call these. The route used to hold
 * this logic inline, which meant an MCP request would have had to either
 * impersonate a browser session or call the route over HTTP — neither of which
 * is acceptable. Access checks stay with the caller: each surface authenticates
 * differently, and a service that re-checked would hide who is responsible.
 */

export const MAX_BRIEF_CHARS = 6_000;

/**
 * Begin a pipeline run: charge quota once, research any URL in the brief, and
 * seed the spec. Returns a string error rather than throwing so callers can map
 * it onto their own protocol.
 */
export async function beginPipelineRun(params: {
  projectId: string;
  userId: string;
  brief: string;
  url?: string;
}): Promise<
  | { ok: true; run: RunRecord }
  | { ok: false; error: string; retryAfter: number }
> {
  const started = await startRun({
    projectId: params.projectId,
    userId: params.userId,
    kind: "pipeline",
    brief: params.brief,
    meta: {
      urls: params.url ? [params.url] : extractUrls(params.brief, 2),
      // Recorded so a surface that wants runs bound to their initiator can check it.
      startedBy: params.userId,
    },
  });
  if (!started.ok) return started;

  // A URL in the brief gets real research before anything is designed. Best
  // effort: a site that will not load must not cost the user their design.
  const urls = (started.run.meta.urls as string[] | undefined) ?? [];
  let research: string | null = null;
  if (urls.length > 0) {
    try {
      const briefs: string[] = [];
      for (const target of urls.slice(0, 2)) briefs.push(await researchSite(target));
      research = briefs.join("\n\n---\n\n");
    } catch (e) {
      console.error("[pipeline] research failed", e);
    }
  }

  await getOrCreateSpec(params.projectId);
  await markStep(
    started.run.id,
    "start",
    { status: "done", detail: research ? "Read the site" : undefined },
    research ? { research } : undefined
  );

  return started;
}

export type StepResult =
  | {
      ok: true;
      step: PipelineStepId;
      nextStep: PipelineStepId | null;
      ms: number;
      detail?: string;
      skipped: boolean;
      outcome: StepOutcome;
    }
  | { ok: false; step: PipelineStepId; error: string; ms: number };

/**
 * Run one step of a live run and record what happened. The caller has already
 * authorised the actor and loaded the run; for MCP it has also claimed the step.
 */
export async function executeStep(params: {
  step: Exclude<PipelineStepId, "start">;
  projectId: string;
  userId: string;
  run: RunRecord;
  canvasNodes?: CanvasNode[];
  canvasEdges?: CanvasEdge[];
  canvasContext?: string;
}): Promise<StepResult> {
  const { step, projectId, userId, run } = params;
  const started = Date.now();
  await markStep(run.id, step, { status: "running" });

  try {
    const outcome = await runStep({
      step,
      projectId,
      userId,
      run,
      canvasNodes: params.canvasNodes ?? [],
      canvasEdges: params.canvasEdges ?? [],
      canvasContext: params.canvasContext,
    });

    const ms = Date.now() - started;
    await markStep(
      run.id,
      step,
      { status: outcome.skipped ? "skipped" : "done", detail: outcome.detail, ms },
      outcome.meta
    );

    const after = nextStep(step);
    if (!after) await finishRun(run.id, "completed");

    return {
      ok: true,
      step,
      nextStep: after,
      ms,
      detail: outcome.detail,
      skipped: outcome.skipped ?? false,
      outcome,
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : "That step failed";
    const ms = Date.now() - started;
    await markStep(run.id, step, { status: "failed", error, ms });
    console.error(`[pipeline] ${step} failed`, e);
    return { ok: false, step, error, ms };
  }
}

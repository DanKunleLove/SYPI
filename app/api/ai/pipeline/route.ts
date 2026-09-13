import { getUserInstructions, resolveModelForProject } from "@/lib/ai/index";
import { isPipelineStep, nextStep } from "@/lib/ai/pipeline";
import { runStep, specSummary } from "@/lib/ai/pipeline-steps";
import {
  findResumableRun,
  finishRun,
  loadRun,
  markStep,
  startRun,
  type RunRecord,
} from "@/lib/ai/run";
import { extractUrls, researchSite } from "@/lib/ai/url-research";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { getOrCreateSpec, getSpec } from "@/lib/uss/store";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

/**
 * The design pipeline — ONE STEP PER REQUEST.
 *
 * ── What this replaces, and why ──────────────────────────────────────────────
 * `/api/ai/generate` ran the whole chain in a single request: five extraction
 * calls, a design call, a critique, a repair. Two things were wrong with that.
 * It could never have finished inside Vercel Hobby's 60-second ceiling. And it
 * had NO CALLER — `hooks/use-generation.ts` exported the function that called
 * it, and the one component using that hook never destructured it. So no project
 * has ever had a specification, which is why the hand-off said "no specification
 * yet" on a fourteen-node canvas and why the complexity budget never once
 * stopped a portfolio site acquiring a Redis cache.
 *
 * Here each step is one bounded unit of work, committed before the next begins.
 * That fits the ceiling, and it is also what lets the user watch the work happen
 * and retry a single failed step instead of losing the whole run.
 *
 * ── Two deliberate choices ───────────────────────────────────────────────────
 * The client carries `{projectId, runId, step}` and NOTHING ELSE. In particular
 * it does not carry a spec version: `commitWithRetry` re-reads and retries, so a
 * collaborator saving the canvas between two steps cannot 409 the run. The brief
 * lives on the run record, server-side, so it cannot change halfway through and
 * leave the spec incoherent.
 *
 * A failed step returns HTTP 200 with `ok: false`. In a browser a 500 mid-loop
 * is indistinguishable from the platform killing the function; an explicit
 * `ok: false` with a step name is not.
 */

export const maxDuration = 60;

const MAX_PROMPT_CHARS = 6_000;
const MAX_CONTEXT_CHARS = 24_000;

/** GET — is there a run to resume? Answers the reload-mid-run case. */
export async function GET(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return Response.json({ error: "projectId is required" }, { status: 400 });

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const run = await findResumableRun(projectId, "pipeline");
  if (!run) return Response.json({ resumable: false });

  const completed = Object.entries(run.steps)
    .filter(([, s]) => s.status === "done" || s.status === "skipped")
    .map(([id]) => id);
  const last = completed[completed.length - 1];

  return Response.json({
    resumable: true,
    runId: run.id,
    brief: run.brief,
    steps: run.steps,
    // Resume at the step after the last one that actually landed.
    step: last && isPipelineStep(last) ? nextStep(last) : "start",
  });
}

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId as string | undefined;
  const step = body.step as string | undefined;
  const runId = body.runId as string | undefined;

  if (!projectId || !step) {
    return Response.json({ error: "projectId and step are required" }, { status: 400 });
  }
  if (!isPipelineStep(step)) {
    return Response.json({ error: `Unknown step "${step}"` }, { status: 400 });
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  // ── start: the only step that charges quota ────────────────────────────────
  if (step === "start") {
    const brief = body.brief as string | undefined;
    if (!brief) return Response.json({ error: "brief is required" }, { status: 400 });
    if (brief.length > MAX_PROMPT_CHARS) {
      return Response.json(
        { error: `Brief too long (max ${MAX_PROMPT_CHARS} characters)` },
        { status: 400 }
      );
    }

    const url = body.url as string | undefined;
    const started = await startRun({
      projectId,
      userId: user.id,
      kind: "pipeline",
      brief,
      meta: { urls: url ? [url] : extractUrls(brief, 2) },
    });
    if (!started.ok) {
      return Response.json({ error: started.error }, { status: 429 });
    }

    // A URL in the brief gets real research before anything is designed, the
    // same as it did on the old path. Best-effort: a site that will not load
    // must not cost the user their design.
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

    const current = await getOrCreateSpec(projectId);
    await markStep(
      started.run.id,
      "start",
      { status: "done", detail: research ? "Read the site" : undefined },
      research ? { research } : undefined
    );

    return Response.json({
      ok: true,
      step,
      runId: started.run.id,
      nextStep: nextStep(step),
      spec: specSummary(current.doc),
    });
  }

  // ── every other step needs a live run ──────────────────────────────────────
  if (!runId) return Response.json({ error: "runId is required" }, { status: 400 });
  const loaded = await loadRun(runId, projectId);
  if (!loaded.ok) return Response.json({ error: loaded.error }, { status: 409 });
  const run = loaded.run;

  const started = Date.now();
  await markStep(runId, step, { status: "running" });

  try {
    const outcome = await runStep({
      step,
      projectId,
      userId: user.id,
      run,
      canvasNodes: (body.nodes as CanvasNode[] | undefined) ?? [],
      canvasEdges: (body.edges as CanvasEdge[] | undefined) ?? [],
      canvasContext:
        typeof body.canvasContext === "string"
          ? body.canvasContext.slice(0, MAX_CONTEXT_CHARS)
          : undefined,
    });

    const ms = Date.now() - started;
    await markStep(
      runId,
      step,
      { status: outcome.skipped ? "skipped" : "done", detail: outcome.detail, ms },
      outcome.meta
    );

    const after = nextStep(step);
    if (!after) await finishRun(runId, "completed");

    const record = await getSpec(projectId);
    return Response.json({
      ok: true,
      step,
      runId,
      nextStep: after,
      ms,
      detail: outcome.detail,
      skipped: outcome.skipped ?? false,
      architecture: outcome.architecture,
      operations: outcome.operations,
      spec: record ? specSummary(record.doc) : null,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : "That step failed";
    await markStep(runId, step, { status: "failed", error, ms: Date.now() - started });
    console.error(`[pipeline] ${step} failed`, e);
    // 200, deliberately: see the header note. The client needs to tell a failed
    // step apart from a killed function, and an HTTP error cannot do that.
    return Response.json({ ok: false, step, runId, error, retryable: true });
  }
}


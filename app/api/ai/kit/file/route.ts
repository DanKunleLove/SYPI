import { generateText } from "ai";
import { applyUserInstructions, getUserInstructions, resolveModelForProject } from "@/lib/ai/index";
import { getKitDomain, kitSystemPrompt, SECTIONS_BY_FILE } from "@/lib/ai/kit";
import { loadRun, markStep } from "@/lib/ai/run";
import { prisma } from "@/lib/prisma";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { renderUssForPrompt } from "@/lib/uss/render";
import { getSpec } from "@/lib/uss/store";

/**
 * Generate ONE System Kit file.
 *
 * One model call per request, so it fits comfortably inside the platform's
 * 60-second ceiling. The client loops; each file that lands is kept, and a
 * failure costs that file rather than the whole Kit.
 */

export const maxDuration = 60;

/**
 * Below this, the model produced nothing usable.
 *
 * The old client tested `event.content` for truthiness, so an empty file was
 * SILENTLY DROPPED and then surfaced later as a count mismatch — "ended early",
 * with no clue which file or why. An empty file is a named failure now.
 */
const MIN_USEFUL_CHARS = 40;

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: unknown; runId?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const runId = typeof body.runId === "string" ? body.runId : null;
  const name = typeof body.name === "string" ? body.name : null;
  if (!projectId || !runId || !name) {
    return Response.json({ error: "projectId, runId and name are required" }, { status: 400 });
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const loaded = await loadRun(runId, projectId);
  if (!loaded.ok) return Response.json({ error: loaded.error }, { status: 409 });
  const run = loaded.run;

  const domain = getKitDomain(run.meta.domain);
  const file = domain.files.find((f) => f.name === name);
  if (!file) {
    return Response.json({ error: `"${name}" is not a file in this kit` }, { status: 400 });
  }

  try {
    const [model, instructions] = await Promise.all([
      resolveModelForProject(projectId, "flash"),
      getUserInstructions(user.id),
    ]);

    // The spec is authoritative; the canvas dump is the fallback for projects
    // that have not been through the pipeline yet.
    let specContext = "";
    try {
      const record = await getSpec(projectId);
      const sections = SECTIONS_BY_FILE[file.name];
      if (record && sections) {
        specContext = renderUssForPrompt(record.doc, { sections, maxChars: 18_000 });
      }
    } catch {
      // A spec that will not load must never block a kit.
    }

    const canvasContext = (run.meta.canvasContext as string | undefined) ?? "";
    const projectName = (run.meta.projectName as string | undefined) ?? "Untitled Project";

    const context = specContext
      ? `SYSTEM SPECIFICATION (authoritative — status markers show how well each fact is established):\n${specContext}`
      : `ARCHITECTURE (from the canvas):\n${canvasContext}`;

    if (!specContext && !canvasContext) {
      return Response.json({
        ok: false,
        name: file.name,
        error: "Nothing to write from — describe what you are building, or add components to the canvas.",
      });
    }

    const result = await generateText({
      model,
      system: applyUserInstructions(kitSystemPrompt(domain), instructions),
      prompt: `PROJECT: ${projectName}\n\n${context}\n\nYOUR FILE:\n${file.guidance}`,
    });

    const content = result.text.trim();
    if (content.length < MIN_USEFUL_CHARS) {
      await markStep(runId, file.name, { status: "failed", error: "empty response" });
      return Response.json({
        ok: false,
        name: file.name,
        error: `The model returned nothing for ${file.name}. Retry it.`,
      });
    }

    await markStep(runId, file.name, { status: "done" });
    return Response.json({ ok: true, name: file.name, title: file.title, content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "That file failed";
    await markStep(runId, file.name, { status: "failed", error: message });
    console.error(`[kit] ${file.name} failed`, error);
    // 200 with ok:false — an HTTP error would be indistinguishable from the
    // platform killing the function, which is the ambiguity that made the old
    // "ended early" message useless.
    return Response.json({ ok: false, name: file.name, error: message });
  }
}

/** Mark the whole kit delivered — the activation signal /admin reads. */
export async function PATCH(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { projectId?: string; domain?: string };
  if (!body.projectId) return Response.json({ error: "projectId is required" }, { status: 400 });

  const access = await getProjectWithAccess(body.projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  await prisma.usageEvent
    .create({
      data: {
        userId: user.id,
        type: "kit_generated",
        meta: { domain: body.domain ?? "software", project: body.projectId },
      },
    })
    .catch(() => {});

  return Response.json({ ok: true });
}

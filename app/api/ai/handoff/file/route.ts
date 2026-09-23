import { generateText } from "ai";
import { applyUserInstructions, getUserInstructions, resolveModelForProject } from "@/lib/ai/index";
import { loadRun, markStep } from "@/lib/ai/run";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { renderUssForPrompt } from "@/lib/uss/render";
import { getSpec } from "@/lib/uss/store";
import { getTarget, targetSystemPrompt } from "@/lib/uss/targets";

/** Generate ONE hand-off file. One model call, comfortably inside the ceiling. */

export const maxDuration = 60;

/** Below this the model produced nothing usable — a named failure, not a silent gap. */
const MIN_USEFUL_CHARS = 40;

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: unknown; runId?: unknown; path?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const runId = typeof body.runId === "string" ? body.runId : null;
  const path = typeof body.path === "string" ? body.path : null;
  if (!projectId || !runId || !path) {
    return Response.json({ error: "projectId, runId and path are required" }, { status: 400 });
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const loaded = await loadRun(runId, projectId);
  if (!loaded.ok) return Response.json({ error: loaded.error }, { status: 409 });
  const run = loaded.run;

  const target = getTarget(run.meta.target);
  const file = target.files.find((f) => f.path === path);
  if (!file) {
    return Response.json({ error: `"${path}" is not a file in this hand-off` }, { status: 400 });
  }

  try {
    const record = await getSpec(projectId);
    if (!record) {
      return Response.json({ ok: false, path, error: "The specification has gone away." });
    }

    const [model, instructions] = await Promise.all([
      resolveModelForProject(projectId, "flash"),
      getUserInstructions(user.id),
    ]);

    const projectName = (run.meta.projectName as string | undefined) ?? "Untitled Project";
    const context = renderUssForPrompt(record.doc, {
      sections: file.sections,
      maxChars: 18_000,
    });

    const result = await generateText({
      model,
      system: applyUserInstructions(targetSystemPrompt(target), instructions),
      prompt: `PROJECT: ${projectName}\n\nSPECIFICATION (status markers show how well each fact is established):\n${context}\n\nYOUR FILE — ${file.title} (${file.path}):\n${file.guidance}`,
    });

    const content = result.text.trim();
    if (content.length < MIN_USEFUL_CHARS) {
      await markStep(runId, file.path, { status: "failed", error: "empty response" });
      return Response.json({
        ok: false,
        path: file.path,
        error: `The model returned nothing for ${file.path}. Retry it.`,
      });
    }

    await markStep(runId, file.path, { status: "done" });
    return Response.json({ ok: true, path: file.path, title: file.title, content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "That file failed";
    await markStep(runId, file.path, { status: "failed", error: message });
    console.error(`[handoff] ${file.path} failed`, error);
    return Response.json({ ok: false, path: file.path, error: message });
  }
}

import { startRun } from "@/lib/ai/run";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { EXECUTION_TARGETS, getTarget, isTargetId } from "@/lib/uss/targets";
import { getSpec } from "@/lib/uss/store";

/**
 * Begin a hand-off run. Charges quota ONCE; the files are free.
 *
 * Same shape as the System Kit, and for the same reason: several sequential
 * document generations cannot fit in a 60-second function, so the client asks
 * for one file at a time.
 */

export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: unknown; target?: unknown; projectName?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (!projectId) return Response.json({ error: "projectId is required" }, { status: 400 });
  if (body.target !== undefined && !isTargetId(body.target)) {
    return Response.json(
      { error: `Unknown target. Options: ${EXECUTION_TARGETS.map((t) => t.id).join(", ")}` },
      { status: 400 }
    );
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  // The spec check comes BEFORE the quota charge. It used to come after, so
  // every "no specification yet" click burned one of ten daily credits for a
  // request that was never going to run.
  const record = await getSpec(projectId);
  if (!record) {
    return Response.json(
      {
        error:
          "This project has no specification yet. Describe what you are building in the chat first — the hand-off renders the reasoning, it does not replace it.",
      },
      { status: 400 }
    );
  }

  const target = getTarget(body.target);
  const projectName =
    typeof body.projectName === "string" && body.projectName.trim()
      ? body.projectName.trim().slice(0, 120)
      : "Untitled Project";

  const started = await startRun({
    projectId,
    userId: user.id,
    kind: "handoff",
    brief: projectName,
    meta: { target: target.id, projectName },
  });
  if (!started.ok) return Response.json({ error: started.error }, { status: 429 });

  return Response.json({
    runId: started.run.id,
    target: { id: target.id, label: target.label },
    files: target.files.map((f) => ({ path: f.path, title: f.title })),
  });
}

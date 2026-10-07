import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { enforceAiQuota } from "@/lib/ai/limits";
import { commitWithRetry } from "@/lib/uss/store";
import { applyAnswer } from "@/lib/uss/answer";
import { diffUssToCanvas } from "@/lib/uss/project";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";
import { specCoverage } from "@/lib/uss/views";

/**
 * POST /api/uss/resolve — answer one open decision (see lib/uss/answer.ts).
 *
 * If the decision affects components, the response carries the canvas operations
 * so the client can apply them through the existing applyDiffOperations path.
 */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    projectId?: unknown;
    decisionId?: unknown;
    answer?: unknown;
    nodes?: unknown;
    edges?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const decisionId = typeof body.decisionId === "string" ? body.decisionId : null;
  const answer = typeof body.answer === "string" ? body.answer.slice(0, 2000) : null;

  if (!projectId || !decisionId || !answer) {
    return Response.json(
      { error: "projectId, decisionId and answer are required" },
      { status: 400 }
    );
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  // Auth and access first, quota second — an unauthorised request must not burn it.
  const quota = await enforceAiQuota(user.id, "intent");
  if (quota) return quota;

  let affectsComponents = false;

  const result = await commitWithRetry({
    projectId,
    source: "answer",
    changeSummary: `Answered ${decisionId}`,
    authorUserId: user.id,
    apply: (current) => {
      const answered = applyAnswer(current, decisionId, answer);
      affectsComponents = answered.affectsComponents;
      return answered.doc;
    },
  });

  // Only compute canvas operations when the answer could actually move something.
  let operations: ReturnType<typeof diffUssToCanvas> = [];
  if (affectsComponents && Array.isArray(body.nodes) && Array.isArray(body.edges)) {
    operations = diffUssToCanvas(
      result.doc,
      body.nodes as CanvasNode[],
      body.edges as CanvasEdge[]
    );
  }

  return Response.json({
    ok: true,
    version: result.version,
    coverage: specCoverage(result.doc),
    operations,
  });
}

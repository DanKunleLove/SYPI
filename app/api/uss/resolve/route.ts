import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { enforceAiQuota } from "@/lib/ai/limits";
import { commitWithRetry } from "@/lib/uss/store";
import { UssGraph } from "@/lib/uss/graph";
import { finalise } from "@/lib/ai/uss";
import { diffUssToCanvas } from "@/lib/uss/project";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";
import { specCoverage } from "@/lib/uss/views";

/**
 * POST /api/uss/resolve — answer one open decision.
 *
 * The answer becomes a recorded constraint with `evidence.kind: "answer"`, which
 * is what turns an UNKNOWN into a KNOWN legitimately. If the decision affects
 * components, the response carries the canvas operations so the client can apply
 * them through the existing applyDiffOperations path.
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
      const g = new UssGraph(current);
      const decision = g.get(decisionId);
      if (!decision || decision.kind !== "openDecision") {
        throw new Error("That question is no longer open");
      }
      affectsComponents = decision.impact.affectsComponents.length > 0;

      g.update(decisionId, {
        resolvedAt: new Date().toISOString(),
        resolution: answer,
        status: "KNOWN",
        confidence: 1,
        evidence: [{ kind: "answer", ref: decisionId, quote: answer.slice(0, 400) }],
      });

      // The answer is now an established constraint, traceable to who said it.
      const constraint = g.add("constraint", {
        title: decision.title,
        category:
          decision.category === "compliance"
            ? "regulatory"
            : decision.category === "budget"
              ? "budget"
              : decision.category === "stack"
                ? "stack"
                : "other",
        statement: `${decision.question} — ${answer}`,
        status: "KNOWN",
        confidence: 1,
        evidence: [{ kind: "answer", ref: decisionId, quote: answer.slice(0, 400) }],
        firstSeenVersion: current.complexity.firstSeenVersion + 1,
      });

      for (const componentId of decision.impact.affectsComponents) {
        g.link("constrains", constraint.id, componentId, {
          status: "KNOWN",
          confidence: 1,
          evidence: [{ kind: "answer", ref: decisionId }],
          firstSeenVersion: current.complexity.firstSeenVersion + 1,
        });
      }

      return finalise(g.snapshot());
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

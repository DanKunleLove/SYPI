import { canEditProject, getProjectWithAccess } from "@/lib/project-access";
import { commitWithRetry, getSpec } from "@/lib/uss/store";
import { reconcileCanvasIntoSpec } from "@/lib/uss/reconcile";
import { finalise } from "@/lib/ai/uss";
import { UssGraph } from "@/lib/uss/graph";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";
import { specCoverage } from "@/lib/uss/views";

/**
 * POST /api/projects/[projectId]/spec/sync — canvas → USS.
 *
 * Fully deterministic: no model call, and therefore NO QUOTA. Fired
 * fire-and-forget after a successful manual save, exactly as captureThumbnail
 * already is, so save latency and failure semantics are unchanged.
 *
 * Idempotent, so a double fire is harmless.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }
  if (!canEditProject(access.role)) {
    return Response.json(
      { error: "Read-only collaborators cannot sync specification changes" },
      { status: 403 }
    );
  }

  let body: { nodes?: unknown; edges?: unknown; ifExists?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return Response.json({ error: "nodes and edges are required" }, { status: 400 });
  }

  const nodes = body.nodes as CanvasNode[];
  const edges = body.edges as CanvasEdge[];

  /**
   * Only keep an EXISTING spec current — never bring one into being.
   *
   * commitWithRetry calls getOrCreateSpec, so without this guard the first Ctrl+S
   * on any project would mint a spec AND raise one material question per
   * unexplained node. A fourteen-node canvas would sprout fourteen questions and
   * a provisional tier badge the moment it was saved, about a design nobody asked
   * us to analyse. A spec comes into existence through the pipeline; this route's
   * job is keeping it in step with the canvas afterwards.
   */
  if (body.ifExists !== false) {
    const existing = await getSpec(projectId);
    if (!existing) return Response.json({ ok: true, skipped: true });
  }

  try {
    const result = await commitWithRetry({
      projectId,
      source: "canvas-sync",
      changeSummary: "Reconciled canvas changes",
      apply: (current) => {
        const reconciled = reconcileCanvasIntoSpec(
          current,
          nodes,
          edges,
          current.complexity.firstSeenVersion + 1
        );

        // Questions raised by the reconcile become open decisions, deduplicated
        // against what is already there.
        const g = new UssGraph(reconciled.doc);
        const existing = new Set(
          g.byKind("openDecision").map((d) => d.question.trim().toLowerCase())
        );
        for (const q of reconciled.questions) {
          if (existing.has(q.question.trim().toLowerCase())) continue;
          existing.add(q.question.trim().toLowerCase());
          g.add("openDecision", {
            title: q.title,
            question: q.question,
            why: q.why,
            category: "scope",
            options: [],
            impact: { affectsComponents: [], affectsRequirements: [], severity: q.severity },
            status: "INFERRED",
            confidence: 0.9,
            evidence: [{ kind: "canvas" }],
            firstSeenVersion: 1,
          });
        }

        return finalise(g.snapshot());
      },
    });

    return Response.json({
      ok: true,
      version: result.version,
      coverage: specCoverage(result.doc),
    });
  } catch (error) {
    // Sync is best-effort by design: it must never make a save look failed.
    console.error("[spec/sync]", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}

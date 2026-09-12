import { getProjectWithAccess } from "@/lib/project-access";
import { getSpec } from "@/lib/uss/store";
import { runScenarios, summariseScenarios } from "@/lib/uss/scenarios";

/**
 * GET /api/uss/[projectId]/scenarios — the validation matrix.
 *
 * Entirely deterministic: no model call, no quota. "The payment webhook arrives
 * three times" is answered by querying the spec, not by asking an opinion.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const record = await getSpec(projectId);
  if (!record) return Response.json({ exists: false, scenarios: [] });

  const scenarios = runScenarios(record.doc);
  return Response.json({
    exists: true,
    summary: summariseScenarios(scenarios),
    scenarios,
  });
}

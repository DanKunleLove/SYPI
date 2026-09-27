import { getProjectWithAccess } from "@/lib/project-access";
import { getSpec } from "@/lib/uss/store";
import { renderTasksMarkdown, taskBreakdown } from "@/lib/uss/tasks";

/**
 * GET /api/uss/[projectId]/tasks — the ordered build plan.
 *
 * Deterministic: no model call, no quota. `?format=md` returns tasks.md in the
 * GitHub Spec Kit shape for copying straight into a repository.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const record = await getSpec(projectId);
  const format = new URL(request.url).searchParams.get("format");

  if (format === "md") {
    const body = record ? renderTasksMarkdown(record.doc) : "# Tasks\n\nNo specification yet.\n";
    return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
  }

  if (!record) return Response.json({ exists: false, tasks: [], phases: [], cycles: [] });
  return Response.json({ exists: true, ...taskBreakdown(record.doc) });
}

import { generateText } from "ai";
import { resolveModelForProject } from "@/lib/ai/index";
import { SPEC_OVERVIEW_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";

/**
 * Hybrid spec export: the deterministic spec is built client-side from the
 * canvas; this endpoint adds an AI-written overview/rationale section.
 */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { projectId?: unknown; canvasContext?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectId, canvasContext } = body;
  if (typeof projectId !== "string" || typeof canvasContext !== "string") {
    return Response.json(
      { error: "projectId and canvasContext are required" },
      { status: 400 }
    );
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  try {
    const { text } = await generateText({
      model: await resolveModelForProject(projectId, "flash"),
      system: SPEC_OVERVIEW_SYSTEM_PROMPT,
      prompt: `Write the overview for this architecture:\n\n${canvasContext}`,
    });
    return Response.json({ overview: text.trim() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate overview" },
      { status: 500 }
    );
  }
}

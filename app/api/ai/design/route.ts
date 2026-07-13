import { tasks } from "@trigger.dev/sdk";
import { prisma } from "@/lib/prisma";
import { enforceAiQuota } from "@/lib/ai/limits";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import type { designAgentTask } from "@/trigger/design-agent";

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId as string | undefined;
  const prompt = body.prompt as string | undefined;
  const mode = (body.mode as string) || "generate";
  const url = body.url as string | undefined;
  const canvasContext =
    typeof body.canvasContext === "string"
      ? body.canvasContext.slice(0, 24_000)
      : undefined;

  if (!projectId || !prompt) {
    return Response.json(
      { error: "projectId and prompt are required" },
      { status: 400 }
    );
  }
  if (prompt.length > 6_000) {
    return Response.json(
      { error: "Prompt too long (max 6000 characters)" },
      { status: 400 }
    );
  }

  // Verify access
  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason }, { status: 403 });
  }

  // Legacy worker path spends the same platform quota as inline generation.
  const limited = await enforceAiQuota(user.id, "generate");
  if (limited) return limited;

  // Create AIGeneration record
  const generation = await prisma.aIGeneration.create({
    data: {
      projectId,
      prompt,
      type: mode === "url-analyze" ? "url-analysis" : "generation",
      status: "pending",
    },
  });

  // Trigger the design agent task
  const handle = await tasks.trigger<typeof designAgentTask>(
    "design-agent",
    {
      generationId: generation.id,
      projectId,
      roomId: projectId, // Room ID is the project ID
      prompt,
      mode: mode as "generate" | "url-analyze",
      url,
      canvasContext,
    }
  );

  // Store the task run reference
  await prisma.taskRun.create({
    data: {
      runId: handle.id,
      projectId,
      userId: user.id,
    },
  });

  return Response.json(
    {
      generationId: generation.id,
      runId: handle.id,
    },
    { status: 201 }
  );
}

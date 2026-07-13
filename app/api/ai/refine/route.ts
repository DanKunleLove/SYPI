import { tasks } from "@trigger.dev/sdk";
import { prisma } from "@/lib/prisma";
import { enforceAiQuota } from "@/lib/ai/limits";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import type { refineArchitectureTask } from "@/trigger/refine-architecture";

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
  const canvasContext =
    typeof body.canvasContext === "string"
      ? body.canvasContext.slice(0, 24_000)
      : undefined;

  if (!projectId || !prompt || !canvasContext) {
    return Response.json(
      { error: "projectId, prompt, and canvasContext are required" },
      { status: 400 }
    );
  }
  if (prompt.length > 6_000) {
    return Response.json(
      { error: "Prompt too long (max 6000 characters)" },
      { status: 400 }
    );
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason }, { status: 403 });
  }

  const limited = await enforceAiQuota(user.id, "refine");
  if (limited) return limited;

  const generation = await prisma.aIGeneration.create({
    data: {
      projectId,
      prompt,
      type: "refinement",
      status: "pending",
    },
  });

  const handle = await tasks.trigger<typeof refineArchitectureTask>(
    "refine-architecture",
    {
      generationId: generation.id,
      projectId,
      roomId: projectId,
      prompt,
      canvasContext,
    }
  );

  await prisma.taskRun.create({
    data: {
      runId: handle.id,
      projectId,
      userId: user.id,
    },
  });

  return Response.json(
    { generationId: generation.id, runId: handle.id },
    { status: 201 }
  );
}

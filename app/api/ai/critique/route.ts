import { tasks } from "@trigger.dev/sdk";
import { prisma } from "@/lib/prisma";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import type { critiqueArchitectureTask } from "@/trigger/critique-architecture";

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
  const canvasContext = body.canvasContext as string | undefined;

  if (!projectId || !canvasContext) {
    return Response.json(
      { error: "projectId and canvasContext are required" },
      { status: 400 }
    );
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason }, { status: 403 });
  }

  const generation = await prisma.aIGeneration.create({
    data: {
      projectId,
      prompt: "Architecture critique",
      type: "critique",
      status: "pending",
    },
  });

  const handle = await tasks.trigger<typeof critiqueArchitectureTask>(
    "critique-architecture",
    {
      generationId: generation.id,
      projectId,
      roomId: projectId,
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

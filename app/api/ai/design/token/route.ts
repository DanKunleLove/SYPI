import { auth } from "@trigger.dev/sdk";
import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";

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

  const runId = body.runId as string | undefined;
  if (!runId) {
    return Response.json({ error: "runId is required" }, { status: 400 });
  }

  // Verify ownership
  const taskRun = await prisma.taskRun.findUnique({
    where: { runId },
  });

  if (!taskRun || taskRun.userId !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate a public token scoped to this run
  const publicToken = await auth.createPublicToken({
    scopes: {
      read: {
        runs: [runId],
      },
    },
    expirationTime: "15m",
  });

  return Response.json({ publicToken });
}

import { prisma } from "@/lib/prisma";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import type { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { generationId } = await params;

  const generation = await prisma.aIGeneration.findUnique({
    where: { id: generationId },
  });

  if (!generation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Verify access to the project
  const access = await getProjectWithAccess(generation.projectId);
  if (!access.project) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json({
    id: generation.id,
    status: generation.status,
    type: generation.type,
    result: generation.result,
    error: generation.error,
    createdAt: generation.createdAt,
  });
}

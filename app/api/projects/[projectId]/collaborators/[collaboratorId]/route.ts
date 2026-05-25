import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import type { NextRequest } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; collaboratorId: string }> }
) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, collaboratorId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Only owner can remove collaborators
  if (project.userId !== user.id) {
    return Response.json({ error: "Only the project owner can remove collaborators" }, { status: 403 });
  }

  const collaborator = await prisma.collaborator.findUnique({
    where: { id: collaboratorId, projectId },
  });

  if (!collaborator) {
    return Response.json({ error: "Collaborator not found" }, { status: 404 });
  }

  await prisma.collaborator.delete({
    where: { id: collaboratorId },
  });

  return Response.json({ success: true });
}

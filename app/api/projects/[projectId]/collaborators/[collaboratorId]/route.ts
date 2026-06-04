import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import type { NextRequest } from "next/server";
import type { Role } from "@/app/generated/prisma/client";

const EDITABLE_ROLES: Role[] = ["EDITOR", "VIEWER"];

/** Update a collaborator's free-text title and/or permission role (owner only). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; collaboratorId: string }> }
) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, collaboratorId } = await params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.userId !== user.id) {
    return Response.json(
      { error: "Only the project owner can edit collaborators" },
      { status: 403 }
    );
  }

  const collaborator = await prisma.collaborator.findUnique({
    where: { id: collaboratorId, projectId },
  });
  if (!collaborator) {
    return Response.json({ error: "Collaborator not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { title?: string | null; role?: Role } = {};

  if ("title" in body) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    data.title = t.length > 0 ? t.slice(0, 60) : null;
  }
  if ("role" in body) {
    if (typeof body.role !== "string" || !EDITABLE_ROLES.includes(body.role as Role)) {
      return Response.json({ error: "Invalid role" }, { status: 400 });
    }
    data.role = body.role as Role;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.collaborator.update({
    where: { id: collaboratorId },
    data,
    select: { id: true, title: true, role: true },
  });

  return Response.json({ collaborator: updated });
}

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

import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import type { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const existing = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!existing) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (existing.userId !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = body.name?.trim();

  if (!name) {
    return Response.json(
      { error: "Name is required and cannot be empty" },
      { status: 400 }
    );
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { name },
  });

  return Response.json({ project });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const existing = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!existing) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  if (existing.userId !== user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.project.delete({
    where: { id: projectId },
  });

  return Response.json({ success: true });
}

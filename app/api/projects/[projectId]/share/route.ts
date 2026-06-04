import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import type { NextRequest } from "next/server";

async function getOwnerProject(projectId: string) {
  const user = await getDbUser();
  if (!user) return null;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== user.id) return null;
  return project;
}

/**
 * POST /api/projects/[projectId]/share
 * Generates (or returns) a public share token. Owner only.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = await getOwnerProject(projectId);
  if (!project) return Response.json({ error: "Forbidden" }, { status: 403 });

  const token = project.shareToken ?? randomBytes(12).toString("base64url");

  if (!project.shareToken) {
    await prisma.project.update({
      where: { id: projectId },
      data: { shareToken: token },
    });
  }

  return Response.json({ token });
}

/**
 * DELETE /api/projects/[projectId]/share
 * Revokes the share link. Owner only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const project = await getOwnerProject(projectId);
  if (!project) return Response.json({ error: "Forbidden" }, { status: 403 });

  await prisma.project.update({
    where: { id: projectId },
    data: { shareToken: null },
  });

  return Response.json({ success: true });
}

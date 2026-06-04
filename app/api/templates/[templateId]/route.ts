import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import type { NextRequest } from "next/server";

/** DELETE /api/templates/[templateId] — owner only */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { templateId } = await params;

  const template = await prisma.canvasTemplate.findUnique({ where: { id: templateId } });
  if (!template) return Response.json({ error: "Not found" }, { status: 404 });
  if (template.userId !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

  await prisma.canvasTemplate.delete({ where: { id: templateId } });
  return Response.json({ success: true });
}

/** PATCH /api/templates/[templateId] — toggle isPublic, owner only */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { templateId } = await params;

  const template = await prisma.canvasTemplate.findUnique({ where: { id: templateId } });
  if (!template) return Response.json({ error: "Not found" }, { status: 404 });
  if (template.userId !== user.id) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const updated = await prisma.canvasTemplate.update({
    where: { id: templateId },
    data: {
      ...(body.isPublic !== undefined && { isPublic: Boolean(body.isPublic) }),
      ...(body.name && { name: String(body.name).trim().slice(0, 80) }),
    },
    select: { id: true, name: true, isPublic: true },
  });

  return Response.json({ template: updated });
}

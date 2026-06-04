import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import type { NextRequest } from "next/server";

/**
 * GET /api/templates
 * Returns: user's own templates + all public templates (from other users).
 */
export async function GET(_request: NextRequest) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [own, community] = await Promise.all([
    prisma.canvasTemplate.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true, category: true,
        isPublic: true, schema: true, createdAt: true,
        user: { select: { name: true } },
      },
    }),
    prisma.canvasTemplate.findMany({
      where: { isPublic: true, userId: { not: user.id } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, name: true, description: true, category: true,
        isPublic: true, schema: true, createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return Response.json({ own, community });
}

/**
 * POST /api/templates
 * Save current canvas as a named template.
 */
export async function POST(request: NextRequest) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { name, description, category, isPublic, schema } = body as {
    name: string;
    description?: string;
    category?: string;
    isPublic?: boolean;
    schema: unknown;
  };

  if (!name?.trim()) {
    return Response.json({ error: "Template name is required" }, { status: 400 });
  }
  if (!schema || typeof schema !== "object") {
    return Response.json({ error: "Canvas schema is required" }, { status: 400 });
  }

  const template = await prisma.canvasTemplate.create({
    data: {
      userId: user.id,
      name: name.trim().slice(0, 80),
      description: description?.trim().slice(0, 200) ?? null,
      category: (category ?? "custom").slice(0, 20),
      isPublic: isPublic === true,
      schema,
    },
    select: { id: true, name: true, description: true, category: true, isPublic: true },
  });

  return Response.json({ template }, { status: 201 });
}

import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";

/**
 * GET /api/share/[token]
 * Public endpoint — no auth required.
 * Returns project name + canvas JSON path for the public share viewer.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    select: { id: true, name: true, canvasJsonPath: true, thumbnailUrl: true },
  });

  if (!project) {
    return Response.json({ error: "Share link not found or has been revoked" }, { status: 404 });
  }

  return Response.json({
    id: project.id,
    name: project.name,
    canvasJsonPath: project.canvasJsonPath,
    thumbnailUrl: project.thumbnailUrl,
  });
}

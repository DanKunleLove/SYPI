import { prisma } from "@/lib/prisma";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";

/** Rate a generation: 1 (up), -1 (down), 0 clears. Feeds the quality loop. */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { generationId?: unknown; rating?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { generationId, rating } = body;
  if (typeof generationId !== "string" || ![1, -1, 0].includes(rating as number)) {
    return Response.json(
      { error: "generationId and rating (1 | -1 | 0) are required" },
      { status: 400 }
    );
  }

  const generation = await prisma.aIGeneration.findUnique({
    where: { id: generationId },
    select: { id: true, projectId: true },
  });
  if (!generation) {
    return Response.json({ error: "Generation not found" }, { status: 404 });
  }

  const access = await getProjectWithAccess(generation.projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  await prisma.aIGeneration.update({
    where: { id: generation.id },
    data: { rating: rating === 0 ? null : (rating as number) },
  });
  return Response.json({ ok: true });
}

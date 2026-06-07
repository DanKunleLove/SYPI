import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";

export async function GET() {
  try {
  const user = await getDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch owned projects
  const owned = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  // 2. Fetch collaborated/shared projects
  const collaborations = await prisma.collaborator.findMany({
    where: {
      OR: [
        { userId: user.id },
        { email: user.email.toLowerCase() }
      ],
      // Exclude projects owned by the user themselves
      project: {
        NOT: { userId: user.id }
      }
    },
    include: {
      project: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const shared = collaborations.map((c) => c.project);

  return Response.json({
    owned,
    shared,
    projects: [...owned, ...shared],
  });
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    console.error(`[GET /api/projects] code=${err?.code} msg=${err?.message} meta=${JSON.stringify(err?.meta)}`);
    return Response.json({ error: err?.message ?? "internal" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
  const user = await getDbUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const name =
    typeof body.name === "string" ? body.name.trim() || "Untitled Project" : "Untitled Project";
  const description =
    typeof body.description === "string" ? body.description.trim() || null : null;

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name,
      description,
    },
  });

  return Response.json({ project }, { status: 201 });
  } catch (e: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    console.error(`[POST /api/projects] code=${err?.code} msg=${err?.message} meta=${JSON.stringify(err?.meta)}`);
    return Response.json({ error: err?.message ?? "internal" }, { status: 500 });
  }
}

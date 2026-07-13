import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";

export async function GET() {
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
}

export async function POST(request: Request) {
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
    typeof body.name === "string"
      ? body.name.trim().slice(0, 120) || "Untitled Project"
      : "Untitled Project";
  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 500) || null
      : null;

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name,
      description,
    },
  });

  return Response.json({ project }, { status: 201 });
}

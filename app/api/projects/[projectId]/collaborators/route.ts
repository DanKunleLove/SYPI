import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import type { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Check caller is owner or collaborator
  const isOwner = project.userId === user.id;

  if (!isOwner) {
    const collab = await prisma.collaborator.findFirst({
      where: {
        projectId,
        OR: [{ userId: user.id }, { email: user.email.toLowerCase() }],
      },
    });
    if (!collab) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const collaborators = await prisma.collaborator.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  // Enrich with Clerk user data
  const clerk = await clerkClient();
  const enriched = await Promise.all(
    collaborators.map(async (c) => {
      try {
        const users = await clerk.users.getUserList({
          emailAddress: [c.email],
        });
        const clerkUser = users.data[0];
        return {
          id: c.id,
          email: c.email,
          role: c.role,
          title: c.title,
          name: clerkUser
            ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null
            : null,
          imageUrl: clerkUser?.imageUrl ?? null,
          hasAccount: !!clerkUser,
        };
      } catch {
        return {
          id: c.id,
          email: c.email,
          role: c.role,
          title: c.title,
          name: null,
          imageUrl: null,
          hasAccount: false,
        };
      }
    })
  );

  // Enrich the owner
  const ownerUser = await prisma.user.findUnique({ where: { id: project.userId } });
  const owner = {
    userId: project.userId,
    name: ownerUser?.name ?? null,
    imageUrl: ownerUser?.imageUrl ?? null,
    email: ownerUser?.email ?? null,
  };

  return Response.json({
    owner,
    collaborators: enriched,
    isOwner,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Only owner can invite
  if (project.userId !== user.id) {
    return Response.json({ error: "Only the project owner can invite collaborators" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = (body.email as string | undefined)?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email" }, { status: 400 });
  }

  // Check self-invite
  if (email === user.email.toLowerCase()) {
    return Response.json({ error: "That's you" }, { status: 400 });
  }

  // Check duplicate
  const existing = await prisma.collaborator.findUnique({
    where: { projectId_email: { projectId, email } },
  });
  if (existing) {
    return Response.json({ error: "Already added" }, { status: 409 });
  }

  // Try to link to existing user
  const invitedUser = await prisma.user.findUnique({ where: { email } });

  const collaborator = await prisma.collaborator.create({
    data: {
      projectId,
      email,
      userId: invitedUser?.id ?? null,
      role: "EDITOR",
    },
  });

  // Enrich the new collaborator with Clerk data
  const clerk = await clerkClient();
  let name: string | null = null;
  let imageUrl: string | null = null;
  let hasAccount = false;

  try {
    const users = await clerk.users.getUserList({ emailAddress: [email] });
    const clerkUser = users.data[0];
    if (clerkUser) {
      name = `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null;
      imageUrl = clerkUser.imageUrl ?? null;
      hasAccount = true;
    }
  } catch {
    // Clerk lookup failed
  }

  return Response.json(
    {
      collaborator: {
        id: collaborator.id,
        email: collaborator.email,
        role: collaborator.role,
        title: collaborator.title,
        name,
        imageUrl,
        hasAccount,
      },
    },
    { status: 201 }
  );
}

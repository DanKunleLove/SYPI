import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Project } from "@/app/generated/prisma/client";

/** Resolve the internal User record from Clerk auth. Returns null if unauthenticated or user not synced. */
export async function getDbUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const user = await prisma.user.findUnique({ where: { clerkId } });
  return user;
}

/** Get the current authenticated user's identity (Clerk-level) */
export async function getIdentity() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null;

  return { userId, email };
}

type AccessResult =
  | { project: null; role: null; reason: "unauthenticated" | "not-found" | "forbidden" | "user-not-synced" }
  | { project: Project; role: "owner" | "editor" | "viewer"; reason: null };

/** Fetch a project and verify the caller has access */
export async function getProjectWithAccess(projectId: string): Promise<AccessResult> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return { project: null, role: null, reason: "unauthenticated" };

  const dbUser = await prisma.user.findUnique({ where: { clerkId } });
  if (!dbUser) return { project: null, role: null, reason: "user-not-synced" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) return { project: null, role: null, reason: "not-found" };

  if (project.userId === dbUser.id) {
    return { project, role: "owner", reason: null };
  }

  // Check collaborator access
  const collab = await prisma.collaborator.findFirst({
    where: {
      projectId,
      OR: [
        { userId: dbUser.id },
        { email: dbUser.email.toLowerCase() },
      ],
    },
  });

  if (!collab) {
    return { project: null, role: null, reason: "forbidden" };
  }

  const roleMap = { OWNER: "owner", EDITOR: "editor", VIEWER: "viewer" } as const;
  return { project, role: roleMap[collab.role], reason: null };
}

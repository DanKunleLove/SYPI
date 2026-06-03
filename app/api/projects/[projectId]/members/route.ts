import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectWithAccess } from "@/lib/project-access";
import { getCursorColor } from "@/lib/liveblocks";

/**
 * Project members who have an account, keyed by Clerk userId — the identifier
 * Liveblocks uses (set via prepareSession in the auth route). Powers
 * `resolveUsers` (clerkId → name/avatar) and `resolveMentionSuggestions`
 * (the @mention list) for Comments.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    const status =
      access.reason === "not-found" ? 404 :
      access.reason === "unauthenticated" ? 401 : 403;
    return Response.json({ error: access.reason ?? "Forbidden" }, { status });
  }

  const collaborators = await prisma.collaborator.findMany({
    where: { projectId },
    select: { email: true },
  });

  // Resolve every member (owner + collaborators) to a User row, which carries
  // the clerkId. Email-only invitees who haven't signed in yet have no User
  // row, so they can't be @mentioned — they're simply omitted.
  const emails = collaborators.map((c) => c.email.toLowerCase());
  const users = await prisma.user.findMany({
    where: {
      OR: [{ id: access.project.userId }, { email: { in: emails } }],
    },
    select: { clerkId: true, name: true, email: true, imageUrl: true },
  });

  const members = users.map((u) => ({
    id: u.clerkId,
    name: u.name ?? u.email,
    avatar: u.imageUrl ?? "",
    cursorColor: getCursorColor(u.clerkId),
    email: u.email,
  }));

  return Response.json({ members });
}

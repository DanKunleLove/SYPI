import { auth, currentUser } from "@clerk/nextjs/server";
import { getLiveblocks, getCursorColor } from "@/lib/liveblocks";
import { getProjectWithAccess } from "@/lib/project-access";

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { room } = body;

  if (!room || typeof room !== "string") {
    return Response.json({ error: "Missing room ID" }, { status: 400 });
  }

  // Verify the user has access to this project
  const { project, reason } = await getProjectWithAccess(room);

  if (!project) {
    const status = reason === "not-found" ? 404 : reason === "user-not-synced" ? 401 : 403;
    return Response.json(
      { error: reason === "not-found" ? "Project not found" : "Forbidden" },
      { status }
    );
  }

  const liveblocks = getLiveblocks();

  // Ensure the Liveblocks room exists with metadata
  await liveblocks.getOrCreateRoom(room, {
    defaultAccesses: [],
    metadata: {
      projectName: project.name,
      ownerId: project.userId,
    },
  });

  // Get user info for the session token
  const user = await currentUser();
  const name =
    user?.fullName ?? user?.firstName ?? user?.username ?? "Anonymous";
  const avatar = user?.imageUrl ?? "";

  // Create a session with user info and room access
  const session = liveblocks.prepareSession(userId, {
    userInfo: {
      name,
      avatar,
      cursorColor: getCursorColor(userId),
    },
  });

  session.allow(room, session.FULL_ACCESS);

  const { status, body: responseBody } = await session.authorize();
  return new Response(responseBody, { status });
}

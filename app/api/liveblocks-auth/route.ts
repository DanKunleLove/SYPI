import { auth, currentUser } from "@clerk/nextjs/server";
import { getLiveblocks, getCursorColor } from "@/lib/liveblocks";
import { getProjectWithAccess } from "@/lib/project-access";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const room = body.room as string | undefined;

    if (!room || typeof room !== "string") {
      return Response.json({ error: "Missing room ID" }, { status: 400 });
    }

    // Verify the user has access to this project
    const accessResult = await getProjectWithAccess(room);

    if (!accessResult.project) {
      console.error("[liveblocks-auth] Access denied:", accessResult.reason, "room:", room);
      const status =
        accessResult.reason === "not-found" ? 404 :
        accessResult.reason === "unauthenticated" ? 401 : 403;
      return Response.json(
        { error: accessResult.reason ?? "Forbidden" },
        { status }
      );
    }

    const { project } = accessResult;

    if (!process.env.LIVEBLOCKS_SECRET_KEY) {
      console.error("[liveblocks-auth] LIVEBLOCKS_SECRET_KEY is not set");
      return Response.json({ error: "Liveblocks not configured" }, { status: 500 });
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
  } catch (error) {
    console.error("[liveblocks-auth] Unhandled error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

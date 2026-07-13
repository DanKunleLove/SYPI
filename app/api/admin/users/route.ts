import { prisma } from "@/lib/prisma";
import { getAdminUser, getAdminUsers } from "@/lib/admin";

/** Admin: list/search users with a 30-day AI usage rollup. */
export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });

  const q = new URL(request.url).searchParams.get("q");
  const users = await getAdminUsers(q);
  return Response.json({ users });
}

/** Admin: update a user's platform role, status, or generate-quota override. */
export async function PATCH(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });

  let body: {
    userId?: unknown;
    platformRole?: unknown;
    status?: unknown;
    dailyGenLimit?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : null;
  if (!userId) return Response.json({ error: "userId is required" }, { status: 400 });

  // No self-demotion/suspension — prevents locking yourself out of admin.
  if (userId === admin.id && (body.platformRole !== undefined || body.status !== undefined)) {
    return Response.json(
      { error: "You can't change your own role or status" },
      { status: 400 }
    );
  }

  const data: { platformRole?: string; status?: string; dailyGenLimit?: number | null } = {};
  if (body.platformRole !== undefined) {
    if (body.platformRole !== "user" && body.platformRole !== "admin") {
      return Response.json({ error: "platformRole must be user or admin" }, { status: 400 });
    }
    data.platformRole = body.platformRole;
  }
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "suspended") {
      return Response.json({ error: "status must be active or suspended" }, { status: 400 });
    }
    data.status = body.status;
  }
  if (body.dailyGenLimit !== undefined) {
    if (body.dailyGenLimit === null) {
      data.dailyGenLimit = null;
    } else if (
      typeof body.dailyGenLimit === "number" &&
      Number.isInteger(body.dailyGenLimit) &&
      body.dailyGenLimit >= 0 &&
      body.dailyGenLimit <= 100_000
    ) {
      data.dailyGenLimit = body.dailyGenLimit;
    } else {
      return Response.json(
        { error: "dailyGenLimit must be null or an integer 0-100000" },
        { status: 400 }
      );
    }
  }
  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      platformRole: true,
      status: true,
      dailyGenLimit: true,
    },
  });
  return Response.json({ user: updated });
}

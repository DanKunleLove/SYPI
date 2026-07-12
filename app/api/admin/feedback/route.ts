import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/admin";

const STATUSES = new Set(["open", "in_progress", "resolved"]);

/** Admin: list feedback (newest first, optional ?status= filter). */
export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const feedback = await prisma.feedback.findMany({
    where: status && STATUSES.has(status) ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { email: true, name: true } } },
  });

  return Response.json({ feedback });
}

/** Admin: update a feedback item's status/adminNote. */
export async function PATCH(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { id?: unknown; status?: unknown; adminNote?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const data: { status?: string; adminNote?: string | null } = {};
  if (typeof body.status === "string" && STATUSES.has(body.status)) {
    data.status = body.status;
  }
  if (typeof body.adminNote === "string") {
    data.adminNote = body.adminNote.slice(0, 2000) || null;
  }
  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.feedback.update({ where: { id }, data });
  return Response.json({ feedback: updated });
}

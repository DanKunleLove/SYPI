import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/admin";
import { PLATFORM_FLAGS } from "@/lib/flags";

/** Admin: current state of every platform flag (missing row = enabled). */
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });

  const rows = await prisma.platformFlag.findMany();
  const byId = new Map(rows.map((r) => [r.id, r.enabled]));
  const flags = PLATFORM_FLAGS.map((f) => ({
    ...f,
    enabled: byId.get(f.id) ?? true,
  }));
  return Response.json({ flags });
}

/** Admin: flip a platform flag. */
export async function PATCH(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });

  let body: { id?: unknown; enabled?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : null;
  if (!id || !PLATFORM_FLAGS.some((f) => f.id === id)) {
    return Response.json({ error: "Unknown flag" }, { status: 400 });
  }
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  const flag = await prisma.platformFlag.upsert({
    where: { id },
    create: { id, enabled: body.enabled },
    update: { enabled: body.enabled },
  });
  return Response.json({ flag });
}

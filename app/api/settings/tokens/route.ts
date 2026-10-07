import { getDbUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { MAX_TOKENS_PER_USER, createToken } from "@/lib/mcp/tokens";

const select = { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true } as const;

/** List the user's tokens. Hashes and raw tokens are never returned. */
export async function GET() {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    select,
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ tokens });
}

/** Create a token. The raw value is in this response only — it cannot be shown again. */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";

  const count = await prisma.apiToken.count({ where: { userId: user.id } });
  if (count >= MAX_TOKENS_PER_USER) {
    return Response.json(
      { error: `You have ${count} tokens. Revoke one before creating another.` },
      { status: 400 }
    );
  }

  const { token, record } = await createToken(user.id, name);
  return Response.json({ token, record });
}

/** Revoke one token: DELETE ?id=… */
export async function DELETE(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  // userId in the filter: you can only revoke your own.
  const { count } = await prisma.apiToken.deleteMany({ where: { id, userId: user.id } });
  if (!count) return Response.json({ error: "Token not found" }, { status: 404 });
  return Response.json({ ok: true });
}

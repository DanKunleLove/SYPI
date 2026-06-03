import { getDbUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { parseModelRef } from "@/lib/ai/providers";

/** Set (or clear) the user's default model. Must reference a provider they have a key for. */
export async function PUT(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { defaultModel?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { defaultModel } = body;

  // null/empty clears the preference (falls back to platform default).
  if (defaultModel === null || defaultModel === "") {
    await prisma.user.update({ where: { id: user.id }, data: { defaultModel: null } });
    return Response.json({ ok: true, defaultModel: null });
  }

  if (typeof defaultModel !== "string") {
    return Response.json({ error: "Invalid model" }, { status: 400 });
  }

  const ref = parseModelRef(defaultModel);
  if (!ref) {
    return Response.json({ error: "Unknown model" }, { status: 400 });
  }

  const key = await prisma.userApiKey.findUnique({
    where: { userId_provider: { userId: user.id, provider: ref.provider } },
    select: { id: true },
  });
  if (!key) {
    return Response.json(
      { error: `Add a ${ref.provider} key before selecting this model` },
      { status: 400 }
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { defaultModel } });
  return Response.json({ ok: true, defaultModel });
}

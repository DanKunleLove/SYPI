import { prisma } from "@/lib/prisma";

/** Same caps the browser route has always applied. */
export function cleanProjectFields(input: { name?: unknown; description?: unknown }) {
  const name =
    typeof input.name === "string" ? input.name.trim().slice(0, 120) || "Untitled Project" : "Untitled Project";
  const description =
    typeof input.description === "string" ? input.description.trim().slice(0, 500) || null : null;
  return { name, description };
}

/**
 * Create a project for a user.
 *
 * `reuseRecent` is for callers that may be retried by something outside our
 * control — an MCP host re-sending a tool call after a timeout. An identical
 * project from the same user in the last few minutes is returned instead of a
 * second one. The browser does not pass it: two clicks there are two intents.
 */
export async function createProjectForUser(
  userId: string,
  input: { name?: unknown; description?: unknown },
  options: { reuseRecent?: boolean } = {}
) {
  const { name, description } = cleanProjectFields(input);

  if (options.reuseRecent) {
    const existing = await prisma.project.findFirst({
      where: {
        userId,
        name,
        description,
        createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return { project: existing, reused: true };
  }

  const project = await prisma.project.create({ data: { userId, name, description } });
  return { project, reused: false };
}

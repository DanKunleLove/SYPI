import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Personal access tokens — how an agent outside the browser proves who it is.
 *
 * Only a SHA-256 hash is stored. The raw token exists once, in the response that
 * creates it; a database leak yields nothing usable. SHA-256 rather than a slow
 * hash is deliberate: the token is 256 bits of randomness, so there is nothing to
 * brute-force, and every MCP request verifies one.
 */

const PREFIX = "sypi_";
/** A user managing more than this is a sign something is scripting token creation. */
export const MAX_TOKENS_PER_USER = 10;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createToken(userId: string, name: string) {
  const token = `${PREFIX}${randomBytes(32).toString("base64url")}`;
  const record = await prisma.apiToken.create({
    data: {
      userId,
      name: name.trim().slice(0, 60) || "Untitled token",
      tokenHash: hashToken(token),
      prefix: token.slice(0, PREFIX.length + 6),
    },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
  });
  return { token, record };
}

/**
 * Keep only the newest `keep` tokens with this exact name. Reconnecting a client
 * through OAuth mints a fresh token each time; without this the ten-token cap
 * fills with "ChatGPT (OAuth)" and the user is locked out of making their own.
 */
export async function pruneTokensNamed(userId: string, name: string, keep: number) {
  const same = await prisma.apiToken.findMany({
    where: { userId, name },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const stale = same.slice(keep).map((t) => t.id);
  if (stale.length) await prisma.apiToken.deleteMany({ where: { userId, id: { in: stale } } });
}

/**
 * Resolve a bearer token to its user. Null for anything invalid — including a
 * suspended account, so suspension reaches programmatic access too.
 */
export async function userFromToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];
  if (!token || !token.startsWith(PREFIX)) return null;

  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!record || record.user.status === "suspended") return null;

  // Write at most every five minutes: an agent can make dozens of calls a minute.
  const stale = !record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 5 * 60_000;
  if (stale) {
    await prisma.apiToken
      .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }
  return record.user;
}

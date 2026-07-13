import { getDbUser } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";

/**
 * Admin gating: DB role (`User.platformRole === "admin"`, managed from
 * /admin/users) with ADMIN_EMAILS env as the bootstrap/superadmin list —
 * emails there are admins even before the DB role is set, and get promoted
 * on first touch so the role is visible and queryable in the DB.
 * Returns the DB user when they are an admin, null otherwise.
 */
export async function getAdminUser() {
  const user = await getDbUser();
  if (!user) return null;

  if (user.platformRole === "admin") return user;

  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return null;
  const admins = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes(user.email.toLowerCase())) return null;

  await prisma.user
    .update({ where: { id: user.id }, data: { platformRole: "admin" } })
    .catch(() => {});
  return { ...user, platformRole: "admin" };
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  platformRole: string;
  status: string;
  dailyGenLimit: number | null;
  createdAt: string;
  projects: number;
  byokKeys: number;
  aiCalls30d: number;
  generations30d: number;
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** User list + 30-day AI usage rollup for the admin Users page. */
export async function getAdminUsers(q?: string | null): Promise<AdminUserRow[]> {
  const query = q?.trim();
  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      platformRole: true,
      status: true,
      dailyGenLimit: true,
      createdAt: true,
      _count: { select: { ownedProjects: true, apiKeys: true } },
    },
  });

  const ids = users.map((u) => u.id);
  const events = ids.length
    ? await prisma.usageEvent.groupBy({
        by: ["userId", "type"],
        where: {
          userId: { in: ids },
          type: { startsWith: "ai:" },
          createdAt: { gte: new Date(Date.now() - MONTH_MS) },
        },
        _count: { _all: true },
      })
    : [];

  const totals = new Map<string, { all: number; generate: number }>();
  for (const e of events) {
    const t = totals.get(e.userId) ?? { all: 0, generate: 0 };
    t.all += e._count._all;
    if (e.type === "ai:generate") t.generate += e._count._all;
    totals.set(e.userId, t);
  }

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    platformRole: u.platformRole,
    status: u.status,
    dailyGenLimit: u.dailyGenLimit,
    createdAt: u.createdAt.toISOString(),
    projects: u._count.ownedProjects,
    byokKeys: u._count.apiKeys,
    aiCalls30d: totals.get(u.id)?.all ?? 0,
    generations30d: totals.get(u.id)?.generate ?? 0,
  }));
}

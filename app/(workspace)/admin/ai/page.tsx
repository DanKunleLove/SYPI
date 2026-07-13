import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { PLATFORM_FLAGS } from "@/lib/flags";
import { AdminNav } from "@/components/admin/admin-nav";
import { FlagsPanel, type FlagState } from "@/components/admin/flags-panel";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_STYLES: Record<string, string> = {
  completed: "text-[var(--state-success)]",
  failed: "text-[var(--state-error)]",
  running: "text-[var(--state-warning)]",
  pending: "text-[var(--text-muted)]",
};

export default async function AdminAiPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const dayAgo = new Date(Date.now() - DAY_MS);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);

  const [flagRows, usage24h, failures7d, recent] = await Promise.all([
    prisma.platformFlag.findMany(),
    prisma.usageEvent.groupBy({
      by: ["type"],
      where: { type: { startsWith: "ai:" }, createdAt: { gte: dayAgo } },
      _count: { _all: true },
    }),
    prisma.aIGeneration.count({
      where: { status: "failed", createdAt: { gte: weekAgo } },
    }),
    prisma.aIGeneration.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        status: true,
        rating: true,
        prompt: true,
        error: true,
        createdAt: true,
        project: { select: { name: true, user: { select: { email: true } } } },
      },
    }),
  ]);

  const flagsById = new Map(flagRows.map((r) => [r.id, r.enabled]));
  const flags: FlagState[] = PLATFORM_FLAGS.map((f) => ({
    ...f,
    enabled: flagsById.get(f.id) ?? true,
  }));

  const usage = usage24h
    .map((u) => ({ kind: u.type.slice(3), count: u._count._all }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Admin</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          AI operations: platform switches, usage, and recent generations.
        </p>
        <AdminNav active="/admin/ai" />

        <div className="mt-6 space-y-8">
          <FlagsPanel initial={flags} />

          <section>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              AI calls — last 24h
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {usage.length === 0 && (
                <p className="text-xs text-[var(--text-muted)]">No AI calls in the last 24h.</p>
              )}
              {usage.map((u) => (
                <div
                  key={u.kind}
                  className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2"
                >
                  <div className="text-lg font-semibold text-[var(--text-primary)]">
                    {u.count}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                    {u.kind}
                  </div>
                </div>
              ))}
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
                <div
                  className={cn(
                    "text-lg font-semibold",
                    failures7d > 0 ? "text-[var(--state-error)]" : "text-[var(--text-primary)]"
                  )}
                >
                  {failures7d}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  failures 7d
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Recent generations
            </h2>
            <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border-default)]">
              <table className="w-full min-w-[720px] text-left text-[12px]">
                <thead className="bg-[var(--bg-surface)] text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Rating</th>
                    <th className="px-3 py-2 font-medium">Prompt</th>
                    <th className="px-3 py-2 font-medium">Project / owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                  {recent.map((g) => (
                    <tr key={g.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-[var(--text-secondary)]">
                        {g.createdAt.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{g.type}</td>
                      <td
                        className={cn(
                          "px-3 py-2 font-medium",
                          STATUS_STYLES[g.status] ?? "text-[var(--text-secondary)]"
                        )}
                        title={g.error ?? undefined}
                      >
                        {g.status}
                      </td>
                      <td className="px-3 py-2">
                        {g.rating === 1 ? "👍" : g.rating === -1 ? "👎" : "—"}
                      </td>
                      <td className="max-w-[280px] truncate px-3 py-2 text-[var(--text-secondary)]">
                        {g.prompt}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">
                        {g.project.name} · {g.project.user.email}
                      </td>
                    </tr>
                  ))}
                  {recent.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-center text-xs text-[var(--text-muted)]"
                      >
                        No generations yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

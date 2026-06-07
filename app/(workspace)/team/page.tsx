import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import { redirect } from "next/navigation";
import { Users, FolderOpen, UserPlus } from "lucide-react";

export const metadata = { title: "Team" };

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  title: string | null;
  role: string;
  projects: { id: string; name: string }[];
}

export default async function TeamPage() {
  const user = await getDbUser();
  if (!user) redirect("/sign-in");

  // Fetch all collaborators on projects the user owns
  const collabs = await prisma.collaborator.findMany({
    where: {
      project: { userId: user.id },
    },
    include: {
      project: { select: { id: true, name: true } },
      user: { select: { name: true, imageUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Merge collaborators by email (a person may be on multiple projects)
  const byEmail = new Map<string, TeamMember>();
  for (const c of collabs) {
    const existing = byEmail.get(c.email);
    const projectEntry = { id: c.project.id, name: c.project.name };
    if (existing) {
      existing.projects.push(projectEntry);
    } else {
      byEmail.set(c.email, {
        id: c.id,
        email: c.email,
        name: c.user?.name ?? null,
        imageUrl: c.user?.imageUrl ?? null,
        title: c.title ?? null,
        role: c.role,
        projects: [projectEntry],
      });
    }
  }

  const members = Array.from(byEmail.values());

  const roleLabel = (r: string) =>
    r === "VIEWER" ? "Viewer" : r === "OWNER" ? "Owner" : "Editor";

  const initial = (name: string | null, email: string) =>
    (name ?? email).charAt(0).toUpperCase();

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--accent-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Team</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Everyone with access to your projects — invite more from the canvas Share button.
          </p>
        </div>
        <span className="rounded-full bg-[var(--bg-surface-raised)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
      </div>

      {members.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10">
            <UserPlus className="h-7 w-7 text-[var(--accent-primary)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">No teammates yet</h3>
          <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
            Open any project canvas, click the Share button in the toolbar, and invite teammates by email.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div
              key={m.email}
              className="flex items-start gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-subtle)] transition-colors"
            >
              {/* Avatar */}
              {m.imageUrl ? (
                <img
                  src={m.imageUrl}
                  alt={m.name ?? m.email}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/20 text-sm font-semibold text-[var(--accent-primary)]">
                  {initial(m.name, m.email)}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {m.name ?? m.email}
                  </span>
                  {m.title && (
                    <span className="rounded-full bg-[var(--accent-ai)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent-ai)]">
                      {m.title}
                    </span>
                  )}
                  <span className="rounded-full bg-[var(--bg-surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
                    {roleLabel(m.role)}
                  </span>
                </div>
                {m.name && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{m.email}</p>
                )}

                {/* Projects */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.projects.map((p) => (
                    <a
                      key={p.id}
                      href={`/${p.id}`}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)] transition-colors"
                    >
                      <FolderOpen className="h-2.5 w-2.5" />
                      {p.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-[var(--text-muted)]">
        To set a teammate&apos;s discipline title or change their access level, open the project canvas → Share → edit their row.
      </p>
    </div>
  );
}

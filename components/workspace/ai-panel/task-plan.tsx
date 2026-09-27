"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardCopy, ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TaskPlan } from "@/lib/uss/tasks";

type TaskResponse = TaskPlan & { exists: boolean };

/**
 * The build plan — requirements → design → ordered tasks.
 *
 * Every row is derived from the spec: which requirements it delivers, what has to
 * exist first, and which open question could change it. Copying gives tasks.md in
 * the GitHub Spec Kit shape, so it drops into an agent's repository unchanged.
 */
export function TaskPlanCard({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TaskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/uss/${projectId}/tasks`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setData(d as TaskResponse | null))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const copyMarkdown = async () => {
    try {
      const res = await fetch(`/api/uss/${projectId}/tasks?format=md`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await navigator.clipboard.writeText(await res.text());
      toast.success("tasks.md copied", { description: "Spec Kit format — paste it into your repo." });
    } catch {
      toast.error("Could not copy the task list");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Ordering the build…
      </div>
    );
  }

  if (!data?.exists || data.tasks.length === 0) return null;

  const blocked = data.tasks.filter((t) => t.blockedBy.length > 0).length;
  const visible = expanded ? data.tasks : data.tasks.slice(0, 8);

  return (
    <div className="space-y-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Build plan
          </span>
        </div>
        <button
          type="button"
          onClick={() => void copyMarkdown()}
          className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          title="Copy as tasks.md (GitHub Spec Kit format)"
        >
          <ClipboardCopy className="h-3 w-3" />
          tasks.md
        </button>
      </div>

      <p className="text-[11px] tabular-nums text-[var(--text-muted)]">
        {data.tasks.length} tasks in {data.phases.length} phases
        {blocked > 0 && ` · ${blocked} waiting on an answer`}
      </p>

      {data.cycles.length > 0 && (
        <p className="rounded-md bg-[var(--state-warning)]/10 px-2.5 py-1.5 text-[11px] text-[var(--state-warning)]">
          {data.cycles.length} components depend on each other in a loop — break it before building.
        </p>
      )}

      <ol className="space-y-1.5">
        {visible.map((t) => (
          <li key={t.id} className="flex items-start gap-1.5">
            <span className="mt-px w-8 shrink-0 font-mono text-[10px] text-[var(--text-muted)]">{t.id}</span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[11px] leading-snug",
                  t.kind === "unassigned" ? "text-[var(--state-warning)]" : "text-[var(--text-secondary)]"
                )}
              >
                {t.title}
                {t.parallel && <span className="ml-1 text-[10px] text-[var(--text-muted)]">[P]</span>}
              </p>
              {(t.satisfies.length > 0 || t.dependsOn.length > 0) && (
                <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">
                  {t.satisfies.length > 0 && `delivers ${t.satisfies.join(", ")}`}
                  {t.satisfies.length > 0 && t.dependsOn.length > 0 && " · "}
                  {t.dependsOn.length > 0 && `after ${t.dependsOn.join(", ")}`}
                </p>
              )}
              {t.blockedBy.slice(0, 1).map((b) => (
                <p key={b.id} className="mt-0.5 flex items-start gap-1 text-[10px] leading-snug text-[var(--state-warning)]">
                  <AlertTriangle className="mt-px h-2.5 w-2.5 shrink-0" />
                  {b.question}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {data.tasks.length > 8 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          {expanded ? "Show fewer" : `Show all ${data.tasks.length}`}
        </button>
      )}
    </div>
  );
}

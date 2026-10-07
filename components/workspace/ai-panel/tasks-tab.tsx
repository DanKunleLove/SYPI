"use client";

import { ListChecks } from "lucide-react";
import { TaskPlanCard } from "./task-plan";

export function TasksTab({ projectId }: { projectId: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      <div className="mb-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
        <div className="flex items-start gap-2">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-ai)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">Build Plan</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Ordered tasks are derived from the spec and traced back to requirements,
              component dependencies, and unresolved questions.
            </p>
          </div>
        </div>
      </div>
      <TaskPlanCard projectId={projectId} />
    </div>
  );
}

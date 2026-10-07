"use client";

import { ShieldAlert } from "lucide-react";
import { ScenarioMatrix } from "./scenario-matrix";

export function RisksTab({ projectId }: { projectId: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      <div className="mb-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-ai)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">Risk Radar</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              Deterministic failure scenarios show what the architecture proves, what
              would fail, and what remains unknown.
            </p>
          </div>
        </div>
      </div>
      <ScenarioMatrix projectId={projectId} />
    </div>
  );
}

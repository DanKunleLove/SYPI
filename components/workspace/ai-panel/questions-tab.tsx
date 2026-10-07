"use client";

import { HelpCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SpecHead } from "@/hooks/use-system-spec";

export function QuestionsTab({
  spec,
  onOpenChatDecisions,
}: {
  spec: SpecHead | null;
  onOpenChatDecisions: () => void;
}) {
  const decisions = spec?.decisions ?? [];

  if (!spec?.exists || decisions.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-ai)]/10">
          <HelpCircle className="h-6 w-6 text-[var(--accent-ai)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">No material questions</p>
          <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-[var(--text-muted)]">
            Once the design has unresolved decisions that would change what gets built,
            they will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
        <div className="flex items-start gap-2">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-ai)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">Open Questions</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
              These are the decisions most likely to change the architecture, roadmap, or
              handoff. Answering them keeps the spec from inventing business rules.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onOpenChatDecisions}
          className="mt-3 w-full gap-2 bg-[var(--accent-ai)] text-xs text-white hover:bg-[var(--accent-ai)]/90"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Answer in Chat
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {decisions.map((decision) => (
          <div
            key={decision.id}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[var(--text-muted)]">
                {decision.id}
              </span>
              <span className="rounded-md bg-[var(--bg-surface-raised)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                {decision.category}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-primary)]">
              {decision.question}
            </p>
            {decision.why && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                {decision.why}
              </p>
            )}
            {decision.options.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {decision.options.map((option) => (
                  <span
                    key={option.label}
                    title={option.implication}
                    className="rounded-md border border-[var(--border-default)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
                  >
                    {option.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

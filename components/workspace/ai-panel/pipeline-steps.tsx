"use client";

import { AlertTriangle, Check, Loader2, Minus, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleSteps, type PipelineStepState } from "@/lib/ai/pipeline";

/**
 * The run, as a live checklist.
 *
 * The whole plan is rendered up front with every step greyed out, rather than
 * appearing one row at a time. That is the difference between "something is
 * happening" and "it knows what it is doing", and it is the reason a
 * multi-minute run does not feel like a hang.
 *
 * A failed step names itself and offers a retry. Retrying costs nothing: every
 * step before it is already committed to the spec, so the run picks up where it
 * stopped rather than starting over.
 */
export function PipelineSteps({
  steps,
  onRetry,
  retrying,
}: {
  steps: PipelineStepState[];
  onRetry?: () => void;
  retrying?: boolean;
}) {
  if (steps.length === 0) return null;
  const shown = visibleSteps(steps);
  const failed = shown.find((s) => s.status === "failed");

  return (
    <div className="space-y-1.5 rounded-lg border border-[var(--accent-ai)]/20 bg-[var(--accent-ai)]/5 p-3">
      {shown.map((step) => (
        <div key={step.id} className="flex items-start gap-2">
          <StepIcon status={step.status} />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[11px] leading-snug",
                step.status === "pending"
                  ? "text-[var(--text-muted)]/60"
                  : step.status === "failed"
                    ? "text-[var(--state-error)]"
                    : step.status === "running"
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)]"
              )}
            >
              {step.label}
            </p>
            {(step.detail || step.error) && (
              <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">
                {step.error ?? step.detail}
              </p>
            )}
          </div>
          {step.ms !== undefined && step.status === "done" && (
            <span className="shrink-0 text-[10px] tabular-nums text-[var(--text-muted)]/60">
              {Math.round(step.ms / 1000)}s
            </span>
          )}
        </div>
      ))}

      {failed && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--border-default)] px-2 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-ai)]/40 hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          {retrying ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RotateCw className="h-3 w-3" />
          )}
          {/* Named, so it is obvious only the failed step re-runs. */}
          Retry &ldquo;{failed.label}&rdquo;
        </button>
      )}
    </div>
  );
}

function StepIcon({ status }: { status: PipelineStepState["status"] }) {
  switch (status) {
    case "running":
      return <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-[var(--accent-ai)]" />;
    case "done":
      return <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--state-success)]" />;
    case "skipped":
      return <Minus className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-muted)]/60" />;
    case "failed":
      return <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--state-error)]" />;
    default:
      return (
        <div className="mt-1 h-2 w-2 shrink-0 rounded-full border border-[var(--text-muted)]/30" />
      );
  }
}

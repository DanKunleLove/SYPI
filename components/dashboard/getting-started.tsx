"use client";

import { useState } from "react";
import { Check, Sparkles, ShieldCheck, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { recordEvent } from "@/lib/events";
import { dispatchCreateProject } from "@/hooks/use-create-project-event";
import type { ChecklistState, ChecklistStepId } from "@/lib/onboarding";

const STEP_META: Record<
  ChecklistStepId,
  { icon: typeof Sparkles; title: string; hint: string }
> = {
  generate: {
    icon: Sparkles,
    title: "Generate your first architecture",
    hint: "Open a project, describe your system to the AI Twin — or paste a URL.",
  },
  review: {
    icon: ShieldCheck,
    title: "Run an AI design review",
    hint: "Hit Review on the canvas toolbar to get a senior-grade critique.",
  },
  export: {
    icon: Package,
    title: "Export it — or generate a System Kit",
    hint: "Spec tab → PNG, Markdown, Mermaid, or the full System Kit ZIP.",
  },
};

/**
 * Getting-started checklist: steps auto-check from real usage (server-derived),
 * so it doubles as the user-facing side of the activation funnel. Hidden once
 * complete or dismissed.
 */
export function GettingStarted({ initial }: { initial: ChecklistState }) {
  const [hidden, setHidden] = useState(initial.dismissed || initial.complete);

  if (hidden) return null;

  const doneCount = initial.steps.filter((s) => s.done).length;
  const firstOpen = initial.steps.find((s) => !s.done)?.id;

  function dismiss() {
    setHidden(true);
    recordEvent("checklist_dismissed");
  }

  return (
    <section className="mb-6 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Getting started
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {doneCount}/{initial.steps.length} done — these check themselves off as you go.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss getting started"
          className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {initial.steps.map((step) => {
          const meta = STEP_META[step.id];
          const Icon = meta.icon;
          const isNext = step.id === firstOpen;
          return (
            <div
              key={step.id}
              className={cn(
                "rounded-lg border p-3",
                step.done
                  ? "border-[var(--state-success)]/30 bg-[var(--state-success)]/5"
                  : isNext
                    ? "border-[var(--accent-ai)]/40 bg-[var(--accent-ai)]/5"
                    : "border-[var(--border-default)]"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    step.done
                      ? "bg-[var(--state-success)] text-white"
                      : "border border-[var(--border-subtle)] text-[var(--text-muted)]"
                  )}
                >
                  {step.done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </div>
                <span
                  className={cn(
                    "text-[13px] font-medium",
                    step.done
                      ? "text-[var(--text-muted)] line-through"
                      : "text-[var(--text-primary)]"
                  )}
                >
                  {meta.title}
                </span>
              </div>
              {!step.done && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
                  {meta.hint}
                </p>
              )}
              {isNext && step.id === "generate" && (
                <button
                  type="button"
                  onClick={dispatchCreateProject}
                  className="mt-2 rounded-md bg-[var(--accent-ai)] px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                >
                  New project
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

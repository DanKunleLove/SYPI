"use client";

import { motion } from "framer-motion";
import { Check, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Suggestion } from "@/lib/ai/suggestions";

export function SuggestionsTab({
  suggestions,
  onDismiss,
  onApply,
}: {
  suggestions: Suggestion[];
  onDismiss: (id: string) => void;
  onApply: (action: string) => void;
}) {
  if (suggestions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-ai)]/10">
          <Lightbulb className="h-6 w-6 text-[var(--accent-ai)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">No suggestions yet</p>
        <p className="max-w-[240px] text-center text-xs text-[var(--text-muted)]">
          Add more components to your canvas and patterns will be detected automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="border-b border-[var(--border-default)] px-4 py-2.5">
        <p className="text-[11px] text-[var(--text-muted)]">
          {suggestions.length} pattern{suggestions.length !== 1 ? "s" : ""} detected · click Apply to fix with AI
        </p>
      </div>
      <div className="space-y-2 p-3">
        {suggestions.map((s) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3"
          >
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--text-primary)]">{s.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{s.message}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => onApply(s.suggestedAction)}
                className="h-6 gap-1 bg-[var(--accent-primary)] px-2 text-[10px] text-white hover:bg-[var(--accent-primary)]/90"
              >
                <Check className="h-3 w-3" />
                Apply with AI
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(s.id)}
                className="h-6 px-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Dismiss
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

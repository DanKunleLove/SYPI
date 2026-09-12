"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, HelpCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpecDecision, SpecHead } from "@/hooks/use-system-spec";

/**
 * Open decisions, above the composer.
 *
 * Three rules keep this an offer rather than a nag, and the feature lives or dies
 * on them:
 *   1. Only MATERIAL decisions appear — ones whose answer would change the design.
 *   2. At most three at a time.
 *   3. Collapsed by default. The user opens it; it never demands attention.
 */
export function OpenDecisionsTray({
  spec,
  onAnswer,
  answering,
}: {
  spec: SpecHead | null;
  onAnswer: (decision: SpecDecision, answer: string) => void;
  answering?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const decisions = (spec?.decisions ?? []).slice(0, 3);
  if (!spec?.exists || decisions.length === 0) return null;

  const total = spec.counts?.material ?? decisions.length;

  return (
    <div className="shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-surface)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-[11px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0 text-[var(--accent-ai)]" />
        <span className="flex-1 truncate">
          {total === 1
            ? "1 decision would change this design"
            : `${total} decisions would change this design`}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="max-h-[280px] space-y-2 overflow-y-auto px-3 pb-3">
              {decisions.map((d) => {
                const busy = answering === d.id;
                return (
                  <div
                    key={d.id}
                    className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-2.5"
                  >
                    <p className="text-[12px] leading-snug text-[var(--text-primary)]">
                      {d.question}
                    </p>
                    {d.why && (
                      <p className="mt-1 text-[10px] leading-snug text-[var(--text-muted)]">
                        {d.why}
                      </p>
                    )}

                    {d.options.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {d.options.map((o) => (
                          <button
                            key={o.label}
                            type="button"
                            disabled={busy}
                            title={o.implication}
                            onClick={() => onAnswer(d, o.label)}
                            className={cn(
                              "rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-40",
                              o.isDefault
                                ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5 text-[var(--text-primary)]"
                                : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-subtle)]"
                            )}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        value={drafts[d.id] ?? ""}
                        disabled={busy}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (drafts[d.id] ?? "").trim()) {
                            onAnswer(d, drafts[d.id].trim());
                            setDrafts((prev) => ({ ...prev, [d.id]: "" }));
                          }
                        }}
                        placeholder="Or answer in your own words…"
                        className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
                      />
                      {busy && (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--text-muted)]" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

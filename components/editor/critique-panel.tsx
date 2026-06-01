"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Shield,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IssueCard } from "@/components/editor/issue-card";
import type { CritiqueStatus } from "@/hooks/use-critique";
import type { CritiqueIssue } from "@/lib/ai/schemas";

interface CritiquePanelProps {
  open: boolean;
  onClose: () => void;
  status: CritiqueStatus;
  issues: CritiqueIssue[];
  summary: string;
  onDismissIssue: (index: number) => void;
  onFocusNode: (label: string) => void;
}

export function CritiquePanel({
  open,
  onClose,
  status,
  issues,
  summary,
  onDismissIssue,
  onFocusNode,
}: CritiquePanelProps) {
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const suggestionCount = issues.filter((i) => i.severity === "suggestion").length;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="flex h-full shrink-0 flex-col overflow-hidden border-l border-[var(--border-default)] bg-[var(--bg-surface)]"
        >
          {/* Header */}
          <div className="flex h-12 items-center justify-between border-b border-[var(--border-default)] px-4 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-primary)]/15">
                <Shield className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Design Review
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={onClose}
              aria-label="Close critique panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {status === "analyzing" || status === "submitting" ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
                <p className="text-sm text-[var(--text-muted)]">
                  Analyzing architecture...
                </p>
              </div>
            ) : status === "done" && issues.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--state-success)]/10">
                  <Shield className="h-6 w-6 text-[var(--state-success)]" />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  No issues found
                </p>
                <p className="text-xs text-[var(--text-muted)] text-center max-w-[240px]">
                  Your architecture looks good! Keep building.
                </p>
              </div>
            ) : status === "done" ? (
              <>
                {/* Summary */}
                {summary && (
                  <div className="border-b border-[var(--border-default)] px-4 py-3">
                    <p className="text-xs text-[var(--text-secondary)]">
                      {summary}
                    </p>
                    <div className="mt-2 flex gap-3">
                      {criticalCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--state-error)]">
                          <AlertCircle className="h-3 w-3" />
                          {criticalCount} critical
                        </span>
                      )}
                      {warningCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--state-warning)]">
                          <AlertTriangle className="h-3 w-3" />
                          {warningCount} warnings
                        </span>
                      )}
                      {suggestionCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--accent-primary)]">
                          <Lightbulb className="h-3 w-3" />
                          {suggestionCount} suggestions
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Issues list */}
                <ScrollArea className="flex-1">
                  <div className="space-y-2 p-3">
                    <AnimatePresence>
                      {issues.map((issue, i) => (
                        <IssueCard
                          key={`${issue.title}-${i}`}
                          issue={issue}
                          index={i}
                          onDismiss={() => onDismissIssue(i)}
                          onFocusNode={onFocusNode}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10">
                  <Shield className="h-6 w-6 text-[var(--accent-primary)]" />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Design Review
                </p>
                <p className="text-xs text-[var(--text-muted)] text-center max-w-[240px]">
                  Click Review in the toolbar to analyze your architecture for
                  issues and improvements.
                </p>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

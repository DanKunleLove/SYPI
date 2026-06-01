"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  AlertCircle,
  Lightbulb,
  ChevronDown,
  X,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CritiqueIssue } from "@/lib/ai/schemas";

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    color: "var(--state-error)",
    bgColor: "var(--state-error)",
    label: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    color: "var(--state-warning)",
    bgColor: "var(--state-warning)",
    label: "Warning",
  },
  suggestion: {
    icon: Lightbulb,
    color: "var(--accent-primary)",
    bgColor: "var(--accent-primary)",
    label: "Suggestion",
  },
} as const;

interface IssueCardProps {
  issue: CritiqueIssue;
  index: number;
  onDismiss: () => void;
  onFocusNode: (label: string) => void;
}

export function IssueCard({ issue, index, onDismiss, onFocusNode }: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const config = SEVERITY_CONFIG[issue.severity];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.05 }}
      className="group rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] overflow-hidden"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left"
      >
        <div
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: `color-mix(in srgb, ${config.bgColor} 15%, transparent)` }}
        >
          <Icon className="h-3 w-3" style={{ color: config.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            {issue.title}
          </p>
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
            {issue.affectedNodes.join(", ")}
          </p>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border-subtle)] px-3 py-2.5 space-y-2">
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {issue.description}
              </p>
              <div className="rounded-md bg-[var(--bg-surface)] px-2.5 py-2 text-[11px] text-[var(--text-primary)]">
                <span className="font-medium" style={{ color: config.color }}>
                  Fix:
                </span>{" "}
                {issue.suggestion}
              </div>
              <div className="flex items-center gap-1.5">
                {issue.affectedNodes.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onFocusNode(label)}
                    className="flex items-center gap-1 rounded-md bg-[var(--bg-surface-raised)] px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
                  >
                    <MousePointerClick className="h-3 w-3" />
                    {label}
                  </button>
                ))}
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDismiss}
                  className="h-6 w-6 text-[var(--text-muted)] hover:text-[var(--state-error)]"
                  title="Dismiss issue"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

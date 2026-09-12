"use client";

import { motion } from "framer-motion";
import { Check, Globe, Lightbulb, Loader2, Sparkles, Zap } from "lucide-react";
import type { CritiqueIssue } from "@/lib/ai/schemas";

/** Heavy agent tools rendered as action cards (light canvas tools stay chips). */
const TOOL_META: Record<string, { icon: typeof Sparkles; running: string }> = {
  "tool-generateArchitecture": { icon: Sparkles, running: "Designing the architecture…" },
  "tool-runDesignReview": { icon: Lightbulb, running: "Reviewing the design…" },
  "tool-refineArchitecture": { icon: Zap, running: "Applying changes…" },
  "tool-researchUrl": { icon: Globe, running: "Reading the site…" },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--state-error)",
  warning: "var(--state-warning)",
  suggestion: "var(--text-muted)",
};

export function ToolActionCard({
  part,
}: {
  part: { type: string; state: string; output?: unknown };
}) {
  const meta = TOOL_META[part.type];

  // Light canvas tools (addNode etc.) keep the compact chip.
  if (!meta) {
    return (
      <div className="mt-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)]">
        <span className="font-medium text-[var(--accent-ai)]">
          {part.type.replace(/^tool-/, "")}
        </span>
        {part.state === "output-available" && (
          <span className="ml-1.5 text-[var(--state-success)]">Done</span>
        )}
      </div>
    );
  }

  const Icon = meta.icon;

  // Running state — the user should always see work happening.
  if (part.state !== "output-available") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-1.5 flex items-center gap-2 rounded-lg border border-[var(--accent-ai)]/20 bg-[var(--accent-ai)]/5 px-3 py-2"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-ai)]" />
        <span className="text-xs font-medium text-[var(--accent-ai)]">{meta.running}</span>
      </motion.div>
    );
  }

  const output = (part.output ?? {}) as Record<string, unknown>;

  if (output.error) {
    return (
      <div className="mt-1.5 rounded-lg border border-[var(--state-error)]/25 bg-[var(--state-error)]/8 px-3 py-2 text-xs text-[var(--state-error)]">
        {String(output.error)}
      </div>
    );
  }

  let headline = "Done";
  let detail: string | null = null;
  let issues: CritiqueIssue[] | null = null;

  if (part.type === "tool-generateArchitecture") {
    headline = `Placed ${output.componentCount ?? "?"} components on the canvas`;
    detail = typeof output.reasoning === "string" ? output.reasoning : null;
  } else if (part.type === "tool-runDesignReview") {
    issues = (output.issues as CritiqueIssue[]) ?? [];
    const critical = issues.filter((i) => i.severity === "critical").length;
    const warning = issues.filter((i) => i.severity === "warning").length;
    headline =
      issues.length === 0
        ? "Review passed — no issues found"
        : `Review: ${critical} critical · ${warning} warnings · ${issues.length - critical - warning} suggestions`;
    detail = typeof output.summary === "string" ? output.summary : null;
  } else if (part.type === "tool-refineArchitecture") {
    headline = `Applied ${output.changeCount ?? "?"} changes to the canvas`;
    detail = typeof output.reasoning === "string" ? output.reasoning : null;
  } else if (part.type === "tool-researchUrl") {
    headline = `Researched ${typeof output.url === "string" ? output.url : "the site"}`;
    detail = typeof output.brief === "string" ? output.brief.slice(0, 160) + "…" : null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent-ai)]" />
        <span className="text-xs font-medium text-[var(--text-primary)]">{headline}</span>
        <Check className="ml-auto h-3 w-3 shrink-0 text-[var(--state-success)]" />
      </div>
      {detail && (
        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {detail}
        </p>
      )}
      {issues && issues.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {issues.slice(0, 4).map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px]">
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: SEVERITY_COLORS[issue.severity] }}
              />
              <span className="text-[var(--text-secondary)]">{issue.title}</span>
            </div>
          ))}
          {issues.length > 4 && (
            <p className="text-[10px] text-[var(--text-muted)]">
              +{issues.length - 4} more — ask me to fix them
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}

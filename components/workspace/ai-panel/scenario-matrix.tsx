"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, HelpCircle, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Scenario {
  id: string;
  title: string;
  question: string;
  outcome: "pass" | "gap" | "unknown";
  reasoning: string;
  /** What WOULD prove this is handled — shown for gaps and unknowns. */
  proofDescription?: string;
  /** Component ids that proved it. Empty unless the outcome is a pass. */
  provenBy?: string[];
  severity: "blocking" | "material" | "cosmetic";
}

interface ScenarioResponse {
  exists: boolean;
  summary?: {
    total: number;
    passed: number;
    gaps: number;
    unknown: number;
    blockingGaps: number;
    score: number | null;
    scenariosUnknown?: number;
  };
  scenarios: Scenario[];
}

/**
 * "What happens when…" — the design tested against the things that actually go
 * wrong in production.
 *
 * Three outcomes, and the distinction between the last two is the whole point:
 *   PASS     something in the architecture demonstrably handles it, and the row
 *            says WHAT
 *   GAP      an architecture exists and nothing in it does — a real finding
 *   UNKNOWN  no architecture yet, so nothing can show it either way
 *
 * Every gap and unknown carries what would prove it, so an empty verdict reads as
 * an instruction rather than a shrug.
 */
export function ScenarioMatrix({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ScenarioResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/uss/${projectId}/scenarios`)
      .then((r) => (r.ok ? r.json() : { exists: false, scenarios: [] }))
      .then((d) => !cancelled && setData(d as ScenarioResponse))
      .catch(() => !cancelled && setData({ exists: false, scenarios: [] }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-3 text-[11px] text-[var(--text-muted)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking failure scenarios…
      </div>
    );
  }

  if (!data?.exists || data.scenarios.length === 0) return null;

  const { summary, scenarios } = data;

  return (
    <div className="space-y-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            What happens when…
          </span>
        </div>
        {summary && summary.score !== null ? (
          <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
            {summary.passed}/{summary.passed + summary.gaps} proven
          </span>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">not enough to score</span>
        )}
      </div>

      {summary && summary.blockingGaps > 0 && (
        <p className="rounded-md bg-[var(--state-error)]/10 px-2.5 py-1.5 text-[11px] text-[var(--state-error)]">
          {summary.blockingGaps} scenario
          {summary.blockingGaps === 1 ? "" : "s"} would fail in production.
        </p>
      )}

      <ul className="space-y-1.5">
        {scenarios.map((s) => {
          const icon =
            s.outcome === "pass" ? (
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--state-success)]" />
            ) : s.outcome === "gap" ? (
              <AlertTriangle
                className={cn(
                  "mt-0.5 h-3 w-3 shrink-0",
                  s.severity === "blocking"
                    ? "text-[var(--state-error)]"
                    : "text-[var(--state-warning)]"
                )}
              />
            ) : (
              <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-muted)]" />
            );

          return (
            <li key={s.id} className="flex items-start gap-1.5">
              {icon}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[11px] leading-snug",
                    s.outcome === "pass"
                      ? "text-[var(--text-muted)]"
                      : "text-[var(--text-secondary)]"
                  )}
                >
                  {s.title}
                </p>
                {s.outcome !== "pass" && (
                  <>
                    <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">
                      {s.reasoning}
                    </p>
                    {s.proofDescription && (
                      <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]/70">
                        Would prove it: {s.proofDescription}
                      </p>
                    )}
                  </>
                )}
                {s.outcome === "pass" && (
                  <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]/70">
                    {s.reasoning}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {summary && summary.unknown > 0 && (
        <p className="text-[10px] leading-snug text-[var(--text-muted)]">
          {summary.unknown} scenario{summary.unknown === 1 ? "" : "s"} nothing can
          demonstrate yet — generate the architecture and they will be answered.
        </p>
      )}
    </div>
  );
}

"use client";

import { AlertTriangle, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpecHead } from "@/hooks/use-system-spec";

/**
 * Spec health: coverage, tier, and how many open questions would actually change
 * the design.
 *
 * The bar is labelled "Spec coverage", not left as a bare percentage. A naked 90%
 * next to a product title reads as "this design is 90% right"; it means nine of
 * ten boxes have something in them. The numbers that speak to quality — scenarios
 * proven, unknowns outstanding — sit beside it rather than being folded into it.
 *
 * Hidden entirely until a spec exists, so a first-time user sees exactly the panel
 * they saw before. The count shown is MATERIAL decisions only — never the raw
 * total. Showing "17 unresolved questions" to someone who just typed one sentence
 * reads as an accusation, and they close the panel.
 */
export function SpecHealthBar({
  spec,
  onOpenDecisions,
}: {
  spec: SpecHead | null;
  onOpenDecisions?: () => void;
}) {
  if (!spec?.exists || spec.coverage === undefined) return null;

  const coverage = spec.coverage;
  const health = spec.health;
  const material = spec.counts?.material ?? 0;
  const blocking = spec.integrity?.filter((f) => f.severity === "blocking") ?? [];

  const tone =
    coverage >= 80
      ? "var(--state-success)"
      : coverage >= 50
        ? "var(--accent-primary)"
        : "var(--state-warning)";

  return (
    <div className="shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <Gauge className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-[var(--text-secondary)]">
              {spec.productTitle ?? "System spec"}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
              spec coverage {coverage}%
            </span>
          </div>

          <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--bg-surface-raised)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${coverage}%`, backgroundColor: tone }}
            />
          </div>
        </div>

        {spec.tierLabel && (
          <span
            title={spec.tierRationale}
            className="shrink-0 rounded-full bg-[var(--bg-surface-raised)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
          >
            tier {spec.tier} · {spec.tierLabel}
          </span>
        )}
      </div>

      {health && (health.scenarioScore !== null || health.unknowns > 0) && (
        <div className="mt-1.5 flex items-center gap-3 pl-6 text-[10px] tabular-nums text-[var(--text-muted)]">
          {health.scenarioScore !== null && (
            <span title="Failure scenarios the architecture demonstrably handles">
              {health.scenarioScore}% scenarios proven
            </span>
          )}
          {health.scenariosUnknown > 0 && (
            <span title="Nothing in the design demonstrates these either way">
              {health.scenariosUnknown} unproven
            </span>
          )}
          {health.unknowns > 0 && (
            <span title="Things the spec explicitly does not know">
              {health.unknowns} unknown
            </span>
          )}
        </div>
      )}

      {(material > 0 || blocking.length > 0) && (
        <button
          type="button"
          onClick={onOpenDecisions}
          className={cn(
            "mt-2 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
            blocking.length > 0
              ? "bg-[var(--state-warning)]/10 text-[var(--state-warning)] hover:bg-[var(--state-warning)]/15"
              : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-secondary)]"
          )}
        >
          {blocking.length > 0 && <AlertTriangle className="h-3 w-3 shrink-0" />}
          <span className="truncate">
            {blocking.length > 0
              ? blocking[0].message
              : `${material} ${material === 1 ? "decision affects" : "decisions affect"} this design`}
          </span>
        </button>
      )}
    </div>
  );
}

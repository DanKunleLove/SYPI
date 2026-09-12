"use client";

import { useEffect, useState } from "react";
import { ArrowRight, HelpCircle, Loader2 } from "lucide-react";

interface WhyTrace {
  found: boolean;
  component?: { id: string; title: string; responsibility: string; orphaned: boolean };
  requirements?: { id: string; title: string; statement: string }[];
  implications?: { id: string; statement: string; trigger: string; source: string }[];
  capabilities?: { id: string; title: string; why: string }[];
  decisions?: {
    id: string;
    choice: string;
    rationale: string;
    alternatives: { option: string; rejectedBecause: string }[];
  }[];
}

/**
 * "Why is this here?" — the reasoning chain for one component, read backwards.
 *
 * Renders the real traversal, not a model's recollection. When a component has no
 * requirement behind it, this says so plainly: an unjustified component is the
 * single most useful thing a design review can surface, and inventing a
 * post-hoc reason would destroy exactly the signal we built the graph to get.
 */
export function WhyPanel({ projectId, label }: { projectId: string; label: string }) {
  const [trace, setTrace] = useState<WhyTrace | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/uss/${projectId}/why?label=${encodeURIComponent(label)}`)
      .then((r) => (r.ok ? r.json() : { found: false }))
      .then((d) => !cancelled && setTrace(d as WhyTrace))
      .catch(() => !cancelled && setTrace({ found: false }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, label]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 text-[11px] text-[var(--text-muted)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Tracing…
      </div>
    );
  }

  // No spec yet, or this component predates it — say nothing rather than guess.
  if (!trace?.found) return null;

  const requirements = trace.requirements ?? [];
  const implications = trace.implications ?? [];
  const decisions = trace.decisions ?? [];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <HelpCircle className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Why this exists
        </span>
      </div>

      {requirements.length === 0 && implications.length === 0 ? (
        <p className="rounded-md bg-[var(--state-warning)]/10 px-2.5 py-2 text-[11px] leading-snug text-[var(--state-warning)]">
          Nothing in the spec requires this component. It may be worth removing, or
          worth recording what it is for.
        </p>
      ) : (
        <>
          {requirements.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Satisfies
              </p>
              <ul className="mt-1 space-y-1">
                {requirements.map((r) => (
                  <li key={r.id} className="text-[11px] leading-snug text-[var(--text-secondary)]">
                    <span className="text-[var(--text-muted)]">{r.id}</span> {r.statement || r.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {implications.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Because
              </p>
              <ul className="mt-1 space-y-1.5">
                {implications.map((i) => (
                  <li key={i.id} className="text-[11px] leading-snug text-[var(--text-secondary)]">
                    <span className="flex items-start gap-1">
                      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                      <span>
                        {i.statement}
                        {i.source === "rule" && (
                          <span className="ml-1 text-[9px] text-[var(--text-muted)]">
                            (derived by rule)
                          </span>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {decisions.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                Decided
              </p>
              <ul className="mt-1 space-y-1.5">
                {decisions.map((d) => (
                  <li key={d.id} className="text-[11px] leading-snug text-[var(--text-secondary)]">
                    {d.choice}
                    {d.alternatives.length > 0 && (
                      <span className="block text-[10px] text-[var(--text-muted)]">
                        instead of {d.alternatives.map((a) => a.option).join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

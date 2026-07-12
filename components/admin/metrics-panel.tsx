import type { PlatformMetrics } from "@/lib/metrics";

function formatTtv(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 24) return `${(minutes / 60).toFixed(1)} h`;
  return `${(minutes / (60 * 24)).toFixed(1)} d`;
}

/**
 * Investor-grade headline numbers. Activation = first completed generation
 * within 7 days of signup; TTV = signup → that moment.
 */
export function MetricsPanel({ metrics }: { metrics: PlatformMetrics }) {
  const ratingTotal = metrics.thumbsUp + metrics.thumbsDown;
  const cards = [
    { label: "Users", value: String(metrics.totalUsers), hint: "total signups" },
    {
      label: "Activation rate",
      value: metrics.activationRatePct === null ? "—" : `${metrics.activationRatePct}%`,
      hint: "≥1 generation within 7d of signup · top-quartile SaaS ≈ 40%",
    },
    {
      label: "Median time-to-value",
      value: formatTtv(metrics.medianTtvMinutes),
      hint: "signup → first generation · target <5 min",
    },
    { label: "Generations", value: String(metrics.totalGenerations), hint: "completed" },
    {
      label: "System Kits",
      value: String(metrics.kitsGenerated),
      hint:
        Object.entries(metrics.kitsByDomain)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([d, n]) => `${d} ${n}`)
          .join(" · ") || "deep-value event",
    },
    { label: "Exports", value: String(metrics.exports), hint: "spec / png / mermaid / bundle" },
    {
      label: "👍 rate",
      value: ratingTotal > 0 ? `${Math.round((metrics.thumbsUp / ratingTotal) * 100)}%` : "—",
      hint: `${metrics.thumbsUp} up · ${metrics.thumbsDown} down`,
    },
    {
      label: "Open feedback",
      value: String(metrics.openFeedback),
      hint: "unresolved items below",
    },
  ];

  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Performance</h2>
      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
        The numbers that speak for themselves — activation, time-to-value, and weekly
        cohorts.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
          >
            <p className="text-[11px] text-[var(--text-muted)]">{c.label}</p>
            <p className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">
              {c.value}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">
              {c.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border-default)]">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-[var(--border-default)] text-[var(--text-muted)]">
              <th className="px-3 py-2 font-medium">Signup week</th>
              <th className="px-3 py-2 font-medium">Signups</th>
              <th className="px-3 py-2 font-medium">Activated ≤7d</th>
              <th className="px-3 py-2 font-medium">Returned wk 2</th>
            </tr>
          </thead>
          <tbody>
            {metrics.cohorts.map((c) => (
              <tr
                key={c.weekStart}
                className="border-b border-[var(--border-default)] last:border-0 text-[var(--text-secondary)]"
              >
                <td className="px-3 py-1.5">{c.weekStart}</td>
                <td className="px-3 py-1.5">{c.signups}</td>
                <td className="px-3 py-1.5">
                  {c.activatedPct === null ? "—" : `${c.activatedPct}%`}
                </td>
                <td className="px-3 py-1.5">
                  {c.week2ReturnPct === null ? "—" : `${c.week2ReturnPct}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

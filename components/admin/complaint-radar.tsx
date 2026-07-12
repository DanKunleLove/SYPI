"use client";

import { ThumbsDown } from "lucide-react";

export interface RadarItem {
  id: string;
  prompt: string;
  type: string;
  createdAt: string;
  projectName: string;
  ownerEmail: string;
}

/** Recent 👎-rated generations — the complaint signal users already send silently. */
export function ComplaintRadar({ items }: { items: RadarItem[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
        Complaint radar — 👎 generations
      </h2>
      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
        Generations users rated down. Each one is a quality complaint with its exact prompt.
      </p>

      {items.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--border-default)] p-6 text-center text-xs text-[var(--text-muted)]">
          No downvoted generations. Either quality is good or nobody is rating — check the
          👍 rate on the metrics.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((g) => (
            <div
              key={g.id}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--state-error)]/10">
                  <ThumbsDown className="h-3.5 w-3.5 text-[var(--state-error)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                    <span className="font-medium">{g.projectName}</span>
                    <span>·</span>
                    <span>{g.ownerEmail}</span>
                    <span>·</span>
                    <span className="uppercase">{g.type}</span>
                    <span>·</span>
                    <span>{new Date(g.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 text-[13px] text-[var(--text-secondary)]">
                    {g.prompt}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

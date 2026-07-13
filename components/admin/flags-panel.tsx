"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PlatformFlagId } from "@/lib/flags";

export interface FlagState {
  id: PlatformFlagId;
  label: string;
  description: string;
  enabled: boolean;
}

/** Kill-switch toggles. Flipping one takes effect platform-wide immediately. */
export function FlagsPanel({ initial }: { initial: FlagState[] }) {
  const [flags, setFlags] = useState(initial);

  async function toggle(id: PlatformFlagId, enabled: boolean) {
    const prev = flags;
    setFlags((list) => list.map((f) => (f.id === id ? { ...f, enabled } : f)));
    try {
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(enabled ? "Feature re-enabled" : "Feature paused platform-wide");
    } catch {
      setFlags(prev);
      toast.error("Couldn't update the flag — try again.");
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Kill switches</h2>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        Emergency brakes — pausing a feature blocks it for every user instantly.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {flags.map((f) => (
          <div
            key={f.id}
            className={cn(
              "flex items-start justify-between gap-3 rounded-lg border p-3",
              f.enabled
                ? "border-[var(--border-default)] bg-[var(--bg-surface)]"
                : "border-[var(--state-error)]/40 bg-[var(--state-error)]/5"
            )}
          >
            <div>
              <div className="text-[13px] font-medium text-[var(--text-primary)]">
                {f.label}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {f.description}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={f.enabled}
              aria-label={`${f.label} — ${f.enabled ? "enabled" : "paused"}`}
              onClick={() => toggle(f.id, !f.enabled)}
              className={cn(
                "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
                f.enabled ? "bg-[var(--state-success)]" : "bg-[var(--state-error)]/60"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                  f.enabled ? "left-[18px]" : "left-0.5"
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

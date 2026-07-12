"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bug, MessageSquareWarning, Lightbulb, MessageCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminFeedbackItem {
  id: string;
  type: string;
  message: string;
  path: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  userEmail: string;
  userName: string | null;
}

const TYPE_ICONS: Record<string, typeof Bug> = {
  bug: Bug,
  complaint: MessageSquareWarning,
  idea: Lightbulb,
  other: MessageCircle,
};

const STATUSES = [
  { id: "open", label: "Open", color: "var(--state-error)" },
  { id: "in_progress", label: "In progress", color: "var(--state-warning)" },
  { id: "resolved", label: "Resolved", color: "var(--state-success)" },
] as const;

/** Admin feedback queue: filter, change status, note, reply by email. */
export function FeedbackBoard({ initial }: { initial: AdminFeedbackItem[] }) {
  const [items, setItems] = useState(initial);
  const [statusFilter, setStatusFilter] = useState<string | null>("open");

  const visible = useMemo(
    () => (statusFilter ? items.filter((i) => i.status === statusFilter) : items),
    [items, statusFilter]
  );

  async function updateItem(id: string, patch: { status?: string; adminNote?: string }) {
    const prev = items;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      setItems(prev);
      toast.error("Couldn't update feedback — try again.");
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { open: 0, in_progress: 0, resolved: 0 };
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Feedback queue
        </h2>
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatusFilter(statusFilter === s.id ? null : s.id)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                statusFilter === s.id
                  ? "border-[var(--accent-ai)]/50 bg-[var(--accent-ai)]/15 text-[var(--accent-ai)]"
                  : "border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              {s.label} ({counts[s.id] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-[var(--border-default)] p-6 text-center text-xs text-[var(--text-muted)]">
          {statusFilter ? `No ${statusFilter.replace("_", " ")} feedback.` : "No feedback yet."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {visible.map((item) => {
            const Icon = TYPE_ICONS[item.type] ?? MessageCircle;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent-ai)]/10">
                    <Icon className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-muted)]">
                      <span className="font-medium uppercase">{item.type}</span>
                      <span>·</span>
                      <span>{item.userName ?? item.userEmail}</span>
                      {item.path && (
                        <>
                          <span>·</span>
                          <code className="rounded bg-[var(--bg-surface-raised)] px-1">{item.path}</code>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--text-primary)]">
                      {item.message}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <select
                    value={item.status}
                    onChange={(e) => updateItem(item.id, { status: e.target.value })}
                    aria-label="Feedback status"
                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-[11px] text-[var(--text-secondary)]"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <a
                    href={`mailto:${item.userEmail}?subject=${encodeURIComponent(
                      `Re: your SYPI ${item.type} report`
                    )}`}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Mail className="h-3 w-3" /> Reply
                  </a>
                  <input
                    defaultValue={item.adminNote ?? ""}
                    placeholder="Internal note…"
                    onBlur={(e) => {
                      if (e.target.value !== (item.adminNote ?? "")) {
                        updateItem(item.id, { adminNote: e.target.value });
                      }
                    }}
                    className="min-w-[160px] flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-[11px] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

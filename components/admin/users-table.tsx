"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Search, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminUserRow } from "@/lib/admin";

/** Admin user management: search, role, suspend, per-user generate quota. */
export function UsersTable({ initial }: { initial: AdminUserRow[] }) {
  const [users, setUsers] = useState(initial);
  const [query, setQuery] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(q: string) {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setUsers(data.users);
      } catch {
        toast.error("Search failed — try again.");
      }
    }, 300);
  }

  async function updateUser(
    id: string,
    patch: { platformRole?: string; status?: string; dailyGenLimit?: number | null }
  ) {
    const prev = users;
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id, ...patch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Update failed");
      }
    } catch (error) {
      setUsers(prev);
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  }

  return (
    <section>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3">
        <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
        <input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search by email or name…"
          className="h-9 w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border-default)]">
        <table className="w-full min-w-[760px] text-left text-[12px]">
          <thead className="bg-[var(--bg-surface)] text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2 font-medium">Projects</th>
              <th className="px-3 py-2 font-medium">AI calls 30d</th>
              <th className="px-3 py-2 font-medium">Gens 30d</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Gen limit/day</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-default)]">
            {users.map((u) => (
              <tr
                key={u.id}
                className={cn(u.status === "suspended" && "opacity-60")}
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                    {u.name ?? u.email}
                    {u.byokKeys > 0 && (
                      <span title={`${u.byokKeys} BYOK key(s)`}>
                        <KeyRound className="h-3 w-3 text-[var(--accent-ai)]" />
                      </span>
                    )}
                  </div>
                  {u.name && <div className="text-[var(--text-muted)]">{u.email}</div>}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{u.projects}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{u.aiCalls30d}</td>
                <td className="px-3 py-2 text-[var(--text-secondary)]">{u.generations30d}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.platformRole}
                    onChange={(e) => updateUser(u.id, { platformRole: e.target.value })}
                    aria-label="Platform role"
                    className="rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-1.5 py-1 text-[11px] text-[var(--text-secondary)]"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={u.dailyGenLimit ?? ""}
                    placeholder="default"
                    aria-label="Daily generate limit override"
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const next = raw === "" ? null : Number(raw);
                      if (next !== u.dailyGenLimit) {
                        updateUser(u.id, { dailyGenLimit: next });
                      }
                    }}
                    className="w-20 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-1.5 py-1 text-[11px] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)]"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateUser(u.id, {
                        status: u.status === "suspended" ? "active" : "suspended",
                      })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                      u.status === "suspended"
                        ? "border-[var(--state-error)]/50 bg-[var(--state-error)]/10 text-[var(--state-error)]"
                        : "border-[var(--state-success)]/40 text-[var(--state-success)] hover:bg-[var(--state-success)]/10"
                    )}
                  >
                    {u.status === "suspended" ? "Suspended" : "Active"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-xs text-[var(--text-muted)]"
                >
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

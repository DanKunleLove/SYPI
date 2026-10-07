"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * Personal access tokens for the MCP endpoint. The raw token is shown once,
 * straight after creation; the server keeps only its hash.
 */
export function TokenSettings() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/settings/tokens")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { tokens: TokenRow[] }) => setTokens(data.tokens))
      .catch(() => toast.error("Couldn't load your tokens"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/settings/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create token");
      setFresh(json.token);
      setName("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/settings/tokens?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) return toast.error("Couldn't revoke that token");
    setTokens((t) => t.filter((x) => x.id !== id));
    toast.success("Token revoked");
  }

  const endpoint =
    typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <h2 className="text-sm font-medium text-[var(--text-primary)]">Agent access (MCP)</h2>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
        Let a coding agent read your spec, see open decisions, and record your answers. Point your
        MCP client at <span className="font-mono">{endpoint}</span> with a token as the Bearer
        header. A token has your access — revoke any you stop using.
      </p>

      {fresh && (
        <div className="mt-3 rounded-lg border border-[var(--accent-ai)]/40 bg-[var(--bg-base)] p-3">
          <p className="text-xs text-[var(--text-primary)]">Copy this now — it won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-[var(--bg-surface)] px-2 py-1 font-mono text-xs">
              {fresh}
            </code>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(fresh).then(
                  () => toast.success("Copied"),
                  () => toast.error("Couldn't copy — select it manually")
                );
              }}
            >
              Copy
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setFresh(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          placeholder="Token name, e.g. Claude Code on my laptop"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent-ai)]/50"
        />
        <Button
          size="sm"
          onClick={create}
          disabled={creating}
          className="h-8 gap-1.5 bg-[var(--accent-ai)] px-3 text-xs text-white hover:bg-[var(--accent-ai)]/90"
        >
          {creating && <Loader2 className="h-3 w-3 animate-spin" />}
          Create token
        </Button>
      </div>

      <div className="mt-3 divide-y divide-[var(--border-default)]">
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : tokens.length === 0 ? (
          <p className="py-2 text-xs text-[var(--text-muted)]">No tokens yet.</p>
        ) : (
          tokens.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--text-primary)]">{t.name}</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  <span className="font-mono">{t.prefix}…</span> · created{" "}
                  {new Date(t.createdAt).toLocaleDateString()} ·{" "}
                  {t.lastUsedAt ? `used ${new Date(t.lastUsedAt).toLocaleDateString()}` : "never used"}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-red-500"
                onClick={() => revoke(t.id)}
                aria-label={`Revoke ${t.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

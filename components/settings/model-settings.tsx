"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ProviderState {
  id: string;
  label: string;
  consoleUrl: string;
  models: { id: string; label: string }[];
  configured: boolean;
  last4: string | null;
}

interface SettingsData {
  providers: ProviderState[];
  defaultModel: string | null;
}

export function ModelSettings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/settings/keys");
      if (!res.ok) throw new Error("Failed to load settings");
      setData(await res.json());
    } catch {
      toast.error("Couldn't load your settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveKey(provider: string) {
    const apiKey = (drafts[provider] ?? "").trim();
    if (apiKey.length < 8) {
      toast.error("That key looks too short");
      return;
    }
    setBusy(provider);
    try {
      const res = await fetch("/api/settings/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save key");
      toast.success("Key saved");
      setDrafts((d) => ({ ...d, [provider]: "" }));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setBusy(null);
    }
  }

  async function removeKey(provider: string) {
    setBusy(provider);
    try {
      const res = await fetch(`/api/settings/keys?provider=${provider}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove key");
      toast.success("Key removed");
      await load();
    } catch {
      toast.error("Failed to remove key");
    } finally {
      setBusy(null);
    }
  }

  async function setDefaultModel(value: string) {
    // optimistic
    setData((prev) => (prev ? { ...prev, defaultModel: value || null } : prev));
    try {
      const res = await fetch("/api/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultModel: value || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to set model");
      toast.success("Default model updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set model");
      await load();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!data) return null;

  const configuredModels = data.providers
    .filter((p) => p.configured)
    .flatMap((p) => p.models.map((m) => ({ ref: `${p.id}:${m.id}`, label: `${m.label}` })));

  return (
    <div className="space-y-8">
      {/* Default model */}
      <section>
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Default model</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Used for generation, chat, and spec. Falls back to the platform Gemini key when unset.
        </p>
        <select
          value={data.defaultModel ?? ""}
          onChange={(e) => setDefaultModel(e.target.value)}
          disabled={configuredModels.length === 0}
          className="mt-3 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-subtle)] disabled:opacity-50"
        >
          <option value="">Platform default (Gemini)</option>
          {configuredModels.map((m) => (
            <option key={m.ref} value={m.ref}>
              {m.label}
            </option>
          ))}
        </select>
        {configuredModels.length === 0 && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Add a provider key below to unlock model selection.
          </p>
        )}
      </section>

      {/* Provider keys */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--text-primary)]">Provider keys</h2>
        {data.providers.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">{p.label}</span>
                {p.configured && (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" />
                    ••••{p.last4}
                  </Badge>
                )}
              </div>
              <a
                href={p.consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                Get key
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Input
                type="password"
                autoComplete="off"
                placeholder={p.configured ? "Replace key…" : "Paste API key…"}
                value={drafts[p.id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={() => saveKey(p.id)}
                disabled={busy === p.id || !(drafts[p.id] ?? "").trim()}
              >
                {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
              </Button>
              {p.configured && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeKey(p.id)}
                  disabled={busy === p.id}
                  aria-label={`Remove ${p.label} key`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

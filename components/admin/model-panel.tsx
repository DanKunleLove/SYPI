"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlatformProviderState {
  id: string;
  label: string;
  models: { id: string; label: string }[];
  keyEnv: string;
  configured: boolean;
}

/**
 * Platform model selector. Decides which model users WITHOUT their own API key
 * get. Users with BYOK keys are unaffected — their generations always run on
 * their own provider.
 */
export function ModelPanel({
  initialCurrent,
  providers,
}: {
  initialCurrent: string | null;
  providers: PlatformProviderState[];
}) {
  const [current, setCurrent] = useState(initialCurrent);
  const [saving, setSaving] = useState<string | null>(null);

  async function select(ref: string | null) {
    setSaving(ref ?? "__default__");
    try {
      const res = await fetch("/api/admin/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: ref }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      setCurrent(data.current ?? null);
      toast.success(
        ref ? "Platform model updated" : "Reverted to the built-in default",
        { description: "Takes effect within 30 seconds across all instances." }
      );
    } catch (e) {
      toast.error("Couldn't update the platform model", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(null);
    }
  }

  const anyConfigured = providers.some((p) => p.configured);

  return (
    <section>
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">Platform model</h2>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        What users without their own API key generate on. Users with BYOK keys always run on
        their own provider and are unaffected by this.
      </p>

      {!anyConfigured && (
        <p className="mt-3 rounded-lg border border-[var(--state-warning)]/40 bg-[var(--state-warning)]/5 p-3 text-xs text-[var(--text-secondary)]">
          No provider keys are configured on the server. Set one of the environment variables
          below, then redeploy.
        </p>
      )}

      <div className="mt-3 space-y-3">
        {/* Built-in default */}
        <button
          type="button"
          onClick={() => select(null)}
          disabled={saving !== null}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors",
            current === null
              ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5"
              : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-subtle)]"
          )}
        >
          <div>
            <div className="text-[13px] font-medium text-[var(--text-primary)]">
              Built-in default
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              Gemini via GOOGLE_AI_API_KEY — the behaviour when nothing is selected.
            </div>
          </div>
          {saving === "__default__" ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--text-muted)]" />
          ) : current === null ? (
            <Check className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
          ) : null}
        </button>

        {providers.map((p) => (
          <div
            key={p.id}
            className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13px] font-medium text-[var(--text-primary)]">
                {p.label}
              </div>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]",
                  p.configured
                    ? "bg-[var(--state-success)]/10 text-[var(--state-success)]"
                    : "bg-[var(--bg-surface-raised)] text-[var(--text-muted)]"
                )}
              >
                <KeyRound className="h-3 w-3" />
                {p.configured ? "key configured" : p.keyEnv}
              </span>
            </div>

            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {p.models.map((m) => {
                const ref = `${p.id}:${m.id}`;
                const active = current === ref;
                return (
                  <button
                    key={ref}
                    type="button"
                    disabled={!p.configured || saving !== null}
                    onClick={() => select(ref)}
                    title={!p.configured ? `Set ${p.keyEnv} on the server first` : m.id}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-[12px] transition-colors",
                      active
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 text-[var(--text-primary)]"
                        : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-subtle)]",
                      !p.configured && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <span className="truncate">{m.label}</span>
                    {saving === ref ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    ) : active ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-[var(--text-muted)]">
        Cheaper calls (design review, spec, chat) always use the selected provider&apos;s fast
        model, so picking a large reasoning model for generation does not make every call
        expensive.
      </p>
    </section>
  );
}

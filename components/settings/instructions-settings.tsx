"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const MAX_CHARS = 2000;

/**
 * Custom instructions — the user layer of the AI prompt stack.
 * Appended to every AI call (generate, plan, chat); never replaces the base
 * output contract, so generation can't be broken by a preference.
 */
export function InstructionsSettings() {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/instructions")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { instructions: string }) => {
        setValue(data.instructions);
        setSaved(data.instructions);
      })
      .catch(() => toast.error("Couldn't load your instructions"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/instructions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      setSaved(json.instructions);
      setValue(json.instructions);
      toast.success(json.instructions ? "Instructions saved" : "Instructions cleared");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] p-4 text-sm text-[var(--text-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const dirty = value !== saved;

  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <h2 className="text-sm font-medium text-[var(--text-primary)]">Custom instructions</h2>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
        Tell your AI Twin how to work — preferred cloud, technologies to favor or avoid, how much
        detail to include. Applied to every generation, plan, and chat on top of the built-in
        prompts.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_CHARS))}
        rows={5}
        placeholder={"e.g. Prefer AWS services. Always include monitoring and a CDN. Explain decisions briefly — I'm a backend engineer."}
        className="mt-3 w-full resize-y rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent-ai)]/50"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)]">
          {value.length}/{MAX_CHARS}
        </span>
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !dirty}
          className="h-7 gap-1.5 bg-[var(--accent-ai)] px-3 text-xs text-white hover:bg-[var(--accent-ai)]/90 disabled:opacity-40"
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          Save instructions
        </Button>
      </div>
    </div>
  );
}

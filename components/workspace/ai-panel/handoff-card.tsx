"use client";

import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Check, Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { downloadHandoff } from "@/lib/export";
import { recordEvent } from "@/lib/events";
import { EXECUTION_TARGETS, type TargetId } from "@/lib/uss/targets";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

/**
 * Hand-off — the same specification, rendered for whoever is going to build it.
 *
 * Deliberately requires a spec. If the project has none the route says so rather
 * than falling back to a canvas dump: a hand-off is a rendering of established
 * reasoning, and quietly producing one without it would be the exact failure this
 * whole programme set out to fix.
 */
export function HandoffCard({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const reactFlow = useReactFlow();
  const [target, setTarget] = useState<TargetId>(() => {
    if (typeof window === "undefined") return "claude-code";
    const saved = localStorage.getItem("sypi-handoff-target");
    return EXECUTION_TARGETS.some((t) => t.id === saved) ? (saved as TargetId) : "claude-code";
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chosen = EXECUTION_TARGETS.find((t) => t.id === target)!;

  const select = useCallback((id: TargetId) => {
    setTarget(id);
    setDone([]);
    setError(null);
    localStorage.setItem("sypi-handoff-target", id);
  }, []);

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setDone([]);
    try {
      const res = await fetch("/api/ai/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectName, target }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not generate the hand-off");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const collected: { path: string; content: string }[] = [];

      const handleLine = (raw: string) => {
        if (!raw.trim()) return;
        const event = JSON.parse(raw) as {
          type: string;
          path?: string;
          content?: string;
          error?: string;
        };
        if (event.type === "start" && event.path) {
          setCurrent(event.path);
        } else if (event.type === "file" && event.path && event.content) {
          collected.push({ path: event.path, content: event.content });
          setDone((prev) => [...prev, event.path!]);
        } else if (event.type === "error") {
          throw new Error(event.error || "Hand-off generation failed");
        }
      };

      for (;;) {
        const { done: finished, value } = await reader.read();
        if (finished) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf("\n")) >= 0) {
          handleLine(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
        }
      }
      if (buffer.trim()) handleLine(buffer);

      if (collected.length < chosen.files.length) {
        throw new Error("Generation ended early — please retry");
      }

      await downloadHandoff(
        collected,
        chosen.id,
        chosen.label,
        reactFlow.getNodes() as CanvasNode[],
        reactFlow.getEdges() as CanvasEdge[],
        projectName
      );
      recordEvent("bundle_exported", { target: chosen.id });
      toast.success(`Hand-off for ${chosen.label} downloaded`, {
        description: "Facts marked inferred or assumed still need confirming.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hand-off generation failed");
    } finally {
      setBusy(false);
      setCurrent(null);
    }
  }, [projectId, projectName, target, chosen, reactFlow]);

  return (
    <div className="rounded-lg border border-[var(--accent-primary)]/25 bg-[var(--accent-primary)]/5 p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15">
          <PackageCheck className="h-4 w-4 text-[var(--accent-primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-primary)]">Hand-off</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
            The same specification, written for whoever builds it.
          </p>
        </div>
      </div>

      <div className="mt-2.5">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Who is building this?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {EXECUTION_TARGETS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={busy}
              title={t.hint}
              onClick={() => select(t.id)}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-40",
                t.id === target
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--text-primary)]"
                  : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-subtle)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-2.5 space-y-1">
        {chosen.files.map((f) => {
          const isDone = done.includes(f.path);
          const isCurrent = current === f.path;
          return (
            <li key={f.path} className="flex items-center gap-1.5 text-[11px]">
              {isDone ? (
                <Check className="h-3 w-3 shrink-0 text-[var(--state-success)]" />
              ) : isCurrent ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[var(--accent-primary)]" />
              ) : (
                <span className="h-3 w-3 shrink-0 rounded-full border border-[var(--border-default)]" />
              )}
              <span
                className={cn(
                  "truncate font-mono",
                  isDone ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
                )}
              >
                {f.path}
              </span>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-2 rounded-md bg-[var(--state-error)]/10 px-2 py-1.5 text-[11px] text-[var(--state-error)]">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={generate}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Writing {done.length + 1} of {chosen.files.length}…
          </>
        ) : (
          `Generate hand-off for ${chosen.label}`
        )}
      </button>
    </div>
  );
}

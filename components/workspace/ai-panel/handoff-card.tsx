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
  const [runId, setRunId] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [collected, setCollected] = useState<{ path: string; content: string }[]>([]);

  const chosen = EXECUTION_TARGETS.find((t) => t.id === target)!;

  const select = useCallback((id: TargetId) => {
    setTarget(id);
    setDone([]);
    setError(null);
    localStorage.setItem("sypi-handoff-target", id);
  }, []);

  /**
   * Generate the hand-off, ONE FILE PER REQUEST.
   *
   * Same shape as the System Kit, for the same reason: several sequential
   * document generations cannot finish inside a 60-second function. What lands
   * stays; a failure names the file; a retry re-runs only the failures on the
   * same run, so it costs no extra quota.
   */
  const runFiles = useCallback(
    async (runId: string, paths: string[], existing: { path: string; content: string }[]) => {
      const collected = [...existing];
      const failed: Record<string, string> = {};

      for (const path of paths) {
        setCurrent(path);
        try {
          const res = await fetch("/api/ai/handoff/file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(55_000),
            body: JSON.stringify({ projectId, runId, path }),
          });
          const data = (await res.json()) as { ok?: boolean; content?: string; error?: string };
          if (!res.ok || data.ok === false || !data.content) {
            failed[path] = data.error ?? "failed";
            continue;
          }
          collected.push({ path, content: data.content });
          setDone((prev) => [...prev, path]);
        } catch (e) {
          const timedOut = e instanceof DOMException && e.name === "TimeoutError";
          failed[path] = timedOut ? "took longer than 55s" : "lost connection";
        }
      }

      setCurrent(null);
      setFailed(failed);
      return { collected, failed };
    },
    [projectId]
  );

  const deliver = useCallback(
    async (files: { path: string; content: string }[]) => {
      await downloadHandoff(
        files,
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
    },
    [chosen, reactFlow, projectName]
  );

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setDone([]);
    setFailed({});
    setCollected([]);
    try {
      const res = await fetch("/api/ai/handoff/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, projectName, target }),
      });
      const start = (await res.json()) as {
        runId?: string;
        files?: { path: string; title: string }[];
        error?: string;
      };
      if (!res.ok || !start.runId || !start.files) {
        throw new Error(start.error || "Could not start the hand-off");
      }

      setRunId(start.runId);
      const { collected, failed } = await runFiles(
        start.runId,
        start.files.map((f) => f.path),
        []
      );
      setCollected(collected);

      if (Object.keys(failed).length > 0) {
        setError(
          `${Object.keys(failed).length} file(s) failed: ${Object.entries(failed)
            .map(([p, e]) => `${p} (${e})`)
            .join(", ")}`
        );
        return;
      }
      await deliver(collected);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hand-off generation failed");
    } finally {
      setBusy(false);
      setCurrent(null);
    }
  }, [projectId, projectName, target, runFiles, deliver]);

  /** Re-run only what failed, on the same run — no new quota charge. */
  const retryFailed = useCallback(async () => {
    if (!runId) return;
    const paths = Object.keys(failed);
    if (paths.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runFiles(runId, paths, collected);
      setCollected(result.collected);
      if (Object.keys(result.failed).length > 0) {
        setError(`${Object.keys(result.failed).length} file(s) still failing.`);
        return;
      }
      await deliver(result.collected);
    } finally {
      setBusy(false);
    }
  }, [runId, failed, collected, runFiles, deliver]);

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
      {/* Never throw away the files that DID generate. */}
      {Object.keys(failed).length > 0 && !busy && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void retryFailed()}
            className="flex-1 rounded-md border border-[var(--border-default)] px-2 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)]/40 hover:text-[var(--text-primary)]"
          >
            Retry {Object.keys(failed).length} failed
          </button>
          {collected.length > 0 && (
            <button
              type="button"
              onClick={() => void deliver(collected)}
              className="flex-1 rounded-md border border-[var(--border-default)] px-2 py-1.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)]/40 hover:text-[var(--text-primary)]"
            >
              Download the {collected.length} I have
            </button>
          )}
        </div>
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

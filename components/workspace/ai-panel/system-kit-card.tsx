"use client";

import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { AlertTriangle, Check, Download, Loader2, Package, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { serializeCanvasForAI } from "@/lib/ai/canvas-context";
import {
  KIT_DOMAINS,
  KIT_PROFILES,
  getKitDomain,
  kitEntryFile,
  type KitDomainId,
  type KitProfileId,
} from "@/lib/ai/kit";
import { downloadSystemKit } from "@/lib/export";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

export function SystemKitCard({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const reactFlow = useReactFlow();
  const [kitFiles, setKitFiles] = useState<Record<string, string>>({});
  const [kitBusy, setKitBusy] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const [kitRunId, setKitRunId] = useState<string | null>(null);
  const [kitFailed, setKitFailed] = useState<Record<string, string>>({});
  const [kitFileState, setKitFileState] = useState<
    Record<string, "pending" | "running" | "done" | "failed">
  >({});
  const [kitProfiles, setKitProfiles] = useState<KitProfileId[]>(() => {
    if (typeof window === "undefined") return ["claude-code"];
    try {
      const saved = JSON.parse(localStorage.getItem("spi-kit-profiles") ?? "");
      if (Array.isArray(saved)) {
        const valid = saved.filter((id): id is KitProfileId =>
          KIT_PROFILES.some((p) => p.id === id)
        );
        if (valid.length > 0) return valid;
      }
    } catch {
      // Fall through to the default.
    }
    return ["claude-code"];
  });
  const [kitDomainId, setKitDomainId] = useState<KitDomainId>(() => {
    if (typeof window === "undefined") return "software";
    const saved = localStorage.getItem("spi-kit-domain");
    return KIT_DOMAINS.some((d) => d.id === saved) ? (saved as KitDomainId) : "software";
  });

  const kitDomain = getKitDomain(kitDomainId);
  const nodes = reactFlow.getNodes() as CanvasNode[];
  const edges = reactFlow.getEdges() as CanvasEdge[];

  const selectKitDomain = useCallback((id: KitDomainId) => {
    setKitDomainId(id);
    localStorage.setItem("spi-kit-domain", id);
  }, []);

  const toggleKitProfile = useCallback((id: KitProfileId) => {
    setKitProfiles((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      localStorage.setItem("spi-kit-profiles", JSON.stringify(next));
      return next;
    });
  }, []);

  const runKitFiles = useCallback(
    async (runId: string, names: string[], existing: Record<string, string>) => {
      const collected: Record<string, string> = { ...existing };
      const failed: Record<string, string> = {};

      for (const name of names) {
        setKitFileState((prev) => ({ ...prev, [name]: "running" }));
        try {
          const res = await fetch("/api/ai/kit/file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(55_000),
            body: JSON.stringify({ projectId, runId, name }),
          });
          const data = (await res.json()) as {
            ok?: boolean;
            content?: string;
            error?: string;
          };
          if (!res.ok || data.ok === false || !data.content) {
            failed[name] = data.error ?? "failed";
            setKitFileState((prev) => ({ ...prev, [name]: "failed" }));
            continue;
          }
          collected[name] = data.content;
          setKitFiles({ ...collected });
          setKitFileState((prev) => ({ ...prev, [name]: "done" }));
        } catch (e) {
          const timedOut = e instanceof DOMException && e.name === "TimeoutError";
          failed[name] = timedOut ? "took longer than 55s" : "lost connection";
          setKitFileState((prev) => ({ ...prev, [name]: "failed" }));
        }
      }

      setKitFailed(failed);
      return { collected, failed };
    },
    [projectId]
  );

  const deliverKit = useCallback(
    async (collected: Record<string, string>) => {
      await downloadSystemKit(
        collected,
        kitEntryFile(projectName, kitDomain),
        reactFlow.getNodes() as CanvasNode[],
        reactFlow.getEdges() as CanvasEdge[],
        projectName,
        kitProfiles,
        kitDomain
      );
      void fetch("/api/ai/kit/file", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, domain: kitDomain.id }),
      }).catch(() => {});
      toast.success("System Kit downloaded", {
        description: "Drop it into your repo or AI workspace before implementation starts.",
      });
    },
    [kitDomain, kitProfiles, projectId, projectName, reactFlow]
  );

  const handleGenerateKit = useCallback(async () => {
    setKitBusy(true);
    setKitError(null);
    setKitFiles({});
    setKitFailed({});
    setKitFileState({});
    try {
      const canvasContext = serializeCanvasForAI(
        reactFlow.getNodes() as CanvasNode[],
        reactFlow.getEdges() as CanvasEdge[]
      );
      const res = await fetch("/api/ai/kit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, canvasContext, projectName, domain: kitDomain.id }),
      });
      const start = (await res.json()) as {
        runId?: string;
        files?: { name: string; title: string }[];
        error?: string;
      };
      if (!res.ok || !start.runId || !start.files) {
        throw new Error(start.error || "Could not start the kit");
      }

      setKitRunId(start.runId);
      const names = start.files.map((f) => f.name);
      setKitFileState(Object.fromEntries(names.map((n) => [n, "pending" as const])));

      const { collected, failed } = await runKitFiles(start.runId, names, {});
      if (Object.keys(failed).length > 0) {
        setKitError(
          `${Object.keys(failed).length} of ${names.length} files failed: ${Object.entries(
            failed
          )
            .map(([n, e]) => `${n} (${e})`)
            .join(", ")}`
        );
        return;
      }

      await deliverKit(collected);
    } catch (error) {
      setKitError(error instanceof Error ? error.message : "Kit generation failed");
    } finally {
      setKitBusy(false);
    }
  }, [deliverKit, kitDomain.id, projectId, projectName, reactFlow, runKitFiles]);

  const handleRetryKitFiles = useCallback(async () => {
    if (!kitRunId) return;
    const names = Object.keys(kitFailed);
    if (names.length === 0) return;
    setKitBusy(true);
    setKitError(null);
    try {
      const { collected, failed } = await runKitFiles(kitRunId, names, kitFiles);
      if (Object.keys(failed).length > 0) {
        setKitError(
          `${Object.keys(failed).length} file(s) still failing: ${Object.entries(failed)
            .map(([n, e]) => `${n} (${e})`)
            .join(", ")}`
        );
        return;
      }
      await deliverKit(collected);
    } finally {
      setKitBusy(false);
    }
  }, [deliverKit, kitFailed, kitFiles, kitRunId, runKitFiles]);

  const handleDownloadPartialKit = useCallback(async () => {
    if (Object.keys(kitFiles).length === 0) return;
    await deliverKit(kitFiles);
  }, [deliverKit, kitFiles]);

  return (
    <div className="rounded-lg border border-[var(--accent-ai)]/25 bg-[var(--accent-ai)]/5 p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-ai)]/15">
          <Package className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-primary)]">System Kit</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Generate the working context an AI builder reads first: overview,
            architecture, standards, workflow rules, tracker, and setup files.
          </p>
        </div>
      </div>

      <div className="mt-2.5">
        <p className="text-[10px] font-medium uppercase text-[var(--text-muted)]">
          What are you building?
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {KIT_DOMAINS.map((domain) => {
            const active = kitDomainId === domain.id;
            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => selectKitDomain(domain.id)}
                title={domain.hint}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  active
                    ? "border-[var(--accent-ai)]/50 bg-[var(--accent-ai)]/15 text-[var(--accent-ai)]"
                    : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-subtle)] hover:text-[var(--text-secondary)]"
                )}
              >
                {domain.label}
              </button>
            );
          })}
        </div>
      </div>

      {kitDomain.codeProfiles ? (
        <div className="mt-2.5">
          <p className="text-[10px] font-medium uppercase text-[var(--text-muted)]">
            Where will you build?
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {KIT_PROFILES.map((profile) => {
              const active = kitProfiles.includes(profile.id);
              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => toggleKitProfile(profile.id)}
                  title={`Adds ${profile.hint}`}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                    active
                      ? "border-[var(--accent-ai)]/50 bg-[var(--accent-ai)]/15 text-[var(--accent-ai)]"
                      : "border-[var(--border-default)] text-[var(--text-muted)] hover:border-[var(--border-subtle)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  {profile.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-[var(--text-muted)]">
          Includes a paste-ready knowledge doc and prompting guide for chat-driven
          creative or business work.
        </p>
      )}

      {(kitBusy || Object.keys(kitFileState).length > 0) && (
        <div className="mt-2.5 space-y-1">
          {kitDomain.files.map((file) => {
            const state = kitFileState[file.name] ?? "pending";
            return (
              <div key={file.name} className="flex items-center gap-1.5 text-[11px]">
                {state === "done" ? (
                  <Check className="h-3 w-3 text-[var(--state-success)]" />
                ) : state === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin text-[var(--accent-ai)]" />
                ) : state === "failed" ? (
                  <AlertTriangle className="h-3 w-3 text-[var(--state-error)]" />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-[var(--border-default)]" />
                )}
                <span
                  className={cn(
                    state === "failed"
                      ? "text-[var(--state-error)]"
                      : state === "pending"
                        ? "text-[var(--text-muted)]"
                        : "text-[var(--text-secondary)]"
                  )}
                >
                  {file.title}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {kitError && <p className="mt-2 text-[11px] text-[var(--state-error)]">{kitError}</p>}

      {Object.keys(kitFailed).length > 0 && !kitBusy && (
        <div className="mt-2 flex gap-2">
          <Button
            onClick={handleRetryKitFiles}
            variant="ghost"
            className="flex-1 gap-1.5 border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]"
          >
            <RotateCw className="h-3 w-3" />
            Retry {Object.keys(kitFailed).length}
          </Button>
          {Object.keys(kitFiles).length > 0 && (
            <Button
              onClick={handleDownloadPartialKit}
              variant="ghost"
              className="flex-1 gap-1.5 border border-[var(--border-default)] text-[11px] text-[var(--text-secondary)]"
            >
              <Download className="h-3 w-3" />
              Download {Object.keys(kitFiles).length}
            </Button>
          )}
        </div>
      )}

      <Button
        onClick={handleGenerateKit}
        disabled={kitBusy || nodes.length === 0}
        className="mt-2.5 w-full gap-1.5 bg-[var(--accent-ai)] text-xs text-white hover:bg-[var(--accent-ai)]/90 disabled:opacity-50"
      >
        {kitBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
        {kitBusy ? "Generating your system..." : "Generate System Kit (.zip)"}
      </Button>
    </div>
  );
}

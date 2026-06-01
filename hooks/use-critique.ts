"use client";

import { useState, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEventListener } from "@liveblocks/react";
import { toast } from "sonner";
import { serializeCanvasForAI } from "@/lib/ai/canvas-context";
import type { CritiqueOutput, CritiqueIssue } from "@/lib/ai/schemas";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

export type CritiqueStatus = "idle" | "submitting" | "analyzing" | "done" | "error";

interface UseCritiqueOptions {
  projectId: string;
}

export function useCritique({ projectId }: UseCritiqueOptions) {
  const reactFlow = useReactFlow();
  const [status, setStatus] = useState<CritiqueStatus>("idle");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [issues, setIssues] = useState<CritiqueIssue[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEventListener(({ event }) => {
    if (
      event.type === "AI_GENERATION_COMPLETE" &&
      event.generationId === generationId
    ) {
      handleCritiqueComplete(event.generationId);
    }
  });

  const handleCritiqueComplete = useCallback(
    async (genId: string) => {
      try {
        const res = await fetch(`/api/ai/design/${genId}`);
        if (!res.ok) throw new Error("Failed to fetch critique");

        const data = await res.json();
        if (data.status !== "completed" || !data.result) {
          throw new Error(data.error || "Critique failed");
        }

        const critique = data.result as CritiqueOutput;
        setIssues(critique.issues);
        setSummary(critique.summary);
        setStatus("done");

        const criticalCount = critique.issues.filter(
          (i) => i.severity === "critical"
        ).length;
        const warningCount = critique.issues.filter(
          (i) => i.severity === "warning"
        ).length;

        toast.success(
          `Found ${critique.issues.length} issues (${criticalCount} critical, ${warningCount} warnings)`
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Critique failed";
        setStatus("error");
        toast.error(msg);
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const startCritique = useCallback(async () => {
    const nodes = reactFlow.getNodes() as CanvasNode[];
    const edges = reactFlow.getEdges() as CanvasEdge[];

    if (nodes.length === 0) {
      toast.error("Nothing to review — add some components first");
      return;
    }

    setStatus("submitting");
    setIssues([]);
    setSummary("");

    try {
      const canvasContext = serializeCanvasForAI(nodes, edges);

      const res = await fetch("/api/ai/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, canvasContext }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start critique");
      }

      const { generationId: genId } = await res.json();
      setGenerationId(genId);
      setStatus("analyzing");

      // Fallback polling
      pollForCompletion(genId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Critique failed";
      setStatus("error");
      toast.error(msg);
    }
  }, [projectId, reactFlow]); // eslint-disable-line react-hooks/exhaustive-deps

  const pollForCompletion = useCallback(
    async (genId: string) => {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        if (status === "done" || status === "idle") return;

        try {
          const res = await fetch(`/api/ai/design/${genId}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.status === "completed") {
            handleCritiqueComplete(genId);
            return;
          }
          if (data.status === "failed") {
            setStatus("error");
            toast.error(data.error || "Critique failed");
            return;
          }
        } catch {
          // Keep polling
        }
      }
    },
    [status, handleCritiqueComplete]
  );

  const dismissIssue = useCallback((index: number) => {
    setDismissedIds((prev) => new Set(prev).add(String(index)));
  }, []);

  const focusNode = useCallback(
    (nodeLabel: string) => {
      const nodes = reactFlow.getNodes() as CanvasNode[];
      const target = nodes.find((n) => n.data.label === nodeLabel);
      if (target) {
        reactFlow.fitView({
          nodes: [{ id: target.id }],
          padding: 0.5,
          duration: 500,
        });
      }
    },
    [reactFlow]
  );

  const visibleIssues = issues.filter(
    (_, i) => !dismissedIds.has(String(i))
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setIssues([]);
    setSummary("");
    setGenerationId(null);
    setDismissedIds(new Set());
  }, []);

  return {
    status,
    issues: visibleIssues,
    allIssues: issues,
    summary,
    startCritique,
    dismissIssue,
    focusNode,
    reset,
  };
}

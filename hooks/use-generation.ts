"use client";

import { useState, useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { autoLayout } from "@/lib/ai/layout";
import { createNodeData, generateNodeId } from "@/lib/canvas-utils";
import type { ArchitectureOutput } from "@/lib/ai/schemas";
import type { CanvasNode, CanvasEdge, NodeCategory } from "@/types/canvas";

export type GenerationStatus =
  | "idle"
  | "submitting"
  | "generating"
  | "placing"
  | "done"
  | "error";

interface GenerationState {
  status: GenerationStatus;
  generationId: string | null;
  step: string;
  /** Pipeline stages seen so far this run (server-streamed), in order. */
  stages: string[];
}

/** The most recent completed generation — powers Revert/Restore + feedback. */
export interface LastGeneration {
  generationId: string;
  architecture: ArchitectureOutput;
  nodeIds: string[];
  edgeIds: string[];
  reverted: boolean;
  rating: 1 | -1 | null;
}

interface UseGenerationOptions {
  projectId: string;
  getNodes: () => CanvasNode[];
  getEdges: () => CanvasEdge[];
}

export function useGeneration({ projectId, getNodes, getEdges }: UseGenerationOptions) {
  const reactFlow = useReactFlow();
  const [state, setState] = useState<GenerationState>({
    status: "idle",
    generationId: null,
    step: "",
    stages: [],
  });
  const [lastGeneration, setLastGeneration] = useState<LastGeneration | null>(null);
  const rateLimitRef = useRef(false);

  const placeArchitectureOnCanvas = useCallback(
    async (architecture: ArchitectureOutput) => {
      // Apply auto-layout
      const layoutNodes = autoLayout(
        architecture.nodes.map((n) => ({
          label: n.label,
          category: n.category as NodeCategory,
        }))
      );

      // Map label → generated node ID
      const labelToId = new Map<string, string>();
      const placedNodeIds: string[] = [];

      // Stagger-add nodes with 100ms delay each
      for (let i = 0; i < layoutNodes.length; i++) {
        const layoutNode = layoutNodes[i];
        const aiNode = architecture.nodes.find((n) => n.label === layoutNode.label);
        if (!aiNode) continue;

        const nodeId = generateNodeId();
        labelToId.set(aiNode.label, nodeId);
        placedNodeIds.push(nodeId);

        const category = aiNode.category as NodeCategory;
        const baseData = createNodeData(category, aiNode.label);

        const nodeData = {
          ...baseData,
          description: aiNode.description ?? "",
          configTechnology: aiNode.configTechnology,
          configPort: aiNode.configPort,
          configProtocol: aiNode.configProtocol,
          configScaling: aiNode.configScaling,
          configDbType: aiNode.configDbType,
          configReplication: aiNode.configReplication,
          configQueueType: aiNode.configQueueType,
          configCacheType: aiNode.configCacheType,
          configTtl: aiNode.configTtl,
          configAuthMethod: aiNode.configAuthMethod,
          configRateLimit: aiNode.configRateLimit,
          configRuntime: aiNode.configRuntime,
          configMemory: aiNode.configMemory,
          configTimeout: aiNode.configTimeout,
          configPlatform: aiNode.configPlatform,
          configFramework: aiNode.configFramework,
          configStorageType: aiNode.configStorageType,
        };

        reactFlow.addNodes({
          id: nodeId,
          type: "systemNode",
          position: layoutNode.position,
          data: nodeData,
        });

        // Stagger delay
        if (i < layoutNodes.length - 1) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      // Small pause before adding edges
      await new Promise((r) => setTimeout(r, 200));

      // Add edges
      const newEdges = architecture.edges
        .map((aiEdge) => {
          const sourceId = labelToId.get(aiEdge.sourceLabel);
          const targetId = labelToId.get(aiEdge.targetLabel);
          if (!sourceId || !targetId) return null;

          return {
            id: `edge-${sourceId}-${targetId}-${Date.now()}`,
            source: sourceId,
            target: targetId,
            type: "custom",
            data: {
              label: aiEdge.label ?? "",
              animated: true,
              edgeStyle: "default" as const,
            },
          };
        })
        .filter(Boolean) as CanvasEdge[];

      if (newEdges.length > 0) {
        reactFlow.addEdges(newEdges);
      }

      // Fit view after all nodes are placed
      setTimeout(() => {
        reactFlow.fitView({ padding: 0.2, duration: 500 });
      }, 300);

      return { nodeIds: placedNodeIds, edgeIds: newEdges.map((e) => e.id) };
    },
    [reactFlow]
  );

  const generate = useCallback(
    async (prompt: string, mode: "generate" | "url-analyze" = "generate", url?: string) => {
      if (rateLimitRef.current) {
        toast.error("Please wait a moment before generating again");
        return;
      }

      setState({
        status: mode === "url-analyze" ? "generating" : "submitting",
        generationId: null,
        step: mode === "url-analyze" ? `Researching ${url ?? "the site"}…` : "Generating architecture…",
        stages: [],
      });

      // Rate limit: 3 seconds
      rateLimitRef.current = true;
      setTimeout(() => { rateLimitRef.current = false; }, 3000);

      try {
        // Serialize current canvas for context
        const nodes = getNodes();
        const edges = getEdges();
        const { serializeCanvasForAI } = await import("@/lib/ai/canvas-context");
        const canvasContext = nodes.length > 0 ? serializeCanvasForAI(nodes, edges) : undefined;

        setState((prev) => ({ ...prev, status: "generating", step: "Generating architecture…" }));

        const res = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, prompt, mode, url, canvasContext }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to generate architecture");
        }

        // The route streams NDJSON: status events (live stage text) followed by
        // a single result or error event.
        if (!res.body) throw new Error("No response stream");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let final: { generationId: string; architecture: ArchitectureOutput } | null = null;

        const handleLine = (raw: string) => {
          if (!raw.trim()) return;
          const event = JSON.parse(raw) as {
            type: "status" | "result" | "error";
            message?: string;
            error?: string;
            generationId?: string;
            architecture?: ArchitectureOutput;
          };
          if (event.type === "status" && event.message) {
            const stage = (event as { stage?: string }).stage;
            setState((prev) => ({
              ...prev,
              status: "generating",
              step: event.message!,
              stages:
                stage && !prev.stages.includes(stage)
                  ? [...prev.stages, stage]
                  : prev.stages,
            }));
          } else if (event.type === "result" && event.architecture) {
            final = { generationId: event.generationId!, architecture: event.architecture };
          } else if (event.type === "error") {
            throw new Error(event.error || "Generation failed");
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const rawLine = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            handleLine(rawLine);
          }
        }
        if (buffer.trim()) handleLine(buffer);

        if (!final) throw new Error("Generation ended unexpectedly — please retry");
        const { generationId, architecture } = final as {
          generationId: string;
          architecture: ArchitectureOutput;
        };

        setState((prev) => ({
          status: "placing",
          generationId,
          step: "Placing nodes on canvas…",
          stages: prev.stages.includes("placing")
            ? prev.stages
            : [...prev.stages, "placing"],
        }));
        const placed = await placeArchitectureOnCanvas(architecture);

        setLastGeneration({
          generationId,
          architecture,
          nodeIds: placed.nodeIds,
          edgeIds: placed.edgeIds,
          reverted: false,
          rating: null,
        });

        setState((prev) => ({ ...prev, status: "done", step: "Architecture ready!" }));
        toast.success(`Generated ${architecture.nodes.length} components`);

        // Reset to idle after a moment
        setTimeout(() => {
          setState({ status: "idle", generationId: null, step: "", stages: [] });
        }, 3000);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Generation failed";
        setState({ status: "error", generationId: null, step: msg, stages: [] });
        toast.error(msg);
      }
    },
    [projectId, getNodes, getEdges, placeArchitectureOnCanvas]
  );

  const reset = useCallback(() => {
    setState({ status: "idle", generationId: null, step: "", stages: [] });
  }, []);

  /** Remove everything the last generation placed (kept restorable). */
  const revertGeneration = useCallback(() => {
    setLastGeneration((prev) => {
      if (!prev || prev.reverted) return prev;
      reactFlow.deleteElements({
        nodes: prev.nodeIds.map((id) => ({ id })),
        edges: prev.edgeIds.map((id) => ({ id })),
      });
      toast.success("Generation reverted", { description: "Restore brings it back." });
      return { ...prev, reverted: true };
    });
  }, [reactFlow]);

  /** Re-place a reverted generation (fresh IDs, same architecture). */
  const restoreGeneration = useCallback(async () => {
    const current = lastGeneration;
    if (!current || !current.reverted) return;
    const placed = await placeArchitectureOnCanvas(current.architecture);
    setLastGeneration((prev) =>
      prev && prev.generationId === current.generationId
        ? { ...prev, nodeIds: placed.nodeIds, edgeIds: placed.edgeIds, reverted: false }
        : prev
    );
  }, [lastGeneration, placeArchitectureOnCanvas]);

  /** Thumbs up/down (tap again to clear). Optimistic; failure just logs. */
  const rateGeneration = useCallback(
    async (rating: 1 | -1) => {
      const current = lastGeneration;
      if (!current) return;
      const next = current.rating === rating ? null : rating;
      setLastGeneration((prev) => (prev ? { ...prev, rating: next } : prev));
      await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: current.generationId, rating: next ?? 0 }),
      }).catch(() => {});
    },
    [lastGeneration]
  );

  const dismissLastGeneration = useCallback(() => setLastGeneration(null), []);

  /** Register an already-placed architecture (agent tool path) so the
   * revert/restore + rating card works for conversational generations too. */
  const registerPlacement = useCallback(
    (
      generationId: string,
      architecture: ArchitectureOutput,
      placed: { nodeIds: string[]; edgeIds: string[] }
    ) => {
      setLastGeneration({
        generationId,
        architecture,
        nodeIds: placed.nodeIds,
        edgeIds: placed.edgeIds,
        reverted: false,
        rating: null,
      });
    },
    []
  );

  return {
    ...state,
    generate,
    reset,
    placeArchitectureOnCanvas,
    lastGeneration,
    revertGeneration,
    restoreGeneration,
    rateGeneration,
    dismissLastGeneration,
    registerPlacement,
  };
}

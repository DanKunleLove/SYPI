"use client";

import { useState, useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useEventListener } from "@liveblocks/react";
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
  runId: string | null;
  step: string;
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
    runId: null,
    step: "",
  });
  const rateLimitRef = useRef(false);
  // Ensures a generation is placed once, even if the Liveblocks event and the
  // polling fallback both fire.
  const handledRef = useRef<string | null>(null);

  // Listen for AI_GENERATION_COMPLETE from Liveblocks room events
  useEventListener(({ event }) => {
    if (
      event.type === "AI_GENERATION_COMPLETE" &&
      event.generationId === state.generationId
    ) {
      handleGenerationComplete(event.generationId);
    }
  });

  // Listen for status updates
  useEventListener(({ event }) => {
    if (event.type === "AI_STATUS_UPDATE") {
      setState((prev) => ({ ...prev, step: event.message }));
    }
  });

  const handleGenerationComplete = useCallback(
    async (generationId: string) => {
      // Dedupe: the room event and the polling fallback can both call this.
      if (handledRef.current === generationId) return;
      handledRef.current = generationId;

      setState((prev) => ({ ...prev, status: "placing", step: "Placing nodes on canvas..." }));

      try {
        // Fetch the result
        const res = await fetch(`/api/ai/design/${generationId}`);
        if (!res.ok) throw new Error("Failed to fetch generation result");

        const data = await res.json();
        if (data.status !== "completed" || !data.result) {
          throw new Error(data.error || "Generation failed");
        }

        const architecture = data.result as ArchitectureOutput;
        await placeArchitectureOnCanvas(architecture);

        setState({ status: "done", generationId, runId: null, step: "Architecture ready!" });
        toast.success(`Generated ${architecture.nodes.length} components`);

        // Reset to idle after a moment
        setTimeout(() => {
          setState({ status: "idle", generationId: null, runId: null, step: "" });
        }, 3000);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Placement failed";
        setState({ status: "error", generationId, runId: null, step: msg });
        toast.error(msg);
      }
    },
    [reactFlow] // eslint-disable-line react-hooks/exhaustive-deps
  );

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

      // Stagger-add nodes with 100ms delay each
      for (let i = 0; i < layoutNodes.length; i++) {
        const layoutNode = layoutNodes[i];
        const aiNode = architecture.nodes.find((n) => n.label === layoutNode.label);
        if (!aiNode) continue;

        const nodeId = generateNodeId();
        labelToId.set(aiNode.label, nodeId);

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
    },
    [reactFlow]
  );

  const generate = useCallback(
    async (prompt: string, mode: "generate" | "url-analyze" = "generate", url?: string) => {
      if (rateLimitRef.current) {
        toast.error("Please wait a moment before generating again");
        return;
      }

      handledRef.current = null;
      setState({ status: "submitting", generationId: null, runId: null, step: "Submitting request..." });

      // Rate limit: 3 seconds
      rateLimitRef.current = true;
      setTimeout(() => { rateLimitRef.current = false; }, 3000);

      try {
        // Serialize current canvas for context
        const nodes = getNodes();
        const edges = getEdges();
        const { serializeCanvasForAI } = await import("@/lib/ai/canvas-context");
        const canvasContext = nodes.length > 0 ? serializeCanvasForAI(nodes, edges) : undefined;

        const res = await fetch("/api/ai/design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            prompt,
            mode,
            url,
            canvasContext,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to start generation");
        }

        const { generationId, runId } = await res.json();

        setState({
          status: "generating",
          generationId,
          runId,
          step: "Analyzing your request...",
        });

        // Poll for completion as a fallback (in case Liveblocks event is missed)
        pollForCompletion(generationId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Generation failed";
        setState({ status: "error", generationId: null, runId: null, step: msg });
        toast.error(msg);
      }
    },
    [projectId, getNodes, getEdges] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const pollForCompletion = useCallback(
    async (generationId: string) => {
      const maxAttempts = 60; // 2 minutes max
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 2000));

        // Already handled via the Liveblocks event — stop polling.
        if (handledRef.current === generationId) return;

        try {
          const res = await fetch(`/api/ai/design/${generationId}`);
          if (!res.ok) continue;

          const data = await res.json();
          if (data.status === "completed") {
            handleGenerationComplete(generationId);
            return;
          }
          if (data.status === "failed") {
            setState({
              status: "error",
              generationId,
              runId: null,
              step: data.error || "Generation failed",
            });
            toast.error(data.error || "Generation failed");
            return;
          }
        } catch {
          // Network error — keep polling
        }
      }

      // Timed out without ever completing. Most common cause in local dev:
      // the Trigger.dev worker isn't running (run `npm run dev:trigger`).
      if (handledRef.current !== generationId) {
        const msg =
          "Generation timed out. Make sure the AI worker is running (npm run dev:trigger).";
        setState({ status: "error", generationId, runId: null, step: msg });
        toast.error(msg);
      }
    },
    [handleGenerationComplete]
  );

  const reset = useCallback(() => {
    setState({ status: "idle", generationId: null, runId: null, step: "" });
  }, []);

  return {
    ...state,
    generate,
    reset,
    placeArchitectureOnCanvas,
  };
}

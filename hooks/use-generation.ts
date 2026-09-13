"use client";

import { useState, useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";
import { autoLayout } from "@/lib/ai/layout";
import { createNodeData, generateNodeId } from "@/lib/canvas-utils";
import {
  FIRST_STEP,
  initialSteps,
  stepLabel,
  type PipelineStepId,
  type PipelineStepState,
} from "@/lib/ai/pipeline";
import type { ArchitectureOutput, DiffOperation } from "@/lib/ai/schemas";
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
  /** Human label of whatever is happening right now. */
  step: string;
  /** The whole plan, seeded up front so the user can see where this is going. */
  steps: PipelineStepState[];
  /** Set when a step fails, so it — and only it — can be retried. */
  failedStep: { runId: string; step: PipelineStepId } | null;
}

export interface ResumableRun {
  runId: string;
  brief: string;
  step: PipelineStepId;
}

/** The spec numbers a step returns, so the health bar moves as the run proceeds. */
export interface SpecSnapshot {
  coverage: number;
  tier: number;
  tierLabel: string;
  materialDecisions: number;
  components: number;
}

interface PipelineResponse {
  ok: boolean;
  step: PipelineStepId;
  runId?: string;
  nextStep: PipelineStepId | null;
  ms?: number;
  detail?: string;
  skipped?: boolean;
  error?: string;
  architecture?: ArchitectureOutput;
  operations?: DiffOperation[];
  spec?: SpecSnapshot | null;
}

/**
 * The platform kills a function at 60s. Give up at 55 so the CLIENT owns the
 * timeout and can name the step that ran out, instead of surfacing a bare
 * network error that could mean anything.
 */
const STEP_TIMEOUT_MS = 55_000;

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
    steps: [],
    failedStep: null,
  });
  const [spec, setSpec] = useState<SpecSnapshot | null>(null);
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

  /**
   * Put the design on the canvas — merging, never duplicating.
   *
   * `placeArchitectureOnCanvas` calls generateNodeId() per node with no lookup
   * against what is already there, so it APPENDS. Generate twice and you get two
   * "Portfolio Frontend" nodes, two gateways, two databases — which is exactly
   * what happened to the project that started this work.
   *
   * An empty canvas keeps the staggered auto-layout entrance, because that is the
   * moment the layout is worth having. A canvas with something on it goes through
   * the operations the server derived from the spec, which match by label and add
   * only what is genuinely missing.
   */
  const placeOrMerge = useCallback(
    async (architecture: ArchitectureOutput, operations: DiffOperation[], runId: string | null) => {
      const existing = getNodes();

      if (existing.length === 0) {
        const placed = await placeArchitectureOnCanvas(architecture);
        if (runId) {
          setLastGeneration({
            generationId: runId,
            architecture,
            nodeIds: placed.nodeIds,
            edgeIds: placed.edgeIds,
            reverted: false,
            rating: null,
          });
        }
        toast.success(`Placed ${architecture.nodes.length} components`);
        return;
      }

      const { applyDiffOperations } = await import("@/lib/ai/canvas-diff");
      const result = applyDiffOperations(reactFlow, operations, existing, getEdges());
      const added = operations.filter((o) => o.op === "ADD_NODE").length;
      toast.success(
        added > 0
          ? `Merged into the canvas — ${added} new component${added === 1 ? "" : "s"}`
          : "Canvas already matches the design"
      );
      void result;
    },
    [getNodes, getEdges, reactFlow, placeArchitectureOnCanvas]
  );

  /**
   * Run the design pipeline, one request per step.
   *
   * This replaces `generate`, which posted the whole chain to /api/ai/generate in
   * a single request. Two things were wrong with that: it could not finish inside
   * Vercel Hobby's 60s ceiling, and — the reason no project in the database has
   * ever had a specification — NOTHING EVER CALLED IT. This hook exported it and
   * the one component using the hook never destructured it.
   *
   * Every step commits to the spec before the next begins, so a failure costs one
   * step rather than the whole run, and a closed tab can be resumed.
   */
  const runPipeline = useCallback(
    async (brief: string, options?: { url?: string; runId?: string; fromStep?: PipelineStepId }) => {
      if (rateLimitRef.current) {
        toast.error("Please wait a moment before generating again");
        return;
      }
      rateLimitRef.current = true;
      setTimeout(() => {
        rateLimitRef.current = false;
      }, 3000);

      // Seed the whole plan up front, greyed out. Showing the steps only as they
      // start reads as "something is happening"; showing them all reads as "it
      // knows what it is doing", which is the difference that matters.
      setState({
        status: "generating",
        generationId: options?.runId ?? null,
        step: "",
        steps: initialSteps(),
        failedStep: null,
      });

      let runId = options?.runId ?? null;
      let step: PipelineStepId | null = options?.fromStep ?? FIRST_STEP;

      const mark = (id: PipelineStepId, patch: Partial<PipelineStepState>) =>
        setState((prev) => ({
          ...prev,
          steps: prev.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        }));

      try {
        while (step) {
          const current: PipelineStepId = step;
          mark(current, { status: "running" });
          setState((prev) => ({ ...prev, step: stepLabel(current) }));

          const nodes = getNodes();
          const edges = getEdges();

          const res = await fetch("/api/ai/pipeline", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // The client owns the timeout. The platform kills the function at 60s
            // with no usable error, so we give up at 55 and can at least name the
            // step that ran out of time.
            signal: AbortSignal.timeout(STEP_TIMEOUT_MS),
            body: JSON.stringify({
              projectId,
              step: current,
              runId,
              brief,
              url: options?.url,
              nodes,
              edges,
            }),
          }).catch((e: unknown) => {
            const timedOut = e instanceof DOMException && e.name === "TimeoutError";
            throw new Error(
              timedOut
                ? `"${stepLabel(current)}" took longer than 55s and was cut off. Retry it.`
                : "Lost connection. Retry this step."
            );
          });

          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error || `"${stepLabel(current)}" failed`);
          }

          const data = (await res.json()) as PipelineResponse;

          // A failed step is a 200 with ok:false — an HTTP error would be
          // indistinguishable from the platform killing the function.
          if (data.ok === false) {
            mark(current, { status: "failed", error: data.error });
            setState((prev) => ({
              ...prev,
              status: "error",
              step: data.error ?? "That step failed",
              failedStep: { runId: data.runId ?? runId ?? "", step: current },
            }));
            toast.error(`${stepLabel(current)}: ${data.error}`);
            return;
          }

          runId = data.runId ?? runId;
          mark(current, {
            status: data.skipped ? "skipped" : "done",
            detail: data.detail,
            ms: data.ms,
          });
          if (data.spec) setSpec(data.spec);

          // The architecture lands on the canvas at the step that records it.
          if (data.architecture && data.operations) {
            await placeOrMerge(data.architecture, data.operations, runId);
          }

          step = data.nextStep;
        }

        setState((prev) => ({ ...prev, status: "done", step: "Done" }));
      } catch (error) {
        const msg = error instanceof Error ? error.message : "The run failed";
        setState((prev) => ({
          ...prev,
          status: "error",
          step: msg,
          steps: prev.steps.map((s) => (s.status === "running" ? { ...s, status: "failed", error: msg } : s)),
          failedStep: runId && step ? { runId, step } : null,
        }));
        toast.error(msg);
      }
    },
    [projectId, getNodes, getEdges, placeOrMerge]
  );

  /**
   * Retry only the step that failed, on the same run.
   *
   * Free, and that is the whole point of committing after every step: nothing
   * before the failure is re-extracted and no quota is charged again.
   */
  const retryStep = useCallback(async () => {
    const failed = state.failedStep;
    if (!failed) return;
    rateLimitRef.current = false;
    // The brief is not passed: it lives on the run record server-side, and a
    // retry never re-runs `start`, which is the only step that reads it.
    await runPipeline("", { runId: failed.runId, fromStep: failed.step });
  }, [state.failedStep, runPipeline]);

  /** Is there a run this project abandoned mid-way? Answers the closed-tab case. */
  const findResumable = useCallback(async (): Promise<ResumableRun | null> => {
    try {
      const res = await fetch(`/api/ai/pipeline?projectId=${encodeURIComponent(projectId)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        resumable: boolean;
        runId?: string;
        brief?: string;
        step?: PipelineStepId | null;
      };
      if (!data.resumable || !data.runId || !data.brief || !data.step) return null;
      return { runId: data.runId, brief: data.brief, step: data.step };
    } catch {
      return null;
    }
  }, [projectId]);

  const reset = useCallback(() => {
    setState({ status: "idle", generationId: null, step: "", steps: [], failedStep: null });
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
    spec,
    runPipeline,
    retryStep,
    findResumable,
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

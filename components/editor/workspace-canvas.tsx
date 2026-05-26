"use client";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  MarkerType,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { useLiveblocksFlow, Cursors } from "@liveblocks/react-flow";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  MessageSquare,
  LayoutTemplate,
  Mouse,
  ZoomIn,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemNode } from "@/components/canvas/system-node";
import { CustomEdge } from "@/components/canvas/custom-edge";
import { NodePalette } from "@/components/canvas/node-palette";
import { PresenceAvatars } from "@/components/canvas/presence-avatars";
import { CanvasToolbar } from "@/components/canvas/canvas-toolbar";
import { CustomCursor } from "@/components/canvas/custom-cursor";
import { useCanvasShortcuts } from "@/hooks/use-canvas-shortcuts";
import { useCanvasAutosave, type SaveStatus } from "@/hooks/use-canvas-autosave";
import { createNodeData, generateNodeId } from "@/lib/canvas-utils";
import type { CanvasNode, CanvasEdge, NodeCategory } from "@/types/canvas";

import "@xyflow/react/dist/style.css";

const nodeTypes: NodeTypes = {
  systemNode: SystemNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

interface WorkspaceCanvasProps {
  projectId: string;
  onNodeCountChange?: (count: number) => void;
  onZoomChange?: (zoom: number) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  onSaveStatusChange?: (status: SaveStatus) => void;
  onSaveReady?: (saveFn: () => Promise<void>) => void;
}

export function WorkspaceCanvas({
  projectId,
  onNodeCountChange,
  onZoomChange,
  onNodeSelect,
  onSaveReady,
  onSaveStatusChange,
}: WorkspaceCanvasProps) {
  const flowResult = useLiveblocksFlow<CanvasNode, CanvasEdge>({
    suspense: true,
  });
  const nodes = flowResult.nodes as CanvasNode[];
  const edges = flowResult.edges as CanvasEdge[];
  const { onNodesChange, onEdgesChange, onConnect, onDelete } = flowResult;

  const reactFlowInstance = useReactFlow();
  const prevNodeCount = useRef(nodes.length);
  const [showEmptyState, setShowEmptyState] = useState(true);
  const hasLoadedRef = useRef(false);

  // Register keyboard shortcuts
  useCanvasShortcuts();

  // Manual save only — no autosave, no performance impact
  const getNodes = useCallback(() => reactFlowInstance.getNodes(), [reactFlowInstance]);
  const getEdges = useCallback(() => reactFlowInstance.getEdges(), [reactFlowInstance]);
  const { status: saveStatus, save: manualSave } = useCanvasAutosave({
    projectId,
    getNodes,
    getEdges,
  });

  // Notify parent of save status changes
  useEffect(() => {
    onSaveStatusChange?.(saveStatus);
  }, [saveStatus, onSaveStatusChange]);

  // Expose manual save function to parent
  useEffect(() => {
    onSaveReady?.(manualSave);
  }, [manualSave, onSaveReady]);

  // Load saved canvas on mount (if Liveblocks room is empty)
  useEffect(() => {
    if (hasLoadedRef.current) return;
    if (nodes.length > 0 || edges.length > 0) {
      hasLoadedRef.current = true;
      return;
    }

    hasLoadedRef.current = true;

    fetch(`/api/projects/${projectId}/canvas`)
      .then((res) => res.json())
      .then((data) => {
        if (data.nodes?.length > 0) {
          reactFlowInstance.addNodes(
            data.nodes.map((n: Record<string, unknown>) => ({
              ...n,
              type: (n.type as string) || "systemNode",
            }))
          );
        }
        if (data.edges?.length > 0) {
          reactFlowInstance.addEdges(data.edges);
        }
      })
      .catch(() => {
        // Silent fail — canvas starts empty
      });
  }, [projectId, nodes.length, edges.length, reactFlowInstance]);

  // Report node count changes
  useEffect(() => {
    if (nodes.length !== prevNodeCount.current) {
      prevNodeCount.current = nodes.length;
      onNodeCountChange?.(nodes.length);
    }
  }, [nodes.length, onNodeCountChange]);

  // Hide empty state once nodes exist
  useEffect(() => {
    if (nodes.length > 0) {
      setShowEmptyState(false);
    }
  }, [nodes.length]);

  // Report zoom changes
  const handleMoveEnd = useCallback(() => {
    const zoom = reactFlowInstance.getZoom();
    onZoomChange?.(Math.round(zoom * 100));
  }, [reactFlowInstance, onZoomChange]);

  // Handle drop from node palette drag
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const category = e.dataTransfer.getData("application/spi-node-type") as NodeCategory;
      if (!category) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      const newNode = {
        id: generateNodeId(),
        type: "systemNode",
        position,
        data: createNodeData(category),
      };

      reactFlowInstance.addNodes(newNode);
      setShowEmptyState(false);
    },
    [reactFlowInstance]
  );

  // Node click → notify parent to open inspector
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: CanvasNode) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect]
  );

  // Canvas background click → deselect / close inspector
  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  // Start building manually — dismiss empty state
  const handleStartManual = useCallback(() => {
    setShowEmptyState(false);
  }, []);

  const isEmpty = nodes.length === 0;

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Animated radial glow */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.04) 0%, transparent 70%)",
        }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 z-0"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          background:
            "radial-gradient(ellipse 40% 40% at 50% 40%, rgba(167,139,250,0.03) 0%, transparent 70%)",
        }}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        onMoveEnd={handleMoveEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        selectionOnDrag
        selectNodesOnDrag
        elementsSelectable
        connectionLineStyle={{
          stroke: "var(--accent-primary)",
          strokeWidth: 2,
        }}
        defaultEdgeOptions={{
          type: "custom",
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: "var(--border-subtle)",
          },
          style: {
            stroke: "var(--border-subtle)",
            strokeWidth: 2,
          },
        }}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        {/* Collaborative cursors — custom small cursor with name label */}
        <Cursors components={{ Cursor: CustomCursor }} />

        {/* Dot grid background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--border-default)"
        />

      </ReactFlow>

      {/* Presence avatars — top right */}
      <PresenceAvatars />

      {/* Canvas toolbar — bottom left (zoom + undo/redo) */}
      <CanvasToolbar />

      {/* Empty state overlay */}
      <AnimatePresence>
        {isEmpty && showEmptyState && (
          <EmptyState onStartManual={handleStartManual} />
        )}
      </AnimatePresence>

      {/* Node palette */}
      {(!showEmptyState || !isEmpty) && <NodePalette />}
    </div>
  );
}

function EmptyState({ onStartManual }: { onStartManual: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="pointer-events-auto flex flex-col items-center gap-6 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-surface)] shadow-lg shadow-black/20">
          <GitBranch className="h-8 w-8 text-[var(--text-muted)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Describe your system architecture
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-[var(--text-secondary)]">
            Start with a prompt, build manually, or pick a template
          </p>
        </div>

        <div className="flex gap-3">
          <QuickAction
            icon={MessageSquare}
            label="Start from prompt"
            description="Describe your system"
            accent
          />
          <QuickAction
            icon={Wrench}
            label="Build manually"
            description="Drag and drop nodes"
            onClick={onStartManual}
          />
          <QuickAction
            icon={LayoutTemplate}
            label="Use a template"
            description="Pre-built architectures"
            disabled
          />
        </div>

        <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <Mouse className="h-3 w-3" />
            Space + drag to pan
          </span>
          <span className="flex items-center gap-1.5">
            <ZoomIn className="h-3 w-3" />
            Scroll to zoom
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  accent,
  disabled,
  onClick,
}: {
  icon: typeof MessageSquare;
  label: string;
  description: string;
  accent?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-auto flex-col gap-1.5 rounded-xl border p-4 ${
        accent
          ? "border-[var(--accent-ai)]/30 bg-[var(--accent-ai)]/5 hover:border-[var(--accent-ai)]/60 hover:bg-[var(--accent-ai)]/10"
          : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-subtle)]"
      } disabled:opacity-40`}
    >
      <Icon
        className={`h-5 w-5 ${accent ? "text-[var(--accent-ai)]" : "text-[var(--text-muted)]"}`}
      />
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {label}
      </span>
      <span className="text-[11px] text-[var(--text-muted)]">{description}</span>
    </Button>
  );
}

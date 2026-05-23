"use client";

import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  useReactFlow,
} from "@xyflow/react";
import { useLiveblocksFlow, Cursors } from "@liveblocks/react-flow";
import { useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { GitBranch, MessageSquare, LayoutTemplate, Upload, Mouse, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptBar } from "@/components/editor/prompt-bar";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

import "@xyflow/react/dist/style.css";

interface WorkspaceCanvasProps {
  onNodeCountChange?: (count: number) => void;
  onZoomChange?: (zoom: number) => void;
}

export function WorkspaceCanvas({
  onNodeCountChange,
  onZoomChange,
}: WorkspaceCanvasProps) {
  const flowResult = useLiveblocksFlow<CanvasNode, CanvasEdge>({
    suspense: true,
  });
  // suspense: true guarantees nodes/edges are never null
  const nodes = flowResult.nodes as CanvasNode[];
  const edges = flowResult.edges as CanvasEdge[];
  const { onNodesChange, onEdgesChange, onConnect, onDelete } = flowResult;

  const reactFlowInstance = useReactFlow();
  const prevNodeCount = useRef(nodes.length);

  // Report node count changes
  useEffect(() => {
    if (nodes.length !== prevNodeCount.current) {
      prevNodeCount.current = nodes.length;
      onNodeCountChange?.(nodes.length);
    }
  }, [nodes.length, onNodeCountChange]);

  // Report zoom changes
  const handleMoveEnd = useCallback(() => {
    const zoom = reactFlowInstance.getZoom();
    onZoomChange?.(Math.round(zoom * 100));
  }, [reactFlowInstance, onZoomChange]);

  const isEmpty = nodes.length === 0;

  return (
    <div className="relative flex-1 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        onMoveEnd={handleMoveEnd}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        connectionLineStyle={{
          stroke: "var(--accent-primary)",
          strokeWidth: 2,
        }}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: {
            stroke: "var(--border-subtle)",
            strokeWidth: 2,
          },
        }}
        proOptions={{ hideAttribution: true }}
        style={{ backgroundColor: "var(--bg-base)" }}
      >
        {/* Collaborative cursors */}
        <Cursors />

        {/* Dot grid background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--border-default)"
        />

        {/* MiniMap styled to match dark theme */}
        <MiniMap
          nodeColor={miniMapNodeColor}
          maskColor="rgba(0, 0, 0, 0.7)"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderRadius: 8,
            border: "1px solid var(--border-default)",
          }}
          pannable
          zoomable
        />
      </ReactFlow>

      {/* Empty state overlay — shown when no nodes exist */}
      {isEmpty && <EmptyState />}

      {/* Prompt bar */}
      <PromptBar />
    </div>
  );
}

/** Maps node category to a MiniMap color. */
function miniMapNodeColor(node: CanvasNode): string {
  const category = node.data?.nodeCategory;
  switch (category) {
    case "database":
      return "#22c55e"; // green-500
    case "queue":
      return "#eab308"; // yellow-500
    case "gateway":
      return "#6366f1"; // indigo-500
    case "cache":
      return "#f97316"; // orange-500
    case "client":
      return "#06b6d4"; // cyan-500
    case "storage":
      return "#8b5cf6"; // violet-500
    case "compute":
      return "#ec4899"; // pink-500
    default:
      return "#a1a1aa"; // zinc-400
  }
}

function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="pointer-events-auto flex flex-col items-center gap-6 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-surface)]">
          <GitBranch className="h-8 w-8 text-[var(--text-muted)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">
            Describe your system architecture
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-[var(--text-secondary)]">
            Start with a prompt, pick a template, or import an existing design
          </p>
        </div>

        {/* Quick-start actions */}
        <div className="flex gap-3">
          <QuickAction
            icon={MessageSquare}
            label="Start from prompt"
            description="Describe your system"
            accent
          />
          <QuickAction
            icon={LayoutTemplate}
            label="Use a template"
            description="Pre-built architectures"
            disabled
          />
          <QuickAction
            icon={Upload}
            label="Import existing"
            description="Upload a diagram"
            disabled
          />
        </div>

        {/* Keyboard hints */}
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
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  accent,
  disabled,
}: {
  icon: typeof MessageSquare;
  label: string;
  description: string;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      disabled={disabled}
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

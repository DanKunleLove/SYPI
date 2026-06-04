"use client";

import { ReactFlow, Background, BackgroundVariant, type NodeTypes, type EdgeTypes, MarkerType } from "@xyflow/react";
import { ReactFlowProvider } from "@xyflow/react";
import { SystemNode } from "@/components/canvas/system-node";
import { CustomEdge } from "@/components/canvas/custom-edge";
import "@xyflow/react/dist/style.css";

const nodeTypes: NodeTypes = { systemNode: SystemNode };
const edgeTypes: EdgeTypes = { custom: CustomEdge };

interface ShareCanvasViewerProps {
  nodes: unknown[];
  edges: unknown[];
}

function ViewerCanvas({ nodes, edges }: ShareCanvasViewerProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--text-muted)]">
          No canvas data available for this share link.
        </p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes as Parameters<typeof ReactFlow>[0]["nodes"]}
      edges={(edges as Array<{ id: string; source: string; target: string; [k: string]: unknown }>).map((e) => ({
        ...e,
        type: "custom",
      }))}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
      zoomOnScroll={true}
      defaultEdgeOptions={{
        type: "custom",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: "var(--border-subtle)",
        },
        style: { stroke: "var(--border-subtle)", strokeWidth: 2 },
      }}
      proOptions={{ hideAttribution: true }}
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1}
        color="var(--border-default)"
      />
    </ReactFlow>
  );
}

export function ShareCanvasViewer({ nodes, edges }: ShareCanvasViewerProps) {
  return (
    <ReactFlowProvider>
      <ViewerCanvas nodes={nodes} edges={edges} />
    </ReactFlowProvider>
  );
}

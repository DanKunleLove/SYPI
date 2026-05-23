import type { Node, Edge } from "@xyflow/react";

// --- Node types ---

export type NodeCategory =
  | "service"
  | "database"
  | "queue"
  | "gateway"
  | "client"
  | "cache"
  | "storage"
  | "compute"
  | "custom";

export type NodeShape = "rectangle" | "rounded" | "diamond" | "cylinder";

export type NodeStatus = "idle" | "active" | "error";

export interface CanvasNodeData {
  label: string;
  color: string;
  shape: NodeShape;
  icon?: string;
  description?: string;
  nodeCategory?: NodeCategory;
  status?: NodeStatus;
  [key: string]: unknown;
}

export type CanvasNode = Node<CanvasNodeData, "canvasNode">;

// --- Edge types ---

export type EdgeStyle = "default" | "dashed";

export interface CanvasEdgeData {
  label?: string;
  animated?: boolean;
  edgeStyle?: EdgeStyle;
  [key: string]: unknown;
}

export type CanvasEdge = Edge<CanvasEdgeData, "canvasEdge">;

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
  /** User-overridden color (takes priority over category default) */
  customColor?: string;
  /** System configuration — flattened for Liveblocks compatibility */
  configTechnology?: string;
  configPort?: string;
  configProtocol?: string;
  configScaling?: string;
  configDbType?: string;
  configReplication?: string;
  configQueueType?: string;
  configCacheType?: string;
  configTtl?: string;
  configAuthMethod?: string;
  configRateLimit?: string;
  configRuntime?: string;
  configMemory?: string;
  configTimeout?: string;
  configPlatform?: string;
  configFramework?: string;
  configStorageType?: string;
  notes?: string;
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

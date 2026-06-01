import type { ReactFlowInstance } from "@xyflow/react";
import { createNodeData, generateNodeId } from "@/lib/canvas-utils";
import { autoLayout } from "@/lib/ai/layout";
import type { DiffOperation } from "@/lib/ai/schemas";
import type { CanvasNode, CanvasEdge, NodeCategory } from "@/types/canvas";

/**
 * Apply diff operations from the refinement AI to the canvas.
 * Returns arrays of affected node IDs for highlight animations.
 */
export async function applyDiffOperations(
  reactFlow: ReactFlowInstance,
  operations: DiffOperation[],
  existingNodes: CanvasNode[],
  existingEdges: CanvasEdge[]
): Promise<{
  addedNodeIds: string[];
  modifiedNodeIds: string[];
  removedNodeIds: string[];
}> {
  const addedNodeIds: string[] = [];
  const modifiedNodeIds: string[] = [];
  const removedNodeIds: string[] = [];

  // Build label→node map for lookups
  const labelToNode = new Map<string, CanvasNode>();
  for (const node of existingNodes) {
    labelToNode.set(node.data.label, node);
  }

  // Process operations in order
  for (const op of operations) {
    switch (op.op) {
      case "ADD_NODE": {
        const category = op.node.category as NodeCategory;
        const nodeId = generateNodeId();
        const baseData = createNodeData(category, op.node.label);

        // Find a good position — offset from existing nodes
        const existingPositions = reactFlow.getNodes().map((n) => n.position);
        const maxY = existingPositions.length > 0
          ? Math.max(...existingPositions.map((p) => p.y)) + 200
          : 200;
        const maxX = existingPositions.length > 0
          ? existingPositions.reduce((sum, p) => sum + p.x, 0) / existingPositions.length
          : 400;

        reactFlow.addNodes({
          id: nodeId,
          type: "systemNode",
          position: { x: maxX, y: maxY },
          data: {
            ...baseData,
            description: op.node.description ?? "",
            configTechnology: op.node.configTechnology,
            configPort: op.node.configPort,
            configProtocol: op.node.configProtocol,
            configScaling: op.node.configScaling,
            configDbType: op.node.configDbType,
            configReplication: op.node.configReplication,
            configQueueType: op.node.configQueueType,
            configCacheType: op.node.configCacheType,
            configTtl: op.node.configTtl,
            configAuthMethod: op.node.configAuthMethod,
            configRateLimit: op.node.configRateLimit,
            configRuntime: op.node.configRuntime,
            configMemory: op.node.configMemory,
            configTimeout: op.node.configTimeout,
            configPlatform: op.node.configPlatform,
            configFramework: op.node.configFramework,
            configStorageType: op.node.configStorageType,
          },
        });

        // Register in label map for edge operations
        labelToNode.set(op.node.label, {
          id: nodeId,
          data: baseData,
          position: { x: maxX, y: maxY },
        } as CanvasNode);

        addedNodeIds.push(nodeId);
        break;
      }

      case "REMOVE_NODE": {
        const target = labelToNode.get(op.label);
        if (target) {
          removedNodeIds.push(target.id);
          // Delay actual deletion for fade-out animation
          setTimeout(() => {
            reactFlow.deleteElements({ nodes: [{ id: target.id }] });
          }, 500);
        }
        break;
      }

      case "UPDATE_NODE": {
        const target = labelToNode.get(op.label);
        if (target) {
          const updates: Record<string, unknown> = {};
          if (op.changes.label) updates.label = op.changes.label;
          if (op.changes.description) updates.description = op.changes.description;
          if (op.changes.category) {
            const newData = createNodeData(op.changes.category as NodeCategory, op.changes.label ?? target.data.label);
            Object.assign(updates, newData);
          }
          // Config fields
          for (const key of Object.keys(op.changes) as (keyof typeof op.changes)[]) {
            if (key.startsWith("config") && op.changes[key]) {
              updates[key] = op.changes[key];
            }
          }

          reactFlow.updateNodeData(target.id, updates);
          modifiedNodeIds.push(target.id);
        }
        break;
      }

      case "MOVE_NODE": {
        const target = labelToNode.get(op.label);
        if (target) {
          modifiedNodeIds.push(target.id);
        }
        break;
      }

      case "ADD_EDGE": {
        const src = labelToNode.get(op.edge.sourceLabel);
        const tgt = labelToNode.get(op.edge.targetLabel);
        if (src && tgt) {
          reactFlow.addEdges({
            id: `edge-${src.id}-${tgt.id}-${Date.now()}`,
            source: src.id,
            target: tgt.id,
            type: "custom",
            data: {
              label: op.edge.label ?? "",
              animated: true,
              edgeStyle: "default" as const,
            },
          });
        }
        break;
      }

      case "REMOVE_EDGE": {
        const src = labelToNode.get(op.sourceLabel);
        const tgt = labelToNode.get(op.targetLabel);
        if (src && tgt) {
          const edgeToRemove = existingEdges.find(
            (e) => e.source === src.id && e.target === tgt.id
          );
          if (edgeToRemove) {
            reactFlow.deleteElements({ edges: [{ id: edgeToRemove.id }] });
          }
        }
        break;
      }
    }

    // Small delay between operations for visual effect
    await new Promise((r) => setTimeout(r, 80));
  }

  return { addedNodeIds, modifiedNodeIds, removedNodeIds };
}

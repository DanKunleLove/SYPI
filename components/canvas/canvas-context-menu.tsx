"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Copy,
  Trash2,
  ClipboardPaste,
  CheckSquare,
  Plus,
} from "lucide-react";
import {
  PALETTE_CATEGORIES,
  getNodeConfig,
  createNodeData,
  generateNodeId,
} from "@/lib/canvas-utils";
import type { NodeCategory } from "@/types/canvas";

interface CanvasContextMenuProps {
  open: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  /** If set, the menu was triggered on this node */
  targetNodeId?: string | null;
}

export function CanvasContextMenu({
  open,
  position,
  onClose,
  targetNodeId,
}: CanvasContextMenuProps) {
  const reactFlow = useReactFlow();

  const handleDelete = useCallback(() => {
    if (targetNodeId) {
      reactFlow.deleteElements({ nodes: [{ id: targetNodeId }] });
    }
    onClose();
  }, [targetNodeId, reactFlow, onClose]);

  const handleDuplicate = useCallback(() => {
    if (!targetNodeId) return;
    const node = reactFlow.getNode(targetNodeId);
    if (!node) return;

    const newNode = {
      id: generateNodeId(),
      type: node.type,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      data: { ...node.data },
    };
    reactFlow.addNodes(newNode);
    onClose();
  }, [targetNodeId, reactFlow, onClose]);

  const handleSelectAll = useCallback(() => {
    const nodes = reactFlow.getNodes();
    reactFlow.setNodes(nodes.map((n) => ({ ...n, selected: true })));
    onClose();
  }, [reactFlow, onClose]);

  const handleAddNode = useCallback(
    (category: NodeCategory) => {
      const viewport = reactFlow.getViewport();
      const x = (position.x - viewport.x) / viewport.zoom;
      const y = (position.y - viewport.y) / viewport.zoom;

      const newNode = {
        id: generateNodeId(),
        type: "systemNode",
        position: { x, y },
        data: createNodeData(category),
      };
      reactFlow.addNodes(newNode);
      onClose();
    },
    [reactFlow, position, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed z-50"
      style={{ left: position.x, top: position.y }}
    >
      <DropdownMenu open={open} onOpenChange={(o) => !o && onClose()}>
        <DropdownMenuContent
          align="start"
          className="w-48"
          style={{ position: "fixed", left: position.x, top: position.y }}
        >
          {targetNodeId ? (
            <>
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--state-error)] focus:text-[var(--state-error)]"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Plus className="h-4 w-4" />
                  Add Node
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  {PALETTE_CATEGORIES.map((cat) => {
                    const config = getNodeConfig(cat);
                    const Icon = config.icon;
                    return (
                      <DropdownMenuItem
                        key={cat}
                        onClick={() => handleAddNode(cat)}
                      >
                        <Icon
                          className="h-4 w-4"
                          style={{ color: config.color }}
                        />
                        {config.label}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSelectAll}>
                <CheckSquare className="h-4 w-4" />
                Select All
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

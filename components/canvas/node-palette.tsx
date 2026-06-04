"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { useReactFlow } from "@xyflow/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PALETTE_CATEGORIES, getNodeConfig, createNodeData, generateNodeId } from "@/lib/canvas-utils";
import type { NodeCategory } from "@/types/canvas";

export function NodePalette() {
  const reactFlow = useReactFlow();

  const handleAddNode = useCallback(
    (category: NodeCategory) => {
      const viewport = reactFlow.getViewport();
      // Place node in center of visible viewport
      const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
      const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;

      // Offset slightly randomly so stacking doesn't overlap perfectly
      const offsetX = (Math.random() - 0.5) * 100;
      const offsetY = (Math.random() - 0.5) * 60;

      const newNode = {
        id: generateNodeId(),
        type: "systemNode",
        position: { x: centerX + offsetX, y: centerY + offsetY },
        data: createNodeData(category),
      };

      reactFlow.addNodes(newNode);
    },
    [reactFlow]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, category: NodeCategory) => {
      e.dataTransfer.setData("application/spi-node-type", category);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2, ease: "easeOut" }}
      className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
    >
      <div className="flex items-center gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]/95 px-2 py-1.5 shadow-xl shadow-black/25 backdrop-blur-md">
        {PALETTE_CATEGORIES.map((category) => {
          const config = getNodeConfig(category);
          const Icon = config.icon;
          return (
            <Tooltip key={category}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    draggable
                    aria-label={`Add ${config.label} node`}
                    title={config.label}
                    onDragStart={(e) => handleDragStart(e, category)}
                    onClick={() => handleAddNode(category)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150 hover:bg-[var(--bg-surface-raised)] active:scale-95"
                    style={{ color: config.color }}
                  />
                }
              >
                <Icon style={{ width: 18, height: 18 }} />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{config.label}</p>
                <p className="text-[var(--text-muted)]">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-[var(--border-default)]" />

        {/* Drag hint */}
        <span className="px-1 text-[10px] text-[var(--text-muted)] select-none">
          Click or drag
        </span>
      </div>
    </motion.div>
  );
}

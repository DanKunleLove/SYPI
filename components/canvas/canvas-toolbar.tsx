"use client";

import { useReactFlow } from "@xyflow/react";
import { useHistory, useCanUndo, useCanRedo } from "@liveblocks/react/suspense";
import { motion } from "framer-motion";
import { Undo2, Redo2, Minus, Plus, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CanvasToolbar() {
  const reactFlow = useReactFlow();
  const history = useHistory();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
      className="absolute bottom-4 left-4 z-20"
    >
      <div className="flex items-center gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]/95 p-1 shadow-lg shadow-black/20 backdrop-blur-md">
        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => reactFlow.zoomOut({ duration: 200 })}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
              />
            }
          >
            <Minus className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Zoom out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Fit view"
                onClick={() => reactFlow.fitView({ duration: 300 })}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
              />
            }
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Fit view</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => reactFlow.zoomIn({ duration: 200 })}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
              />
            }
          >
            <Plus className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Zoom in</TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="mx-0.5 h-5 w-px bg-[var(--border-default)]" />

        {/* Undo / Redo */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Undo (Ctrl+Z)"
                disabled={!canUndo}
                onClick={() => history.undo()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none"
              />
            }
          >
            <Undo2 className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Redo (Ctrl+Y)"
                disabled={!canRedo}
                onClick={() => history.redo()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none"
              />
            }
          >
            <Redo2 className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
}

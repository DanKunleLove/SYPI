"use client";

import { useReactFlow } from "@xyflow/react";
import { useLiveblocksFlow } from "@liveblocks/react-flow";
import { useHistory, useCanUndo, useCanRedo } from "@liveblocks/react/suspense";
import { motion } from "framer-motion";
import { Undo2, Redo2, Minus, Plus, Maximize2, LayoutGrid, MessageSquarePlus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CanvasNode, CanvasEdge, NodeCategory } from "@/types/canvas";

const TIER_MAP: Record<NodeCategory, number> = {
  client: 0,
  gateway: 1,
  service: 2,
  compute: 2,
  queue: 3,
  cache: 3,
  database: 4,
  storage: 4,
  custom: 2,
};
const H_GAP = 250;
const V_GAP = 200;

interface CanvasToolbarProps {
  commentMode?: boolean;
  onToggleCommentMode?: () => void;
}

export function CanvasToolbar({ commentMode, onToggleCommentMode }: CanvasToolbarProps) {
  const reactFlow = useReactFlow();
  const { nodes } = useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true });
  const history = useHistory();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  const handleAutoLayout = () => {
    if (nodes.length === 0) return;

    // Group nodes by tier while preserving full node objects (IDs intact)
    const tierGroups = new Map<number, CanvasNode[]>();
    for (const node of nodes) {
      const cat = (node.data.nodeCategory as NodeCategory) || "custom";
      const tier = TIER_MAP[cat] ?? 2;
      const group = tierGroups.get(tier) ?? [];
      group.push(node);
      tierGroups.set(tier, group);
    }

    const sortedTiers = [...tierGroups.keys()].sort((a, b) => a - b);
    let maxWidth = 0;
    for (const [, g] of tierGroups) maxWidth = Math.max(maxWidth, (g.length - 1) * H_GAP);

    const updated: CanvasNode[] = [];
    for (const tier of sortedTiers) {
      const group = tierGroups.get(tier)!;
      const tierWidth = (group.length - 1) * H_GAP;
      const startX = (maxWidth - tierWidth) / 2;
      const y = tier * V_GAP;
      group.forEach((n, i) => updated.push({ ...n, position: { x: startX + i * H_GAP, y } }));
    }

    reactFlow.setNodes(updated);
    setTimeout(() => reactFlow.fitView({ duration: 400, padding: 0.15 }), 60);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1, ease: "easeOut" }}
      className="shrink-0"
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

        {/* Auto-layout */}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Auto-layout (tidy)"
                disabled={nodes.length === 0}
                onClick={handleAutoLayout}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-30"
              />
            }
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Auto-layout</TooltipContent>
        </Tooltip>

        {/* Comment pin mode */}
        {onToggleCommentMode && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Add a comment pin"
                  onClick={onToggleCommentMode}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    commentMode
                      ? "bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
                  }`}
                />
              }
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Comment pin — click the canvas to drop one
            </TooltipContent>
          </Tooltip>
        )}

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

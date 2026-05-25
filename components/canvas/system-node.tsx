"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getNodeConfig, PALETTE_CATEGORIES } from "@/lib/canvas-utils";
import type { CanvasNodeData, NodeCategory } from "@/types/canvas";

function SystemNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as CanvasNodeData;
  const category = nodeData.nodeCategory ?? "custom";
  const config = getNodeConfig(category);
  const Icon = config.icon;
  const isGenerating = nodeData.status === "active";
  const [isHovered, setIsHovered] = useState(false);
  const [editingField, setEditingField] = useState<"label" | "description" | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const reactFlow = useReactFlow();

  useEffect(() => {
    if (editingField === "label" && labelRef.current) {
      labelRef.current.focus();
      labelRef.current.select();
    }
    if (editingField === "description" && descRef.current) {
      descRef.current.focus();
      descRef.current.select();
    }
  }, [editingField]);

  // Persist a data field change to Liveblocks via React Flow
  const updateField = useCallback(
    (field: string, value: string) => {
      reactFlow.updateNodeData(id, { [field]: value });
    },
    [id, reactFlow]
  );

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingField("label");
  }, []);

  const handleDescDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingField("description");
  }, []);

  const handleLabelCommit = useCallback(() => {
    if (labelRef.current) {
      const val = labelRef.current.value.trim();
      if (val && val !== nodeData.label) {
        updateField("label", val);
      }
    }
    setEditingField(null);
  }, [nodeData.label, updateField]);

  const handleDescCommit = useCallback(() => {
    if (descRef.current) {
      const val = descRef.current.value.trim();
      if (val !== (nodeData.description ?? "")) {
        updateField("description", val);
      }
    }
    setEditingField(null);
  }, [nodeData.description, updateField]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, commitFn: () => void) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitFn();
      }
      if (e.key === "Escape") {
        setEditingField(null);
      }
      // Stop propagation to prevent canvas shortcuts
      e.stopPropagation();
    },
    []
  );

  const showHandles = isHovered || selected;
  const accentColor = (nodeData.customColor as string) ?? nodeData.color ?? config.color;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "relative min-w-[150px] max-w-[240px] rounded-lg border bg-[var(--bg-surface)] transition-all duration-150",
        selected
          ? "border-[color:var(--node-color)]"
          : "border-[var(--border-default)] hover:border-[var(--border-subtle)]",
        isGenerating && "animate-pulse"
      )}
      style={{
        "--node-color": accentColor,
        boxShadow: selected
          ? `0 0 0 1px ${accentColor}, 0 4px 20px ${accentColor}20`
          : isHovered
            ? "0 4px 12px rgba(0,0,0,0.3)"
            : "0 2px 4px rgba(0,0,0,0.2)",
      } as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* AI generating indicator */}
      {isGenerating && (
        <div
          className="absolute -inset-px rounded-lg opacity-60"
          style={{
            background: `linear-gradient(135deg, ${accentColor}40, transparent, ${accentColor}40)`,
            animation: "pulse 2s ease-in-out infinite",
          }}
        />
      )}

      {/* Top accent bar */}
      <div
        className="h-1 rounded-t-lg"
        style={{ backgroundColor: accentColor }}
      />

      {/* Content */}
      <div className="px-3 py-2.5">
        {/* Header row: icon + label */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Icon
              className="h-3.5 w-3.5"
              style={{ color: accentColor }}
            />
          </div>

          {editingField === "label" ? (
            <input
              ref={labelRef}
              defaultValue={nodeData.label}
              onBlur={handleLabelCommit}
              onKeyDown={(e) => handleKeyDown(e, handleLabelCommit)}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-transparent text-sm font-medium text-[var(--text-primary)] outline-none border-b border-[var(--accent-primary)]"
            />
          ) : (
            <span
              className="flex-1 truncate text-sm font-medium text-[var(--text-primary)] cursor-text"
              onDoubleClick={handleLabelDoubleClick}
              title="Double-click to edit"
            >
              {nodeData.label}
            </span>
          )}
        </div>

        {/* Description — click to add/edit */}
        {editingField === "description" ? (
          <input
            ref={descRef}
            defaultValue={nodeData.description ?? ""}
            placeholder="Add a description..."
            onBlur={handleDescCommit}
            onKeyDown={(e) => handleKeyDown(e, handleDescCommit)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 w-full bg-transparent text-[11px] text-[var(--text-secondary)] outline-none border-b border-[var(--accent-primary)] placeholder:text-[var(--text-muted)]"
          />
        ) : nodeData.description ? (
          <p
            className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-muted)] cursor-text"
            onDoubleClick={handleDescDoubleClick}
            title="Double-click to edit"
          >
            {nodeData.description}
          </p>
        ) : (
          <p
            className="mt-1.5 text-[11px] text-[var(--text-muted)]/50 cursor-text italic"
            onDoubleClick={handleDescDoubleClick}
          >
            + Add description
          </p>
        )}

        {/* Type badge */}
        <div className="mt-2 flex items-center">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: `${accentColor}15`,
              color: accentColor,
            }}
          >
            {config.label}
          </span>
        </div>
      </div>

      {/* Connection handles with +/- indicators */}
      {/* Top — target (incoming +) */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn(
          "!flex !items-center !justify-center !h-4 !w-4 !rounded-full !border-2 !border-[var(--bg-surface)] transition-all duration-150",
          showHandles ? "!opacity-100" : "!opacity-0"
        )}
        style={{ backgroundColor: accentColor }}
      >
        {showHandles && (
          <span className="text-[8px] font-bold text-white leading-none pointer-events-none select-none">+</span>
        )}
      </Handle>
      {/* Bottom — source (outgoing −) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          "!flex !items-center !justify-center !h-4 !w-4 !rounded-full !border-2 !border-[var(--bg-surface)] transition-all duration-150",
          showHandles ? "!opacity-100" : "!opacity-0"
        )}
        style={{ backgroundColor: accentColor }}
      >
        {showHandles && (
          <span className="text-[8px] font-bold text-white leading-none pointer-events-none select-none">−</span>
        )}
      </Handle>
      {/* Left — target (incoming +) */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={cn(
          "!flex !items-center !justify-center !h-4 !w-4 !rounded-full !border-2 !border-[var(--bg-surface)] transition-all duration-150",
          showHandles ? "!opacity-100" : "!opacity-0"
        )}
        style={{ backgroundColor: accentColor }}
      >
        {showHandles && (
          <span className="text-[8px] font-bold text-white leading-none pointer-events-none select-none">+</span>
        )}
      </Handle>
      {/* Right — source (outgoing −) */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={cn(
          "!flex !items-center !justify-center !h-4 !w-4 !rounded-full !border-2 !border-[var(--bg-surface)] transition-all duration-150",
          showHandles ? "!opacity-100" : "!opacity-0"
        )}
        style={{ backgroundColor: accentColor }}
      >
        {showHandles && (
          <span className="text-[8px] font-bold text-white leading-none pointer-events-none select-none">−</span>
        )}
      </Handle>
    </motion.div>
  );
}

export const SystemNode = memo(SystemNodeComponent);

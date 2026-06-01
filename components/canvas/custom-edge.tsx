"use client";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";

function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const reactFlow = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const label = typeof data?.label === "string" ? data.label : "";

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraft(label);
      setEditing(true);
    },
    [label]
  );

  const commit = useCallback(() => {
    reactFlow.updateEdgeData(id, { label: draft.trim() });
    setEditing(false);
  }, [reactFlow, id, draft]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    reactFlow.deleteElements({ edges: [{ id }] });
  };

  const showCenter = editing || !!label || isHovered || selected;

  return (
    <>
      {/* Invisible wider path for easier hover/click targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDoubleClick={startEditing}
      />

      {/* Visible edge */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected
            ? "var(--accent-primary)"
            : isHovered
              ? "var(--text-muted)"
              : (style?.stroke ?? "var(--border-subtle)"),
          strokeWidth: selected ? 2.5 : 2,
          transition: "stroke 0.15s, stroke-width 0.15s",
        }}
      />

      <EdgeLabelRenderer>
        {/* Label / inline editor at the edge midpoint */}
        {showCenter && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(false);
                  }
                  // Don't let canvas shortcuts (Delete/Backspace) fire while typing
                  e.stopPropagation();
                }}
                placeholder="label…"
                className="w-28 rounded-md border border-[var(--accent-primary)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-center text-[10px] text-[var(--text-primary)] outline-none"
              />
            ) : label ? (
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={startEditing}
                title="Double-click to edit"
                className="max-w-[160px] truncate rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] shadow-sm transition-colors hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]"
              >
                {label}
              </button>
            ) : (
              // No label yet — show an affordance on hover/select
              <button
                type="button"
                onClick={startEditing}
                title="Add a label"
                className="rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-secondary)]"
              >
                + label
              </button>
            )}
          </div>
        )}

        {/* Delete button — offset just above the label, on hover/select */}
        {(isHovered || selected) && !editing && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 22}px)`,
              pointerEvents: "all",
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <button
              type="button"
              onClick={handleDelete}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] shadow-md transition-all hover:scale-110 hover:border-[var(--state-error)] hover:bg-[var(--state-error)] hover:text-white"
              aria-label="Delete connection"
              title="Delete connection"
            >
              <X style={{ width: 10, height: 10 }} />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}

export const CustomEdge = memo(CustomEdgeComponent);

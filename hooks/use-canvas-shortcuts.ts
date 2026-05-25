"use client";

import { useEffect, useCallback, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { useHistory } from "@liveblocks/react/suspense";
import { generateNodeId } from "@/lib/canvas-utils";

export function useCanvasShortcuts() {
  const reactFlow = useReactFlow();
  const history = useHistory();
  const clipboardRef = useRef<Array<{ data: unknown; offset: { x: number; y: number } }>>([]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+Z — undo
      if (isCtrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        history.undo();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y — redo
      if ((isCtrl && e.key === "z" && e.shiftKey) || (isCtrl && e.key === "y")) {
        e.preventDefault();
        history.redo();
        return;
      }

      // Delete / Backspace — delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedNodes = reactFlow.getNodes().filter((n) => n.selected);
        const selectedEdges = reactFlow.getEdges().filter((edge) => edge.selected);
        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          e.preventDefault();
          reactFlow.deleteElements({
            nodes: selectedNodes.map((n) => ({ id: n.id })),
            edges: selectedEdges.map((edge) => ({ id: edge.id })),
          });
        }
      }

      // Ctrl+A — select all
      if (isCtrl && e.key === "a") {
        e.preventDefault();
        const nodes = reactFlow.getNodes();
        reactFlow.setNodes(nodes.map((n) => ({ ...n, selected: true })));
      }

      // Ctrl+D — duplicate selected
      if (isCtrl && e.key === "d") {
        e.preventDefault();
        const selected = reactFlow.getNodes().filter((n) => n.selected);
        const newNodes = selected.map((node) => ({
          id: generateNodeId(),
          type: node.type,
          position: { x: node.position.x + 30, y: node.position.y + 30 },
          data: { ...node.data },
          selected: true,
        }));
        reactFlow.setNodes((nodes) =>
          nodes.map((n) => (n.selected ? { ...n, selected: false } : n))
        );
        reactFlow.addNodes(newNodes);
      }

      // Ctrl+C — copy selected
      if (isCtrl && e.key === "c") {
        const selected = reactFlow.getNodes().filter((n) => n.selected);
        if (selected.length === 0) return;
        e.preventDefault();
        const minX = Math.min(...selected.map((n) => n.position.x));
        const minY = Math.min(...selected.map((n) => n.position.y));
        clipboardRef.current = selected.map((n) => ({
          data: n.data,
          offset: { x: n.position.x - minX, y: n.position.y - minY },
        }));
      }

      // Ctrl+V — paste
      if (isCtrl && e.key === "v") {
        if (clipboardRef.current.length === 0) return;
        e.preventDefault();
        const viewport = reactFlow.getViewport();
        const centerX = (window.innerWidth / 2 - viewport.x) / viewport.zoom;
        const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;

        const newNodes = clipboardRef.current.map((item) => ({
          id: generateNodeId(),
          type: "systemNode",
          position: {
            x: centerX + item.offset.x + 20,
            y: centerY + item.offset.y + 20,
          },
          data: { ...(item.data as object) },
          selected: true,
        }));
        reactFlow.setNodes((nodes) =>
          nodes.map((n) => ({ ...n, selected: false }))
        );
        reactFlow.addNodes(newNodes);
      }

      // Escape — deselect all
      if (e.key === "Escape") {
        reactFlow.setNodes((nodes) =>
          nodes.map((n) => (n.selected ? { ...n, selected: false } : n))
        );
        reactFlow.setEdges((edges) =>
          edges.map((edge) => (edge.selected ? { ...edge, selected: false } : edge))
        );
      }
    },
    [reactFlow, history]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

"use client";

import { useRef, useState, useCallback } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseManualSaveOptions {
  projectId: string;
  getNodes: () => unknown[];
  getEdges: () => unknown[];
}

/**
 * Manual-only save hook. No autosave, no debounce.
 * Save triggers only on explicit user action (Ctrl+S or save button).
 */
export function useCanvasAutosave({
  projectId,
  getNodes,
  getEdges,
}: UseManualSaveOptions) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    const nodes = getNodes();
    const edges = getEdges();

    if (nodes.length === 0 && edges.length === 0) return;

    setStatus("saving");

    try {
      const res = await fetch(`/api/projects/${projectId}/canvas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      });

      if (res.ok) {
        setStatus("saved");
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, [projectId, getNodes, getEdges]);

  return { status, save };
}

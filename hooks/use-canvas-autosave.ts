"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseCanvasAutosaveOptions {
  projectId: string;
  nodes: unknown[];
  edges: unknown[];
  /** Debounce delay in ms (default 3000) */
  debounceMs?: number;
}

export function useCanvasAutosave({
  projectId,
  nodes,
  edges,
  debounceMs = 3000,
}: UseCanvasAutosaveOptions) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const save = useCallback(async () => {
    const snapshot = JSON.stringify({ nodes, edges });

    // Skip if nothing changed since last save
    if (snapshot === lastSavedRef.current) return;
    // Skip if canvas is empty
    if (nodes.length === 0 && edges.length === 0) return;

    setStatus("saving");

    try {
      const res = await fetch(`/api/projects/${projectId}/canvas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: snapshot,
      });

      if (!isMountedRef.current) return;

      if (res.ok) {
        lastSavedRef.current = snapshot;
        setStatus("saved");
        // Reset to idle after 2s
        setTimeout(() => {
          if (isMountedRef.current) setStatus("idle");
        }, 2000);
      } else {
        setStatus("error");
      }
    } catch {
      if (isMountedRef.current) setStatus("error");
    }
  }, [projectId, nodes, edges]);

  // Debounced autosave on canvas changes
  useEffect(() => {
    // Don't save empty canvases or during initial load
    if (nodes.length === 0 && edges.length === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, edges, save, debounceMs]);

  return { status, save };
}

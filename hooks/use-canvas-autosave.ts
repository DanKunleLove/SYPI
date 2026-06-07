"use client";

import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseManualSaveOptions {
  projectId: string;
  getNodes: () => unknown[];
  getEdges: () => unknown[];
}

async function captureThumbnail(projectId: string): Promise<void> {
  try {
    const { toPng } = await import("html-to-image");
    const container = document.querySelector<HTMLElement>(".react-flow");
    if (!container) return;

    const bg =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--bg-base")
        .trim() || "#0a0f1a";

    const dataUrl = await toPng(container, {
      backgroundColor: bg,
      width: 800,
      height: 450,
      style: { width: "800px", height: "450px" },
      pixelRatio: 1,
      skipFonts: false,
    });

    // Fire-and-forget upload — never blocks save
    fetch(`/api/projects/${projectId}/thumbnail`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    }).catch(() => {});
  } catch {
    // Best-effort — thumbnail failure never surfaces to the user
  }
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
        // Capture thumbnail in background after successful save
        captureThumbnail(projectId);
      } else {
        setStatus("error");
        const message = await res
          .json()
          .then((d) => d?.error)
          .catch(() => null);
        toast.error("Couldn't save canvas", {
          description: message ?? `Server returned ${res.status}.`,
        });
      }
    } catch (err) {
      setStatus("error");
      toast.error("Couldn't save canvas", {
        description:
          err instanceof Error ? err.message : "Network error — check your connection.",
      });
    }
  }, [projectId, getNodes, getEdges]);

  return { status, save };
}

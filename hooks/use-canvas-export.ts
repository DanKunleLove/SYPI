"use client";

import { useCallback, useState } from "react";
import { getNodesBounds, getViewportForBounds, useReactFlow } from "@xyflow/react";
import type { CanvasNode } from "@/types/canvas";

const IMAGE_WIDTH = 2400;
const IMAGE_HEIGHT = 1350; // 16:9

export function useCanvasExport(projectName: string) {
  const reactFlow = useReactFlow();
  const [exporting, setExporting] = useState(false);

  const exportPng = useCallback(async () => {
    if (exporting) return;

    const nodes = reactFlow.getNodes() as CanvasNode[];
    if (nodes.length === 0) return;

    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");

      // Identify elements
      const container = document.querySelector<HTMLElement>(".react-flow");
      const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
      if (!container || !viewport) return;

      // Compute a transform that fits all nodes into the export frame
      const bounds = getNodesBounds(nodes);
      const { x, y, zoom } = getViewportForBounds(
        bounds,
        IMAGE_WIDTH,
        IMAGE_HEIGHT,
        0.5,
        2,
        80 // padding px
      );

      // Temporarily override the viewport transform
      const originalTransform = viewport.style.transform;
      viewport.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;

      try {
        const dataUrl = await toPng(container, {
          backgroundColor: "#09090b",
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
          style: {
            width: `${IMAGE_WIDTH}px`,
            height: `${IMAGE_HEIGHT}px`,
          },
          // Prevent html-to-image from trying to fetch external resources
          skipFonts: false,
          pixelRatio: 1,
        });

        const safe =
          (projectName || "architecture").replace(/[^a-z0-9]+/gi, "-").toLowerCase() ||
          "architecture";
        const a = document.createElement("a");
        a.download = `${safe}-architecture.png`;
        a.href = dataUrl;
        a.click();
      } finally {
        viewport.style.transform = originalTransform;
      }
    } catch {
      // Export failed silently — user retains their canvas state
    } finally {
      setExporting(false);
    }
  }, [reactFlow, projectName, exporting]);

  return { exportPng, exporting };
}

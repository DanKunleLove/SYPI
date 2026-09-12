import { UssGraph } from "@/lib/uss/graph";
import type { DiffOperation } from "@/lib/ai/schemas";
import type { Uss } from "@/lib/uss/schema";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

/**
 * USS → canvas.
 *
 * Emits DiffOperation[] for the EXISTING applyDiffOperations engine
 * (lib/ai/canvas-diff.ts) rather than mutating the canvas directly. That matters:
 * diffs go through React Flow, so Liveblocks sync, presence and single-step
 * Ctrl+Z all keep working with no changes to any of them.
 *
 * REGRESSION TRAP, stated because it is easy to get wrong: re-derivation must go
 * through applyDiffOperations, NOT useGeneration.placeArchitectureOnCanvas. The
 * latter stagger-adds fresh nodes with new ids and calls fitView — running it on
 * an existing canvas duplicates every node.
 */

export function diffUssToCanvas(
  doc: Uss,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): DiffOperation[] {
  const g = new UssGraph(doc);
  const ops: DiffOperation[] = [];

  const components = g.byKind("component").filter((c) => !c.orphaned);
  const nodeByLabel = new Map(
    nodes.map((n) => [String(n.data?.label ?? "").trim().toLowerCase(), n])
  );
  const labelById = new Map(components.map((c) => [c.id, c.title]));

  // ── Components missing from the canvas ─────────────────────────────────────
  for (const c of components) {
    const existing = nodeByLabel.get(c.title.trim().toLowerCase());
    if (!existing) {
      ops.push({
        op: "ADD_NODE",
        node: {
          label: c.title,
          category: c.category,
          description: c.responsibility || undefined,
          ...(c.technology ? { configTechnology: c.technology } : {}),
        },
      });
      continue;
    }
    // Present but stale.
    const staleCategory = existing.data?.nodeCategory !== c.category;
    const staleDescription =
      c.responsibility && existing.data?.description !== c.responsibility;
    if (staleCategory || staleDescription) {
      ops.push({
        op: "UPDATE_NODE",
        label: c.title,
        changes: {
          ...(staleCategory ? { category: c.category } : {}),
          ...(staleDescription ? { description: c.responsibility } : {}),
        },
      });
    }
  }

  // ── Dependencies missing from the canvas ───────────────────────────────────
  const edgeKeys = new Set(
    edges.map((e) => {
      const s = nodes.find((n) => n.id === e.source);
      const t = nodes.find((n) => n.id === e.target);
      return `${String(s?.data?.label ?? "").trim().toLowerCase()}>${String(
        t?.data?.label ?? ""
      ).trim().toLowerCase()}`;
    })
  );

  for (const r of g.relations().filter((x) => x.type === "dependsOn")) {
    const from = labelById.get(r.from);
    const to = labelById.get(r.to);
    if (!from || !to) continue;
    if (edgeKeys.has(`${from.toLowerCase()}>${to.toLowerCase()}`)) continue;
    ops.push({
      op: "ADD_EDGE",
      edge: { sourceLabel: from, targetLabel: to, label: r.note || undefined },
    });
  }

  return ops;
}

/**
 * Would applying the spec change the canvas? Used to decide whether answering a
 * decision should trigger a re-derivation at all — if nothing would move, do not
 * spend a model call or disturb the user's layout.
 */
export function specDiffersFromCanvas(
  doc: Uss,
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): boolean {
  return diffUssToCanvas(doc, nodes, edges).length > 0;
}

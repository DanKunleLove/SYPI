import type { CanvasNode, CanvasEdge } from "@/types/canvas";

/**
 * Serialize canvas state into a compact text format for AI context.
 * Keeps it under ~3000 tokens for most canvases.
 */
export function serializeCanvasForAI(
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): string {
  if (nodes.length === 0) return "Canvas is empty.";

  const lines: string[] = ["CURRENT CANVAS STATE:", ""];

  // Nodes section
  lines.push("NODES:");
  for (const node of nodes) {
    const d = node.data;
    const category = d.nodeCategory ?? "custom";
    const parts: string[] = [`[${node.id}] ${category}: "${d.label}"`];

    // Add relevant config details
    const configParts: string[] = [];
    if (d.configTechnology) configParts.push(d.configTechnology);
    if (d.configDbType) configParts.push(d.configDbType);
    if (d.configQueueType) configParts.push(d.configQueueType);
    if (d.configCacheType) configParts.push(d.configCacheType);
    if (d.configStorageType) configParts.push(d.configStorageType);
    if (d.configFramework) configParts.push(d.configFramework);
    if (d.configRuntime) configParts.push(d.configRuntime);
    if (d.configProtocol) configParts.push(d.configProtocol);
    if (d.configPort) configParts.push(`port ${d.configPort}`);
    if (d.configPlatform) configParts.push(d.configPlatform);

    if (configParts.length > 0) {
      parts.push(`(${configParts.join(", ")})`);
    }

    if (d.description) {
      parts.push(`— ${d.description}`);
    }

    lines.push(`  ${parts.join(" ")}`);
  }

  // Edges section
  if (edges.length > 0) {
    lines.push("");
    lines.push("CONNECTIONS:");

    const nodeIdToLabel = new Map(
      nodes.map((n) => [n.id, n.data.label])
    );

    for (const edge of edges) {
      const src = nodeIdToLabel.get(edge.source) ?? edge.source;
      const tgt = nodeIdToLabel.get(edge.target) ?? edge.target;
      const label = edge.data?.label ? ` "${edge.data.label}"` : "";
      lines.push(`  ${src} → ${tgt}${label}`);
    }
  }

  return lines.join("\n");
}

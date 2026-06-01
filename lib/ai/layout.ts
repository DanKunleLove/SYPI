import type { NodeCategory } from "@/types/canvas";

interface LayoutNode {
  label: string;
  category: NodeCategory;
}

interface PositionedNode extends LayoutNode {
  position: { x: number; y: number };
}

/** Category → vertical tier (0 = top, 4 = bottom) */
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

const HORIZONTAL_GAP = 250;
const VERTICAL_GAP = 200;

/**
 * Auto-layout nodes in hierarchical tiers.
 * Returns nodes with position.x and position.y assigned.
 */
export function autoLayout(nodes: LayoutNode[]): PositionedNode[] {
  // Group nodes by tier
  const tierGroups = new Map<number, LayoutNode[]>();
  for (const node of nodes) {
    const tier = TIER_MAP[node.category] ?? 2;
    const group = tierGroups.get(tier) ?? [];
    group.push(node);
    tierGroups.set(tier, group);
  }

  // Get sorted tiers
  const sortedTiers = [...tierGroups.keys()].sort((a, b) => a - b);

  // Find the max width to center all tiers
  let maxTierWidth = 0;
  for (const [, group] of tierGroups) {
    const width = (group.length - 1) * HORIZONTAL_GAP;
    if (width > maxTierWidth) maxTierWidth = width;
  }

  const result: PositionedNode[] = [];

  for (const tier of sortedTiers) {
    const group = tierGroups.get(tier)!;
    const tierWidth = (group.length - 1) * HORIZONTAL_GAP;
    const startX = (maxTierWidth - tierWidth) / 2;
    const y = tier * VERTICAL_GAP;

    for (let i = 0; i < group.length; i++) {
      result.push({
        ...group[i],
        position: {
          x: startX + i * HORIZONTAL_GAP,
          y,
        },
      });
    }
  }

  return result;
}

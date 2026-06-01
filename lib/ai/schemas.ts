import { z } from "zod";

// --- Node categories (must match types/canvas.ts) ---

export const nodeCategoryEnum = z.enum([
  "service",
  "database",
  "queue",
  "gateway",
  "client",
  "cache",
  "storage",
  "compute",
  "custom",
]);

// --- Architecture generation output ---

export const ArchitectureNodeSchema = z.object({
  label: z.string().describe("Short name for this component, e.g. 'Auth Service', 'Users DB'"),
  category: nodeCategoryEnum.describe("The type of component"),
  description: z.string().optional().describe("Brief description of what this component does"),
  // Config fields — all optional, AI fills what's relevant
  configTechnology: z.string().optional(),
  configPort: z.string().optional(),
  configProtocol: z.string().optional(),
  configScaling: z.string().optional(),
  configDbType: z.string().optional(),
  configReplication: z.string().optional(),
  configQueueType: z.string().optional(),
  configCacheType: z.string().optional(),
  configTtl: z.string().optional(),
  configAuthMethod: z.string().optional(),
  configRateLimit: z.string().optional(),
  configRuntime: z.string().optional(),
  configMemory: z.string().optional(),
  configTimeout: z.string().optional(),
  configPlatform: z.string().optional(),
  configFramework: z.string().optional(),
  configStorageType: z.string().optional(),
});

export const ArchitectureEdgeSchema = z.object({
  sourceLabel: z.string().describe("Label of the source node (must match a node label exactly)"),
  targetLabel: z.string().describe("Label of the target node (must match a node label exactly)"),
  label: z.string().optional().describe("Short label for the action/data on this connection, e.g. 'HTTP/REST', 'reads/writes', 'publishes OrderCreated'. Strongly preferred on every edge."),
});

export const ArchitectureOutputSchema = z.object({
  reasoning: z.string().describe("Brief explanation of the architecture decisions made"),
  nodes: z.array(ArchitectureNodeSchema).min(1).describe("List of architecture components"),
  edges: z.array(ArchitectureEdgeSchema).describe("Connections between components"),
});

export type ArchitectureOutput = z.infer<typeof ArchitectureOutputSchema>;
export type ArchitectureNode = z.infer<typeof ArchitectureNodeSchema>;
export type ArchitectureEdge = z.infer<typeof ArchitectureEdgeSchema>;

// --- Diff operations (P4.2 iterative refinement) ---

export const DiffOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("ADD_NODE"),
    node: ArchitectureNodeSchema,
  }),
  z.object({
    op: z.literal("REMOVE_NODE"),
    label: z.string().describe("Label of the node to remove"),
  }),
  z.object({
    op: z.literal("UPDATE_NODE"),
    label: z.string().describe("Label of the node to update"),
    changes: ArchitectureNodeSchema.partial().describe("Fields to update"),
  }),
  z.object({
    op: z.literal("MOVE_NODE"),
    label: z.string().describe("Label of the node to reposition"),
    tier: nodeCategoryEnum.optional().describe("New logical tier for layout"),
  }),
  z.object({
    op: z.literal("ADD_EDGE"),
    edge: ArchitectureEdgeSchema,
  }),
  z.object({
    op: z.literal("REMOVE_EDGE"),
    sourceLabel: z.string(),
    targetLabel: z.string(),
  }),
]);

export const RefinementOutputSchema = z.object({
  reasoning: z.string().describe("Explanation of what changed and why"),
  operations: z.array(DiffOperationSchema).min(1).describe("Ordered list of canvas modifications"),
});

export type DiffOperation = z.infer<typeof DiffOperationSchema>;
export type RefinementOutput = z.infer<typeof RefinementOutputSchema>;

// --- Critique output (P4.1) ---

export const critiqueSeverityEnum = z.enum(["critical", "warning", "suggestion"]);

export const CritiqueIssueSchema = z.object({
  severity: critiqueSeverityEnum,
  title: z.string().describe("Short issue title"),
  description: z.string().describe("What's wrong and why it matters"),
  affectedNodes: z.array(z.string()).describe("Labels of affected nodes"),
  suggestion: z.string().describe("Specific, actionable fix — not generic advice"),
  category: z.enum([
    "reliability",
    "scalability",
    "security",
    "completeness",
    "best-practices",
  ]),
});

export const CritiqueOutputSchema = z.object({
  summary: z.string().describe("One-line overall assessment"),
  issues: z.array(CritiqueIssueSchema),
});

export type CritiqueIssue = z.infer<typeof CritiqueIssueSchema>;
export type CritiqueOutput = z.infer<typeof CritiqueOutputSchema>;

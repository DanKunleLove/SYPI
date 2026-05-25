import {
  Server,
  Database,
  ListOrdered,
  Zap,
  Shield,
  Monitor,
  HardDrive,
  Code,
  GitBranch,
  Globe,
} from "lucide-react";
import type { NodeCategory } from "@/types/canvas";

export interface NodeTypeConfig {
  label: string;
  icon: typeof Server;
  color: string;
  description: string;
}

export const NODE_TYPE_CONFIG: Record<NodeCategory, NodeTypeConfig> = {
  service: {
    label: "Service",
    icon: Server,
    color: "#6366f1",
    description: "Backend service or microservice",
  },
  database: {
    label: "Database",
    icon: Database,
    color: "#22c55e",
    description: "SQL or NoSQL database",
  },
  queue: {
    label: "Queue",
    icon: ListOrdered,
    color: "#eab308",
    description: "Message queue or event bus",
  },
  cache: {
    label: "Cache",
    icon: Zap,
    color: "#f97316",
    description: "In-memory cache layer",
  },
  gateway: {
    label: "Gateway",
    icon: Shield,
    color: "#8b5cf6",
    description: "API gateway or reverse proxy",
  },
  client: {
    label: "Client",
    icon: Monitor,
    color: "#0ea5e9",
    description: "Web, mobile, or desktop client",
  },
  storage: {
    label: "Storage",
    icon: HardDrive,
    color: "#14b8a6",
    description: "File or object storage",
  },
  compute: {
    label: "Function",
    icon: Code,
    color: "#ec4899",
    description: "Serverless function or worker",
  },
  custom: {
    label: "Custom",
    icon: GitBranch,
    color: "#a1a1aa",
    description: "Custom component",
  },
};

/** All node categories available in the palette */
export const PALETTE_CATEGORIES: NodeCategory[] = [
  "service",
  "database",
  "queue",
  "cache",
  "gateway",
  "client",
  "storage",
  "compute",
  "custom",
];

/** Color palette for node color picker */
export const NODE_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // amber
  "#22c55e", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#a1a1aa", // zinc
] as const;

/** Per-category config field definitions */
export interface ConfigField {
  key: string;
  label: string;
  type: "text" | "select";
  placeholder?: string;
  options?: string[];
}

export const CATEGORY_CONFIG_FIELDS: Record<NodeCategory, ConfigField[]> = {
  service: [
    { key: "configTechnology", label: "Technology", type: "select", options: ["Node.js", "Python", "Go", "Java", "Rust", "C#", "Ruby", "PHP", "Elixir", "Other"] },
    { key: "configPort", label: "Port", type: "text", placeholder: "e.g. 3001" },
    { key: "configProtocol", label: "Protocol", type: "select", options: ["REST", "gRPC", "GraphQL", "WebSocket", "SOAP", "Other"] },
    { key: "configScaling", label: "Scaling", type: "select", options: ["Horizontal", "Vertical", "Auto", "None"] },
  ],
  database: [
    { key: "configDbType", label: "Database Type", type: "select", options: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "DynamoDB", "Cassandra", "SQLite", "Firestore", "Other"] },
    { key: "configReplication", label: "Replication", type: "select", options: ["Primary", "Replica", "Cluster", "None"] },
    { key: "configPort", label: "Port", type: "text", placeholder: "e.g. 5432" },
  ],
  queue: [
    { key: "configQueueType", label: "Queue Type", type: "select", options: ["Kafka", "RabbitMQ", "Amazon SQS", "Redis Pub/Sub", "NATS", "Google Pub/Sub", "Other"] },
    { key: "configProtocol", label: "Protocol", type: "select", options: ["AMQP", "MQTT", "STOMP", "Custom"] },
  ],
  cache: [
    { key: "configCacheType", label: "Cache Type", type: "select", options: ["Redis", "Memcached", "Varnish", "CDN Edge", "In-Memory", "Other"] },
    { key: "configTtl", label: "Default TTL", type: "text", placeholder: "e.g. 5m, 1h, 24h" },
  ],
  gateway: [
    { key: "configAuthMethod", label: "Auth Method", type: "select", options: ["JWT", "OAuth2", "API Key", "Basic Auth", "mTLS", "None"] },
    { key: "configRateLimit", label: "Rate Limit", type: "text", placeholder: "e.g. 100/min" },
    { key: "configProtocol", label: "Protocol", type: "select", options: ["REST", "gRPC", "GraphQL", "WebSocket"] },
  ],
  client: [
    { key: "configPlatform", label: "Platform", type: "select", options: ["Web", "iOS", "Android", "Desktop", "CLI", "IoT", "Other"] },
    { key: "configFramework", label: "Framework", type: "select", options: ["React", "Next.js", "Vue", "Angular", "Svelte", "Flutter", "React Native", "Swift", "Kotlin", "Other"] },
  ],
  storage: [
    { key: "configStorageType", label: "Storage Type", type: "select", options: ["AWS S3", "Google Cloud Storage", "Azure Blob", "MinIO", "Local Disk", "Other"] },
  ],
  compute: [
    { key: "configRuntime", label: "Runtime", type: "select", options: ["Node.js", "Python", "Go", "Java", "Rust", ".NET", "Ruby", "Other"] },
    { key: "configMemory", label: "Memory", type: "text", placeholder: "e.g. 128MB, 1GB" },
    { key: "configTimeout", label: "Timeout", type: "text", placeholder: "e.g. 30s, 5m" },
  ],
  custom: [
    { key: "configTechnology", label: "Technology", type: "text", placeholder: "e.g. Nginx, Terraform" },
  ],
};

/** Get config for a node category */
export function getNodeConfig(category: NodeCategory): NodeTypeConfig {
  return NODE_TYPE_CONFIG[category] ?? NODE_TYPE_CONFIG.custom;
}

/** Create a new node data object */
export function createNodeData(
  category: NodeCategory,
  label?: string
) {
  const config = getNodeConfig(category);
  const shape =
    category === "database"
      ? "cylinder" as const
      : category === "gateway"
        ? "diamond" as const
        : "rounded" as const;
  return {
    label: label ?? config.label,
    color: config.color,
    shape,
    nodeCategory: category,
    description: "",
    status: "idle" as const,
  };
}

let nodeIdCounter = 0;

/** Generate a unique node ID */
export function generateNodeId(): string {
  nodeIdCounter++;
  return `node-${Date.now()}-${nodeIdCounter}`;
}

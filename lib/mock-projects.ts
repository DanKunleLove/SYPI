export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  nodeCount: number;
  lastEdited: Date;
  color: string;
  template: TemplateId;
}

export const PROJECT_COLORS = [
  "#1d4ed8", // royal blue
  "#2563eb", // blue
  "#0891b2", // cyan
  "#0ea5e9", // sky
  "#16a34a", // green
  "#93c5fd", // powder blue
] as const;

export const TEMPLATES = [
  { id: "blank", label: "Blank", icon: "FileText" },
  { id: "microservices", label: "Microservices", icon: "Boxes" },
  { id: "serverless", label: "Serverless", icon: "Cloud" },
  { id: "event-driven", label: "Event-Driven", icon: "Zap" },
  { id: "api-gateway", label: "API Gateway", icon: "Globe" },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const MOCK_PROJECTS: Project[] = [
  {
    id: "proj_1",
    name: "E-Commerce Platform",
    slug: "e-commerce-platform",
    description: "Full-stack marketplace with payment processing",
    nodeCount: 12,
    lastEdited: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
    color: PROJECT_COLORS[0],
    template: "microservices",
  },
  {
    id: "proj_2",
    name: "Payment Gateway",
    slug: "payment-gateway",
    description: "Stripe-based payment processing service",
    nodeCount: 8,
    lastEdited: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    color: PROJECT_COLORS[1],
    template: "api-gateway",
  },
  {
    id: "proj_3",
    name: "Real-Time Chat System",
    slug: "real-time-chat-system",
    description: "WebSocket-based messaging with presence",
    nodeCount: 15,
    lastEdited: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    color: PROJECT_COLORS[2],
    template: "event-driven",
  },
  {
    id: "proj_4",
    name: "IoT Data Pipeline",
    slug: "iot-data-pipeline",
    description: "Serverless ingestion and analytics pipeline",
    nodeCount: 6,
    lastEdited: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    color: PROJECT_COLORS[3],
    template: "serverless",
  },
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

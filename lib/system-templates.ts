/**
 * Pre-built system architecture templates.
 * Each template produces ready-to-use canvas data (nodes + edges)
 * that gets saved to Vercel Blob when a project is created from it.
 */

export interface TemplateNode {
  id: string;
  type: "systemNode";
  position: { x: number; y: number };
  data: {
    label: string;
    category: string;
    description?: string;
    config?: Record<string, string>;
  };
}

export interface TemplateEdge {
  id: string;
  source: string;
  target: string;
  type: "customEdge";
  animated: boolean;
  data?: { label?: string };
  markerEnd?: { type: string };
}

export interface TemplateCanvas {
  nodes: TemplateNode[];
  edges: TemplateEdge[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function node(
  id: string,
  label: string,
  category: string,
  x: number,
  y: number,
  description?: string,
  config?: Record<string, string>
): TemplateNode {
  return {
    id,
    type: "systemNode",
    position: { x, y },
    data: { label, category, description, config },
  };
}

function edge(id: string, src: string, tgt: string, label?: string): TemplateEdge {
  return {
    id,
    source: src,
    target: tgt,
    type: "customEdge",
    animated: true,
    data: label ? { label } : {},
    markerEnd: { type: "arrowclosed" },
  };
}

// ─── Template: Microservices ───────────────────────────────────────────────

const MICROSERVICES: TemplateCanvas = {
  nodes: [
    node("n1", "Web Client",       "client",   300,  50,  "Browser or mobile app",          { Technology: "React / Next.js" }),
    node("n2", "Mobile App",       "client",   600,  50,  "iOS/Android application",        { Technology: "React Native" }),
    node("n3", "API Gateway",      "gateway",  450, 250,  "Single entry point for clients", { Technology: "Kong / NGINX", Port: "443" }),
    node("n4", "Auth Service",     "service",  150, 450,  "JWT issuing & verification",     { Technology: "Node.js", Port: "3001" }),
    node("n5", "User Service",     "service",  400, 450,  "User CRUD & profile",            { Technology: "Node.js", Port: "3002" }),
    node("n6", "Order Service",    "service",  650, 450,  "Order lifecycle management",     { Technology: "Node.js", Port: "3003" }),
    node("n7", "Redis Cache",      "cache",    150, 650,  "Session tokens & rate limits",   { Technology: "Redis 7", Port: "6379" }),
    node("n8", "Message Queue",    "queue",    650, 650,  "Async event bus",                { Technology: "RabbitMQ", Protocol: "AMQP" }),
    node("n9", "Users DB",         "database", 400, 850,  "Primary user data store",        { Technology: "PostgreSQL 16", "DB Type": "Relational" }),
    node("na", "Orders DB",        "database", 700, 850,  "Order & payment records",        { Technology: "PostgreSQL 16", "DB Type": "Relational" }),
    node("nb", "Notification Svc", "service",  900, 650,  "Email, SMS, push notifications", { Technology: "Node.js", Port: "3004" }),
  ],
  edges: [
    edge("e1",  "n1", "n3", "HTTPS request"),
    edge("e2",  "n2", "n3", "HTTPS request"),
    edge("e3",  "n3", "n4", "Auth check"),
    edge("e4",  "n3", "n5", "User ops"),
    edge("e5",  "n3", "n6", "Order ops"),
    edge("e6",  "n4", "n7", "Cache session"),
    edge("e7",  "n5", "n9", "Read/write"),
    edge("e8",  "n6", "na", "Read/write"),
    edge("e9",  "n6", "n8", "Publish event"),
    edge("e10", "n8", "nb", "Notify user"),
  ],
};

// ─── Template: Serverless ──────────────────────────────────────────────────

const SERVERLESS: TemplateCanvas = {
  nodes: [
    node("n1", "Browser / CDN",    "client",   400,  50,  "Static assets served from CDN",   { Technology: "CloudFront / Vercel" }),
    node("n2", "API Gateway",      "gateway",  400, 250,  "HTTP → Lambda router",             { Technology: "AWS API Gateway v2", Port: "443" }),
    node("n3", "Auth Lambda",      "compute",  100, 450,  "Token validation & user context",  { Technology: "Node.js 20", Scaling: "Auto" }),
    node("n4", "Business Lambda",  "compute",  400, 450,  "Core domain logic",                { Technology: "Node.js 20", Scaling: "Auto" }),
    node("n5", "Processor Lambda", "compute",  700, 450,  "Async background processing",      { Technology: "Node.js 20", Scaling: "Auto" }),
    node("n6", "DynamoDB",         "database", 250, 650,  "Primary NoSQL data store",         { Technology: "DynamoDB", "DB Type": "Document" }),
    node("n7", "S3 Bucket",        "storage",  600, 650,  "File & media storage",             { Technology: "AWS S3" }),
    node("n8", "SQS Queue",        "queue",    700, 250,  "Dead-letter & retry queue",        { Technology: "AWS SQS", Protocol: "HTTPS" }),
  ],
  edges: [
    edge("e1", "n1", "n2", "API call"),
    edge("e2", "n2", "n3", "Auth request"),
    edge("e3", "n2", "n4", "Route request"),
    edge("e4", "n4", "n6", "Read/write"),
    edge("e5", "n4", "n7", "File upload"),
    edge("e6", "n4", "n8", "Queue job"),
    edge("e7", "n8", "n5", "Trigger lambda"),
    edge("e8", "n5", "n6", "Persist result"),
  ],
};

// ─── Template: Event-Driven ────────────────────────────────────────────────

const EVENT_DRIVEN: TemplateCanvas = {
  nodes: [
    node("n1", "Web Client",      "client",   450,  50,  "Initiates commands",          { Technology: "React" }),
    node("n2", "API Gateway",     "gateway",  450, 250,  "Command & query entry point", { Technology: "Express / Fastify", Port: "443" }),
    node("n3", "Command Service", "service",  200, 450,  "Writes & domain logic",       { Technology: "Node.js" }),
    node("n4", "Query Service",   "service",  700, 450,  "Read-optimised queries",      { Technology: "Node.js" }),
    node("n5", "Event Bus",       "queue",    450, 450,  "Central event broker",        { Technology: "Apache Kafka", Protocol: "TCP" }),
    node("n6", "Write DB",        "database", 200, 650,  "Source of truth",             { Technology: "PostgreSQL 16", "DB Type": "Relational" }),
    node("n7", "Read DB",         "database", 700, 650,  "Denormalised read model",     { Technology: "MongoDB", "DB Type": "Document" }),
    node("n8", "Notification Svc","service",  800, 250,  "Webhooks & push alerts",      { Technology: "Node.js" }),
    node("n9", "Dead-Letter Q",   "queue",    450, 650,  "Failed event retry",          { Technology: "Kafka DLQ", Protocol: "TCP" }),
  ],
  edges: [
    edge("e1", "n1", "n2", "HTTP command"),
    edge("e2", "n2", "n3", "Dispatch command"),
    edge("e3", "n2", "n4", "Run query"),
    edge("e4", "n3", "n5", "Publish event"),
    edge("e5", "n3", "n6", "Persist state"),
    edge("e6", "n5", "n4", "Project event"),
    edge("e7", "n4", "n7", "Update read model"),
    edge("e8", "n5", "n8", "Trigger notification"),
    edge("e9", "n5", "n9", "Route failed events"),
  ],
};

// ─── Template: API Gateway Pattern ────────────────────────────────────────

const API_GATEWAY: TemplateCanvas = {
  nodes: [
    node("n1", "Web App",          "client",   200,  50,  "Primary frontend",                   { Technology: "Next.js" }),
    node("n2", "Mobile App",       "client",   500,  50,  "Mobile client",                      { Technology: "React Native" }),
    node("n3", "Third-party App",  "client",   800,  50,  "External API consumer",              { Technology: "REST / GraphQL" }),
    node("n4", "API Gateway",      "gateway",  500, 250,  "Auth, rate-limiting, routing",       { Technology: "Kong / NGINX", Port: "443" }),
    node("n5", "Auth Service",     "service",  200, 450,  "OAuth2 / JWT issuance",              { Technology: "Node.js", Port: "3001" }),
    node("n6", "Core API",         "service",  500, 450,  "Main business logic",                { Technology: "Node.js", Port: "3002" }),
    node("n7", "Analytics Service","service",  800, 450,  "Usage tracking & reporting",         { Technology: "Python", Port: "3003" }),
    node("n8", "Redis",            "cache",    200, 650,  "Token cache & rate-limit counters",  { Technology: "Redis 7", Port: "6379" }),
    node("n9", "Primary DB",       "database", 500, 650,  "Transactional data",                 { Technology: "PostgreSQL 16", "DB Type": "Relational" }),
    node("na", "Analytics DB",     "database", 800, 650,  "Time-series event data",             { Technology: "ClickHouse", "DB Type": "Columnar" }),
  ],
  edges: [
    edge("e1", "n1", "n4", "REST"),
    edge("e2", "n2", "n4", "REST"),
    edge("e3", "n3", "n4", "REST"),
    edge("e4", "n4", "n5", "Verify token"),
    edge("e5", "n4", "n6", "Route request"),
    edge("e6", "n4", "n7", "Log request"),
    edge("e7", "n5", "n8", "Cache token"),
    edge("e8", "n6", "n9", "Query/write"),
    edge("e9", "n7", "na", "Write event"),
  ],
};

// ─── Registry ──────────────────────────────────────────────────────────────

export const SYSTEM_TEMPLATES: Record<string, TemplateCanvas | null> = {
  blank: null,
  microservices: MICROSERVICES,
  serverless: SERVERLESS,
  "event-driven": EVENT_DRIVEN,
  "api-gateway": API_GATEWAY,
};

export function getSystemTemplate(id: string): TemplateCanvas | null {
  return SYSTEM_TEMPLATES[id] ?? null;
}

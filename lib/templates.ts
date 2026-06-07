import type { SpiSchema } from "@/lib/export";

export interface SystemTemplate {
  id: string;
  name: string;
  description: string;
  category: "web" | "data" | "infra" | "mobile";
  schema: SpiSchema;
}

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    id: "saas-webapp",
    name: "SaaS Web App",
    description: "Full-stack web app with auth, API, database, and CDN",
    category: "web",
    schema: {
      version: "1",
      meta: { projectName: "SaaS Web App", exportedAt: "2026-06-04", exportedBy: "SYPI" },
      nodes: [
        { id: "t1-client", type: "systemNode", position: { x: 400, y: 0 }, data: { nodeCategory: "client", label: "Web Browser", description: "Next.js / React SPA", configPlatform: "Browser", configFramework: "Next.js" } },
        { id: "t1-cdn", type: "systemNode", position: { x: 400, y: 200 }, data: { nodeCategory: "storage", label: "CDN", description: "Static assets and edge caching", configTechnology: "Vercel / CloudFront", configStorageType: "CDN" } },
        { id: "t1-auth", type: "systemNode", position: { x: 150, y: 200 }, data: { nodeCategory: "service", label: "Auth Service", description: "Authentication and session management", configTechnology: "Clerk / Auth.js", configProtocol: "OAuth 2.0" } },
        { id: "t1-api", type: "systemNode", position: { x: 400, y: 400 }, data: { nodeCategory: "gateway", label: "API Gateway", description: "Routing, rate limiting, CORS", configTechnology: "Next.js API Routes", configProtocol: "HTTPS/REST" } },
        { id: "t1-svc", type: "systemNode", position: { x: 200, y: 600 }, data: { nodeCategory: "service", label: "App Service", description: "Core business logic", configTechnology: "Node.js", configScaling: "horizontal" } },
        { id: "t1-bg", type: "systemNode", position: { x: 600, y: 600 }, data: { nodeCategory: "compute", label: "Background Jobs", description: "Async task processing", configTechnology: "Trigger.dev", configRuntime: "Node.js" } },
        { id: "t1-cache", type: "systemNode", position: { x: 200, y: 800 }, data: { nodeCategory: "cache", label: "Cache", description: "Session and query cache", configTechnology: "Redis", configCacheType: "In-memory", configTtl: "3600s" } },
        { id: "t1-db", type: "systemNode", position: { x: 600, y: 800 }, data: { nodeCategory: "database", label: "Primary Database", description: "Application data store", configTechnology: "PostgreSQL", configDbType: "Relational", configReplication: "Read replica" } },
        { id: "t1-email", type: "systemNode", position: { x: 900, y: 600 }, data: { nodeCategory: "service", label: "Email Service", description: "Transactional emails", configTechnology: "Resend / SendGrid", configProtocol: "SMTP" } },
      ],
      edges: [
        { id: "e1", source: "t1-client", target: "t1-cdn", data: { label: "static assets" } },
        { id: "e2", source: "t1-client", target: "t1-auth", data: { label: "login / session" } },
        { id: "e3", source: "t1-client", target: "t1-api", data: { label: "API requests" } },
        { id: "e4", source: "t1-api", target: "t1-svc", data: { label: "route request" } },
        { id: "e5", source: "t1-svc", target: "t1-cache", data: { label: "read/write" } },
        { id: "e6", source: "t1-svc", target: "t1-db", data: { label: "query" } },
        { id: "e7", source: "t1-svc", target: "t1-bg", data: { label: "enqueue job" } },
        { id: "e8", source: "t1-bg", target: "t1-email", data: { label: "send email" } },
        { id: "e9", source: "t1-bg", target: "t1-db", data: { label: "async writes" } },
      ],
    },
  },
  {
    id: "microservices",
    name: "Microservices",
    description: "Event-driven microservices with API gateway and message queue",
    category: "infra",
    schema: {
      version: "1",
      meta: { projectName: "Microservices Platform", exportedAt: "2026-06-04", exportedBy: "SYPI" },
      nodes: [
        { id: "m-client", type: "systemNode", position: { x: 500, y: 0 }, data: { nodeCategory: "client", label: "Client Apps", description: "Web and mobile clients", configPlatform: "Multi-platform" } },
        { id: "m-gw", type: "systemNode", position: { x: 500, y: 200 }, data: { nodeCategory: "gateway", label: "API Gateway", description: "Unified entry point, auth, routing", configTechnology: "Kong / AWS API GW", configProtocol: "HTTPS", configRateLimit: "1000 req/s" } },
        { id: "m-user", type: "systemNode", position: { x: 100, y: 450 }, data: { nodeCategory: "service", label: "User Service", description: "Registration, profiles, auth", configTechnology: "Node.js", configPort: "3001", configProtocol: "gRPC" } },
        { id: "m-order", type: "systemNode", position: { x: 400, y: 450 }, data: { nodeCategory: "service", label: "Order Service", description: "Order lifecycle management", configTechnology: "Go", configPort: "3002", configProtocol: "gRPC" } },
        { id: "m-notify", type: "systemNode", position: { x: 700, y: 450 }, data: { nodeCategory: "service", label: "Notification Service", description: "Email, SMS, push notifications", configTechnology: "Node.js", configPort: "3003" } },
        { id: "m-queue", type: "systemNode", position: { x: 500, y: 650 }, data: { nodeCategory: "queue", label: "Message Bus", description: "Async inter-service communication", configTechnology: "Kafka / RabbitMQ", configQueueType: "Message queue" } },
        { id: "m-udb", type: "systemNode", position: { x: 100, y: 850 }, data: { nodeCategory: "database", label: "Users DB", description: "User data store", configTechnology: "PostgreSQL", configDbType: "Relational" } },
        { id: "m-odb", type: "systemNode", position: { x: 400, y: 850 }, data: { nodeCategory: "database", label: "Orders DB", description: "Order data store", configTechnology: "PostgreSQL", configDbType: "Relational" } },
        { id: "m-cache", type: "systemNode", position: { x: 700, y: 850 }, data: { nodeCategory: "cache", label: "Shared Cache", description: "Cross-service session/data cache", configTechnology: "Redis", configCacheType: "In-memory" } },
      ],
      edges: [
        { id: "me1", source: "m-client", target: "m-gw", data: { label: "all requests" } },
        { id: "me2", source: "m-gw", target: "m-user", data: { label: "user routes" } },
        { id: "me3", source: "m-gw", target: "m-order", data: { label: "order routes" } },
        { id: "me4", source: "m-order", target: "m-queue", data: { label: "order.created" } },
        { id: "me5", source: "m-queue", target: "m-notify", data: { label: "notify event" } },
        { id: "me6", source: "m-user", target: "m-udb", data: { label: "read/write" } },
        { id: "me7", source: "m-order", target: "m-odb", data: { label: "read/write" } },
        { id: "me8", source: "m-user", target: "m-cache", data: { label: "session cache" } },
        { id: "me9", source: "m-order", target: "m-cache", data: { label: "rate limit" } },
      ],
    },
  },
  {
    id: "data-pipeline",
    name: "Data Pipeline",
    description: "Real-time analytics pipeline with ingestion, processing, and storage",
    category: "data",
    schema: {
      version: "1",
      meta: { projectName: "Data Pipeline", exportedAt: "2026-06-04", exportedBy: "SYPI" },
      nodes: [
        { id: "d-src1", type: "systemNode", position: { x: 0, y: 200 }, data: { nodeCategory: "client", label: "App Events", description: "User and system event emitters", configPlatform: "Multi-source" } },
        { id: "d-src2", type: "systemNode", position: { x: 0, y: 450 }, data: { nodeCategory: "client", label: "IoT / Logs", description: "Streaming sensor and log data", configPlatform: "IoT / Server" } },
        { id: "d-ingest", type: "systemNode", position: { x: 300, y: 325 }, data: { nodeCategory: "queue", label: "Ingestion Layer", description: "High-throughput event ingestion", configTechnology: "Kafka", configQueueType: "Streaming" } },
        { id: "d-stream", type: "systemNode", position: { x: 600, y: 200 }, data: { nodeCategory: "compute", label: "Stream Processor", description: "Real-time transformations and enrichment", configTechnology: "Apache Flink / Spark", configRuntime: "JVM" } },
        { id: "d-batch", type: "systemNode", position: { x: 600, y: 450 }, data: { nodeCategory: "compute", label: "Batch Processor", description: "Scheduled aggregations and reports", configTechnology: "Apache Spark", configRuntime: "JVM" } },
        { id: "d-dw", type: "systemNode", position: { x: 950, y: 200 }, data: { nodeCategory: "database", label: "Data Warehouse", description: "OLAP queries and BI reporting", configTechnology: "BigQuery / Snowflake", configDbType: "Columnar" } },
        { id: "d-store", type: "systemNode", position: { x: 950, y: 450 }, data: { nodeCategory: "storage", label: "Object Storage", description: "Raw and processed data lake", configTechnology: "S3 / GCS", configStorageType: "Object store" } },
        { id: "d-api", type: "systemNode", position: { x: 1200, y: 325 }, data: { nodeCategory: "service", label: "Analytics API", description: "Query interface for dashboards", configTechnology: "FastAPI", configProtocol: "REST" } },
        { id: "d-dash", type: "systemNode", position: { x: 1500, y: 325 }, data: { nodeCategory: "client", label: "Dashboard", description: "Business intelligence UI", configPlatform: "Browser", configFramework: "Metabase / Grafana" } },
      ],
      edges: [
        { id: "de1", source: "d-src1", target: "d-ingest", data: { label: "events" } },
        { id: "de2", source: "d-src2", target: "d-ingest", data: { label: "streams" } },
        { id: "de3", source: "d-ingest", target: "d-stream", data: { label: "real-time feed" } },
        { id: "de4", source: "d-ingest", target: "d-store", data: { label: "raw storage" } },
        { id: "de5", source: "d-store", target: "d-batch", data: { label: "scheduled reads" } },
        { id: "de6", source: "d-stream", target: "d-dw", data: { label: "aggregated events" } },
        { id: "de7", source: "d-batch", target: "d-dw", data: { label: "batch writes" } },
        { id: "de8", source: "d-dw", target: "d-api", data: { label: "OLAP queries" } },
        { id: "de9", source: "d-api", target: "d-dash", data: { label: "metrics & charts" } },
      ],
    },
  },
  {
    id: "serverless-api",
    name: "Serverless API",
    description: "Serverless functions with managed database and CDN edge delivery",
    category: "infra",
    schema: {
      version: "1",
      meta: { projectName: "Serverless API", exportedAt: "2026-06-04", exportedBy: "SYPI" },
      nodes: [
        { id: "s-client", type: "systemNode", position: { x: 300, y: 0 }, data: { nodeCategory: "client", label: "Client", description: "Web or mobile consumer", configPlatform: "Browser / Mobile" } },
        { id: "s-edge", type: "systemNode", position: { x: 300, y: 200 }, data: { nodeCategory: "storage", label: "Edge Network", description: "Global CDN with edge caching", configTechnology: "Vercel Edge / CloudFront", configStorageType: "CDN" } },
        { id: "s-gw", type: "systemNode", position: { x: 300, y: 400 }, data: { nodeCategory: "gateway", label: "API Gateway", description: "Request routing and auth", configTechnology: "AWS API Gateway", configProtocol: "HTTPS" } },
        { id: "s-fn1", type: "systemNode", position: { x: 0, y: 600 }, data: { nodeCategory: "compute", label: "Auth Function", description: "JWT validation and session management", configTechnology: "Lambda / Edge Function", configRuntime: "Node.js 20", configMemory: "256MB", configTimeout: "5s" } },
        { id: "s-fn2", type: "systemNode", position: { x: 300, y: 600 }, data: { nodeCategory: "compute", label: "Core API", description: "Business logic handlers", configTechnology: "Lambda / Vercel Functions", configRuntime: "Node.js 20", configMemory: "512MB", configTimeout: "30s" } },
        { id: "s-fn3", type: "systemNode", position: { x: 600, y: 600 }, data: { nodeCategory: "compute", label: "Webhook Handler", description: "Inbound webhook processing", configTechnology: "Lambda", configRuntime: "Node.js 20", configMemory: "256MB", configTimeout: "15s" } },
        { id: "s-cache", type: "systemNode", position: { x: 150, y: 800 }, data: { nodeCategory: "cache", label: "Cache Layer", description: "Response and session cache", configTechnology: "Upstash Redis", configCacheType: "Serverless", configTtl: "300s" } },
        { id: "s-db", type: "systemNode", position: { x: 450, y: 800 }, data: { nodeCategory: "database", label: "Managed Database", description: "Serverless PostgreSQL", configTechnology: "Neon / PlanetScale", configDbType: "Serverless SQL", configScaling: "Auto-scale" } },
        { id: "s-queue", type: "systemNode", position: { x: 750, y: 800 }, data: { nodeCategory: "queue", label: "Task Queue", description: "Async background work", configTechnology: "SQS / Upstash QStash", configQueueType: "FIFO queue" } },
      ],
      edges: [
        { id: "se1", source: "s-client", target: "s-edge", data: { label: "request" } },
        { id: "se2", source: "s-edge", target: "s-gw", data: { label: "cache miss" } },
        { id: "se3", source: "s-gw", target: "s-fn1", data: { label: "auth check" } },
        { id: "se4", source: "s-gw", target: "s-fn2", data: { label: "API call" } },
        { id: "se5", source: "s-gw", target: "s-fn3", data: { label: "webhook" } },
        { id: "se6", source: "s-fn2", target: "s-cache", data: { label: "read/set" } },
        { id: "se7", source: "s-fn2", target: "s-db", data: { label: "query" } },
        { id: "se8", source: "s-fn3", target: "s-queue", data: { label: "enqueue task" } },
        { id: "se9", source: "s-fn2", target: "s-queue", data: { label: "async work" } },
      ],
    },
  },
];

import type { CanvasNode, CanvasEdge } from "@/types/canvas";

export interface Suggestion {
  id: string;
  type: "rule" | "ai";
  title: string;
  message: string;
  affectedNodeIds: string[];
  suggestedAction: string;
}

/**
 * Rule-based pattern analysis — instant, no API call.
 * Checks for 6 common architectural anti-patterns.
 */
export function analyzePatterns(
  nodes: CanvasNode[],
  edges: CanvasEdge[]
): Suggestion[] {
  if (nodes.length === 0) return [];

  const suggestions: Suggestion[] = [];

  // Build adjacency data
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, new Set());
    if (!incoming.has(edge.target)) incoming.set(edge.target, new Set());
    outgoing.get(edge.source)!.add(edge.target);
    incoming.get(edge.target)!.add(edge.source);
  }

  const byCategory = (cat: string) =>
    nodes.filter((n) => n.data.nodeCategory === cat);

  const databases = byCategory("database");
  const services = byCategory("service");
  const caches = byCategory("cache");
  const gateways = byCategory("gateway");
  const clients = byCategory("client");
  const queues = byCategory("queue");
  const computes = byCategory("compute");

  // Rule 1: Database with no cache
  for (const db of databases) {
    const sources = incoming.get(db.id) ?? new Set();
    const hasCacheUpstream = [...sources].some(
      (srcId) => nodeById.get(srcId)?.data.nodeCategory === "cache"
    );
    if (!hasCacheUpstream && sources.size > 0) {
      const connectedService = [...sources]
        .map((id) => nodeById.get(id))
        .find((n) => n?.data.nodeCategory === "service");
      if (connectedService) {
        suggestions.push({
          id: `cache-${db.id}`,
          type: "rule",
          title: "Add a cache layer",
          message: `Add a cache (e.g., Redis) between "${connectedService.data.label}" and "${db.data.label}" to reduce database load.`,
          affectedNodeIds: [connectedService.id, db.id],
          suggestedAction: `Add a Redis cache between ${connectedService.data.label} and ${db.data.label}`,
        });
      }
    }
  }

  // Rule 2: Service with no load balancer/gateway
  if (services.length > 0 && gateways.length === 0) {
    const firstService = services[0];
    suggestions.push({
      id: `gateway-missing`,
      type: "rule",
      title: "Add an API Gateway",
      message: `Add an API Gateway in front of your services to handle routing, rate limiting, and authentication.`,
      affectedNodeIds: [firstService.id],
      suggestedAction: "Add an API Gateway in front of the services",
    });
  }

  // Rule 3: Client directly connected to database
  for (const client of clients) {
    const targets = outgoing.get(client.id) ?? new Set();
    for (const targetId of targets) {
      const target = nodeById.get(targetId);
      if (target?.data.nodeCategory === "database") {
        suggestions.push({
          id: `direct-db-${client.id}-${targetId}`,
          type: "rule",
          title: "Add an API layer",
          message: `"${client.data.label}" connects directly to "${target.data.label}". Add a service/API layer between them for security.`,
          affectedNodeIds: [client.id, targetId],
          suggestedAction: `Add an API service between ${client.data.label} and ${target.data.label}`,
        });
      }
    }
  }

  // Rule 4: No monitoring/logging node
  const hasMonitoring = nodes.some(
    (n) =>
      n.data.label.toLowerCase().includes("monitor") ||
      n.data.label.toLowerCase().includes("logging") ||
      n.data.label.toLowerCase().includes("observ") ||
      n.data.label.toLowerCase().includes("prometheus") ||
      n.data.label.toLowerCase().includes("datadog") ||
      n.data.label.toLowerCase().includes("grafana")
  );
  if (!hasMonitoring && nodes.length >= 3) {
    suggestions.push({
      id: "monitoring-missing",
      type: "rule",
      title: "Add monitoring",
      message: "Consider adding a monitoring/observability service (e.g., Prometheus, Datadog) to track system health.",
      affectedNodeIds: [],
      suggestedAction: "Add a monitoring service (e.g., Prometheus + Grafana)",
    });
  }

  // Rule 5: Single critical service (no redundancy)
  for (const service of services) {
    const incomingCount = (incoming.get(service.id) ?? new Set()).size;
    if (incomingCount >= 3) {
      suggestions.push({
        id: `redundancy-${service.id}`,
        type: "rule",
        title: "Add redundancy",
        message: `"${service.data.label}" has ${incomingCount} upstream dependencies. Consider adding redundancy or a load balancer.`,
        affectedNodeIds: [service.id],
        suggestedAction: `Add redundancy or load balancing for ${service.data.label}`,
      });
    }
  }

  // Rule 6: 3+ services with no message queue
  if (services.length >= 3 && queues.length === 0) {
    suggestions.push({
      id: "queue-missing",
      type: "rule",
      title: "Consider a message queue",
      message: `You have ${services.length} services. A message queue (e.g., Kafka, RabbitMQ) can help with async communication and decoupling.`,
      affectedNodeIds: services.slice(0, 2).map((n) => n.id),
      suggestedAction: "Add a message queue for async communication between services",
    });
  }

  return suggestions;
}

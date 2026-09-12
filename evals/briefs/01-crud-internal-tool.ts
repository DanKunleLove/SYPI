import type { Brief } from "../types";

/** The over-engineering trap. A competent design here is BORING. */
export const brief: Brief = {
  id: "01-crud-internal-tool",
  title: "Internal equipment tracker",
  brief:
    "We're a 40-person construction firm. Right now our site managers track which tools and " +
    "equipment are checked out to which crew on a shared spreadsheet and it keeps getting " +
    "overwritten. I want a simple internal web app where a manager can log equipment in and out, " +
    "see what's currently assigned to whom, and pull a list at the end of the month. Only our " +
    "office staff would use it — maybe 8 people.",
  expectedTier: 1,
  componentBudget: { min: 2, max: 6 },
  properties: [
    {
      id: "persistence",
      label: "Durable relational storage for equipment and assignment records",
      detect: { categories: ["database"] },
      severity: "critical",
    },
    {
      id: "auth",
      label: "Some form of staff authentication — it is internal, not public",
      detect: { any: ["auth", "login", "sign in", "identity", "clerk", "session"] },
      severity: "critical",
    },
    {
      id: "app-surface",
      label: "A web interface the staff actually use",
      detect: { categories: ["client"] },
      severity: "critical",
    },
    {
      id: "assignment-history",
      label: "Check-out/check-in is a historical record, not just a current-state flag",
      detect: { any: ["history", "log", "audit", "record", "transaction", "ledger"] },
      severity: "important",
    },
  ],
  ambiguityAreas: [
    { id: "concurrent-checkout", label: "What if two managers check out the same item at once?", keywords: ["concurren", "lock", "conflict", "race", "simultaneous", "atomic"] },
    { id: "roles", label: "Do all 8 staff have the same permissions?", keywords: ["role", "permission", "admin", "read-only", "viewer"] },
    { id: "retention", label: "How long is check-out history kept?", keywords: ["retention", "archive", "how long", "purge", "delete after"] },
    { id: "offline", label: "Do site managers need this on-site/offline?", keywords: ["offline", "mobile", "on-site", "field", "sync"] },
    { id: "reporting", label: "What exactly does the month-end list need to contain?", keywords: ["report", "export", "csv", "month-end", "summary"] },
  ],
  forbidden: [
    { id: "microservices", label: "Service decomposition for an 8-user internal tool", keywords: ["microservice", "service mesh", "bounded context"] },
    { id: "streaming", label: "Message queue / event streaming", keywords: ["kafka", "rabbitmq", "pub/sub", "event bus", "sqs", "nats"] },
    { id: "orchestration", label: "Container orchestration", keywords: ["kubernetes", "k8s", "docker swarm", "ecs"] },
    { id: "cache-tier", label: "A dedicated cache tier", keywords: ["redis", "memcached", "cache layer"] },
    { id: "multiregion", label: "Multi-region / global distribution", keywords: ["multi-region", "geo-replica", "cdn edge", "failover region"] },
  ],
};

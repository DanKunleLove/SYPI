import type { CapabilityClass } from "@/lib/capabilities/registry";

/**
 * The provider catalogue — concrete products that can deliver a capability.
 *
 * Kept STRICTLY separate from the capability taxonomy, which contains no vendor
 * names by design. Capability is the semantic unit and is stable; providers churn
 * constantly, so they live here where the list can be edited without touching a
 * single piece of reasoning.
 *
 * This file is data. Selection logic lives in `lib/uss/binding.ts`.
 *
 * Characteristics are deliberately coarse — band, not benchmark. A precise number
 * would be wrong within a month, and the selection only needs enough to answer
 * "does this rule this out?" Where a value would be a guess, it is omitted.
 */

export type CostBand = "free" | "low" | "medium" | "high";
export type MaturityBand = "emerging" | "established" | "incumbent";

export interface ProviderOption {
  id: string;
  label: string;
  capability: CapabilityClass;
  /** What it is, in one line. */
  summary: string;
  costBand: CostBand;
  maturity: MaturityBand;
  /** Self-hostable, which some regulatory constraints require. */
  selfHostable: boolean;
  /** Has a usable free tier for getting started. */
  freeTier: boolean;
  /** Regions or jurisdictions it can be pinned to, where that matters. */
  regions?: string[];
  /** Things that genuinely rule it out for some projects. */
  limitations?: string[];
  /** Lowest complexity tier where this is a sensible choice. */
  tierFloor: number;
  /** Markets where this is the pragmatic default. Empty = global. */
  strongIn?: string[];
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  // ── Relational store ───────────────────────────────────────────────────────
  { id: "postgres-managed", label: "Managed PostgreSQL", capability: "RELATIONAL_STORE", summary: "Standard relational database, managed.", costBand: "low", maturity: "incumbent", selfHostable: true, freeTier: true, tierFloor: 0 },
  { id: "sqlite", label: "SQLite", capability: "RELATIONAL_STORE", summary: "Single-file database. No server to run.", costBand: "free", maturity: "incumbent", selfHostable: true, freeTier: true, tierFloor: 0, limitations: ["single writer", "not suited to multiple app instances"] },
  { id: "mysql-managed", label: "Managed MySQL", capability: "RELATIONAL_STORE", summary: "Relational database, managed.", costBand: "low", maturity: "incumbent", selfHostable: true, freeTier: true, tierFloor: 1 },

  // ── Object storage ─────────────────────────────────────────────────────────
  { id: "s3-compatible", label: "S3-compatible object storage", capability: "OBJECT_STORAGE", summary: "Industry-standard object storage API.", costBand: "low", maturity: "incumbent", selfHostable: true, freeTier: true, tierFloor: 1 },
  { id: "local-disk", label: "Local disk", capability: "OBJECT_STORAGE", summary: "Files on the machine running the app.", costBand: "free", maturity: "incumbent", selfHostable: true, freeTier: true, tierFloor: 0, limitations: ["lost if the machine is replaced", "does not work across instances"] },

  // ── Auth ───────────────────────────────────────────────────────────────────
  { id: "hosted-auth", label: "Hosted authentication", capability: "AUTH", summary: "Managed sign-in, sessions and user records.", costBand: "low", maturity: "established", selfHostable: false, freeTier: true, tierFloor: 1 },
  { id: "self-hosted-auth", label: "Self-hosted authentication", capability: "AUTH", summary: "Auth library running inside your own app.", costBand: "free", maturity: "established", selfHostable: true, freeTier: true, tierFloor: 1, limitations: ["you own password and session security"] },
  { id: "enterprise-idp", label: "Enterprise identity provider", capability: "AUTH", summary: "SAML/OIDC for corporate buyers.", costBand: "medium", maturity: "incumbent", selfHostable: false, freeTier: false, tierFloor: 3 },

  // ── Payments ───────────────────────────────────────────────────────────────
  { id: "stripe", label: "Stripe", capability: "PAYMENTS", summary: "Card payments, subscriptions, payouts.", costBand: "medium", maturity: "incumbent", selfHostable: false, freeTier: false, tierFloor: 2, limitations: ["not available to businesses in every country"] },
  { id: "paystack", label: "Paystack", capability: "PAYMENTS", summary: "Card and bank payments for African markets.", costBand: "medium", maturity: "established", selfHostable: false, freeTier: false, tierFloor: 2, strongIn: ["nigeria", "ghana", "south africa", "kenya", "africa"] },
  { id: "flutterwave", label: "Flutterwave", capability: "PAYMENTS", summary: "Pan-African payments and payouts.", costBand: "medium", maturity: "established", selfHostable: false, freeTier: false, tierFloor: 2, strongIn: ["nigeria", "africa", "kenya", "ghana"] },
  { id: "merchant-of-record", label: "Merchant of record", capability: "PAYMENTS", summary: "They sell on your behalf and handle tax.", costBand: "high", maturity: "established", selfHostable: false, freeTier: false, tierFloor: 2, limitations: ["higher fees"], },

  // ── Queue ──────────────────────────────────────────────────────────────────
  { id: "db-queue", label: "Database-backed queue", capability: "QUEUE", summary: "A jobs table with workers. No extra infrastructure.", costBand: "free", maturity: "established", selfHostable: true, freeTier: true, tierFloor: 2 },
  { id: "managed-queue", label: "Managed queue service", capability: "QUEUE", summary: "Hosted job queue with retries and dead-letter handling.", costBand: "low", maturity: "incumbent", selfHostable: false, freeTier: true, tierFloor: 3 },
  { id: "redis-queue", label: "Redis-backed queue", capability: "QUEUE", summary: "Fast in-memory queue.", costBand: "low", maturity: "incumbent", selfHostable: true, freeTier: true, tierFloor: 3, limitations: ["jobs can be lost unless persistence is configured"] },

  // ── LLM ────────────────────────────────────────────────────────────────────
  { id: "llm-frontier-hosted", label: "Frontier hosted model", capability: "LLM", summary: "Strongest reasoning, priced per token.", costBand: "high", maturity: "established", selfHostable: false, freeTier: false, tierFloor: 0 },
  { id: "llm-fast-hosted", label: "Fast hosted model", capability: "LLM", summary: "Cheaper and quicker; adequate for most extraction and classification.", costBand: "low", maturity: "established", selfHostable: false, freeTier: true, tierFloor: 0 },
  { id: "llm-open-weights", label: "Open-weights model", capability: "LLM", summary: "Run it yourself or on a neutral host.", costBand: "medium", maturity: "emerging", selfHostable: true, freeTier: true, tierFloor: 2, limitations: ["you own the serving infrastructure and its uptime"] },

  // ── Vector search ──────────────────────────────────────────────────────────
  { id: "pgvector", label: "Vectors in your existing database", capability: "VECTOR_SEARCH", summary: "Vector column alongside your relational data. No new system.", costBand: "free", maturity: "established", selfHostable: true, freeTier: true, tierFloor: 2 },
  { id: "managed-vector-db", label: "Managed vector database", capability: "VECTOR_SEARCH", summary: "Purpose-built vector store.", costBand: "medium", maturity: "established", selfHostable: false, freeTier: true, tierFloor: 3 },

  // ── Email ──────────────────────────────────────────────────────────────────
  { id: "transactional-email", label: "Transactional email service", capability: "EMAIL", summary: "Sign-up and notification email.", costBand: "low", maturity: "incumbent", selfHostable: false, freeTier: true, tierFloor: 1 },
  { id: "bulk-email", label: "Bulk email platform", capability: "EMAIL", summary: "Campaigns, lists, deliverability management.", costBand: "medium", maturity: "incumbent", selfHostable: false, freeTier: true, tierFloor: 2 },

  // ── Cache / CDN ────────────────────────────────────────────────────────────
  { id: "redis-cache", label: "Redis", capability: "CACHE", summary: "In-memory cache.", costBand: "low", maturity: "incumbent", selfHostable: true, freeTier: true, tierFloor: 3 },
  { id: "edge-cache", label: "Edge / CDN caching", capability: "CDN", summary: "Cached at the edge, near the user.", costBand: "low", maturity: "incumbent", selfHostable: false, freeTier: true, tierFloor: 2 },

  // ── Realtime ───────────────────────────────────────────────────────────────
  { id: "managed-realtime", label: "Managed realtime service", capability: "REALTIME_SYNC", summary: "Presence, shared state and conflict handling, hosted.", costBand: "medium", maturity: "established", selfHostable: false, freeTier: true, tierFloor: 3 },
  { id: "websockets-own", label: "Your own WebSocket server", capability: "REALTIME_SYNC", summary: "Full control, and full responsibility for scaling it.", costBand: "low", maturity: "incumbent", selfHostable: true, freeTier: true, tierFloor: 4, limitations: ["you build presence and conflict resolution yourself"] },

  // ── Media generation ───────────────────────────────────────────────────────
  { id: "video-gen-hosted", label: "Hosted video generation API", capability: "VIDEO_GEN", summary: "Text or image to video.", costBand: "high", maturity: "emerging", selfHostable: false, freeTier: false, tierFloor: 2, limitations: ["output length and resolution limits vary widely", "licence terms differ per provider"] },
  { id: "image-gen-hosted", label: "Hosted image generation API", capability: "IMAGE_GEN", summary: "Text or image to image.", costBand: "medium", maturity: "established", selfHostable: false, freeTier: true, tierFloor: 1 },

  // ── Observability ──────────────────────────────────────────────────────────
  { id: "hosted-observability", label: "Hosted observability", capability: "OBSERVABILITY", summary: "Logs, metrics, traces and alerting.", costBand: "medium", maturity: "incumbent", selfHostable: false, freeTier: true, tierFloor: 2 },
  { id: "platform-logs", label: "Whatever your platform gives you", capability: "OBSERVABILITY", summary: "Built-in logs from the hosting platform.", costBand: "free", maturity: "established", selfHostable: false, freeTier: true, tierFloor: 1, limitations: ["short retention", "no alerting"] },
];

export function optionsFor(capability: CapabilityClass): ProviderOption[] {
  return PROVIDER_OPTIONS.filter((p) => p.capability === capability);
}

export function getProviderOption(id: string): ProviderOption | undefined {
  return PROVIDER_OPTIONS.find((p) => p.id === id);
}

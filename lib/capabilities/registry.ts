import type { NodeCategory } from "@/types/canvas";

/**
 * Capability taxonomy — the domain-neutral vocabulary of what a system must be
 * able to DO, independent of which product does it.
 *
 * This exists because the canvas's nine node categories (service, database,
 * gateway…) are a SOFTWARE vocabulary, and SYPI already serves eight domains
 * including video, music, marketing and business. Capability is the semantic
 * unit; `softwareCategory` is a projection of it onto the canvas for software
 * projects, and is null where no sensible projection exists.
 *
 * Capabilities are CLASSES, never products. There must be no vendor name in this
 * file — "VIDEO_GEN", not "Runway". Providers are bound to capabilities in a
 * later unit precisely so that today's tool list does not ossify into the schema.
 *
 * `tierFloor` is the lowest complexity tier at which a capability is justifiable.
 * A tier-1 internal tool proposing STREAM or a service mesh is over-engineering,
 * and the integrity checks use this to say so deterministically.
 */

export type CapabilityClass =
  // Intelligence
  | "LLM"
  | "EMBEDDING"
  | "VECTOR_SEARCH"
  | "IMAGE_GEN"
  | "VIDEO_GEN"
  | "AUDIO_GEN"
  | "SPEECH_TO_TEXT"
  | "TEXT_TO_SPEECH"
  | "VOICE_AGENT"
  // State
  | "RELATIONAL_STORE"
  | "DOCUMENT_STORE"
  | "OBJECT_STORAGE"
  | "CACHE"
  | "SEARCH"
  // Movement
  | "QUEUE"
  | "STREAM"
  | "REALTIME_SYNC"
  | "SCHEDULER"
  | "WORKFLOW_ENGINE"
  // Boundary
  | "AUTH"
  | "AUTHZ"
  | "API_GATEWAY"
  | "CDN"
  // Commerce & comms
  | "PAYMENTS"
  | "EMAIL"
  | "SMS"
  | "PUSH"
  // Operations
  | "OBSERVABILITY"
  | "SECRETS"
  | "ANALYTICS"
  // Build surfaces
  | "CODE_AGENT"
  | "APP_BUILDER";

/** Which of the eight System Kit domains a capability is relevant to. */
export type CapabilityDomain =
  | "software"
  | "automation"
  | "video"
  | "image"
  | "music"
  | "writing"
  | "marketing"
  | "business";

export interface CapabilityDef {
  id: CapabilityClass;
  label: string;
  /** One line: what having this capability means for the system. */
  summary: string;
  domains: CapabilityDomain[];
  /** Lowest complexity tier (0-5) at which this is justifiable. */
  tierFloor: number;
  /** Capabilities this one usually drags in with it. */
  implies: CapabilityClass[];
  /** Projection onto the canvas vocabulary; null where none fits. */
  softwareCategory: NodeCategory | null;
}

const ALL: CapabilityDomain[] = [
  "software", "automation", "video", "image", "music", "writing", "marketing", "business",
];
const CODE: CapabilityDomain[] = ["software", "automation"];
const CREATIVE: CapabilityDomain[] = ["video", "image", "music", "writing", "marketing"];

export const CAPABILITIES: CapabilityDef[] = [
  // ── Intelligence ───────────────────────────────────────────────────────────
  { id: "LLM", label: "Language model", summary: "Generates or transforms text, or drives tool use.", domains: ALL, tierFloor: 0, implies: ["SECRETS"], softwareCategory: "service" },
  { id: "EMBEDDING", label: "Embeddings", summary: "Turns content into vectors for similarity search.", domains: ALL, tierFloor: 2, implies: ["VECTOR_SEARCH"], softwareCategory: "service" },
  { id: "VECTOR_SEARCH", label: "Vector search", summary: "Retrieves content by meaning rather than keyword.", domains: ALL, tierFloor: 2, implies: ["EMBEDDING"], softwareCategory: "database" },
  { id: "IMAGE_GEN", label: "Image generation", summary: "Produces images from prompts or references.", domains: [...CREATIVE, "software"], tierFloor: 1, implies: ["OBJECT_STORAGE", "QUEUE"], softwareCategory: "service" },
  { id: "VIDEO_GEN", label: "Video generation", summary: "Produces video. Slow, expensive, failure-prone.", domains: [...CREATIVE, "software"], tierFloor: 2, implies: ["OBJECT_STORAGE", "QUEUE"], softwareCategory: "service" },
  { id: "AUDIO_GEN", label: "Audio / music generation", summary: "Produces music or sound.", domains: ["music", "video", "marketing"], tierFloor: 2, implies: ["OBJECT_STORAGE", "QUEUE"], softwareCategory: "service" },
  { id: "SPEECH_TO_TEXT", label: "Speech to text", summary: "Transcribes audio.", domains: [...CREATIVE, "software", "business"], tierFloor: 1, implies: ["OBJECT_STORAGE"], softwareCategory: "service" },
  { id: "TEXT_TO_SPEECH", label: "Text to speech", summary: "Synthesises speech from text.", domains: [...CREATIVE, "software"], tierFloor: 1, implies: ["OBJECT_STORAGE"], softwareCategory: "service" },
  { id: "VOICE_AGENT", label: "Voice agent", summary: "Real-time spoken conversation.", domains: ["software", "automation", "business"], tierFloor: 3, implies: ["LLM", "SPEECH_TO_TEXT", "TEXT_TO_SPEECH"], softwareCategory: "service" },

  // ── State ──────────────────────────────────────────────────────────────────
  { id: "RELATIONAL_STORE", label: "Relational database", summary: "Durable, transactional, related records.", domains: ALL, tierFloor: 0, implies: [], softwareCategory: "database" },
  { id: "DOCUMENT_STORE", label: "Document database", summary: "Durable records with flexible shape.", domains: CODE, tierFloor: 1, implies: [], softwareCategory: "database" },
  { id: "OBJECT_STORAGE", label: "Object storage", summary: "Files and media too large for a database.", domains: ALL, tierFloor: 1, implies: [], softwareCategory: "storage" },
  { id: "CACHE", label: "Cache", summary: "Ephemeral fast reads. Never a source of truth.", domains: CODE, tierFloor: 2, implies: [], softwareCategory: "cache" },
  { id: "SEARCH", label: "Full-text search", summary: "Keyword retrieval across a corpus.", domains: CODE, tierFloor: 2, implies: [], softwareCategory: "database" },

  // ── Movement ───────────────────────────────────────────────────────────────
  { id: "QUEUE", label: "Job queue", summary: "Work that must not happen in a request.", domains: ALL, tierFloor: 2, implies: [], softwareCategory: "queue" },
  { id: "STREAM", label: "Event stream", summary: "Durable ordered event log for many consumers.", domains: CODE, tierFloor: 4, implies: [], softwareCategory: "queue" },
  { id: "REALTIME_SYNC", label: "Realtime sync", summary: "Live shared state across clients.", domains: CODE, tierFloor: 3, implies: [], softwareCategory: "service" },
  { id: "SCHEDULER", label: "Scheduled work", summary: "Recurring or deferred execution.", domains: ALL, tierFloor: 1, implies: [], softwareCategory: "compute" },
  { id: "WORKFLOW_ENGINE", label: "Workflow engine", summary: "Multi-step processes with branching and retries.", domains: ["automation", "business", "marketing", "software"], tierFloor: 2, implies: [], softwareCategory: "service" },

  // ── Boundary ───────────────────────────────────────────────────────────────
  { id: "AUTH", label: "Authentication", summary: "Establishes who the caller is.", domains: ALL, tierFloor: 1, implies: [], softwareCategory: "gateway" },
  { id: "AUTHZ", label: "Authorization", summary: "Decides what that caller may do. Distinct from AUTH.", domains: ALL, tierFloor: 1, implies: ["AUTH"], softwareCategory: "gateway" },
  { id: "API_GATEWAY", label: "API gateway", summary: "Single entry point: routing, rate limits, auth.", domains: CODE, tierFloor: 2, implies: [], softwareCategory: "gateway" },
  { id: "CDN", label: "Content delivery", summary: "Serves static or cached content near the user.", domains: CODE, tierFloor: 2, implies: [], softwareCategory: "cache" },

  // ── Commerce & comms ───────────────────────────────────────────────────────
  { id: "PAYMENTS", label: "Payments", summary: "Moves money. Demands idempotency and an audit trail.", domains: ["software", "business", "marketing"], tierFloor: 2, implies: ["RELATIONAL_STORE", "AUTHZ"], softwareCategory: "service" },
  { id: "EMAIL", label: "Email delivery", summary: "Transactional or bulk email.", domains: ALL, tierFloor: 1, implies: [], softwareCategory: "service" },
  { id: "SMS", label: "SMS delivery", summary: "Text messaging.", domains: ["software", "business", "marketing"], tierFloor: 2, implies: [], softwareCategory: "service" },
  { id: "PUSH", label: "Push notifications", summary: "Device notifications.", domains: ["software"], tierFloor: 2, implies: [], softwareCategory: "service" },

  // ── Operations ─────────────────────────────────────────────────────────────
  { id: "OBSERVABILITY", label: "Observability", summary: "Logs, metrics, traces, alerts.", domains: ALL, tierFloor: 2, implies: [], softwareCategory: "service" },
  { id: "SECRETS", label: "Secret management", summary: "Credentials kept out of code and configuration.", domains: ALL, tierFloor: 1, implies: [], softwareCategory: null },
  { id: "ANALYTICS", label: "Product analytics", summary: "What users actually do.", domains: ALL, tierFloor: 2, implies: [], softwareCategory: "service" },

  // ── Build surfaces ─────────────────────────────────────────────────────────
  { id: "CODE_AGENT", label: "Coding agent", summary: "Writes the implementation from a specification.", domains: CODE, tierFloor: 0, implies: [], softwareCategory: null },
  { id: "APP_BUILDER", label: "App builder", summary: "Generates a running application from a description.", domains: CODE, tierFloor: 0, implies: [], softwareCategory: null },
];

export const CAPABILITY_CLASSES = CAPABILITIES.map((c) => c.id) as [
  CapabilityClass,
  ...CapabilityClass[],
];

const BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));

export function getCapability(id: string): CapabilityDef | undefined {
  return BY_ID.get(id as CapabilityClass);
}

export function isCapabilityClass(value: string): value is CapabilityClass {
  return BY_ID.has(value as CapabilityClass);
}

/** Capabilities relevant to a domain, for prompting and for gap rules. */
export function capabilitiesForDomain(domain: CapabilityDomain): CapabilityDef[] {
  return CAPABILITIES.filter((c) => c.domains.includes(domain));
}

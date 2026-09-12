import type { Brief } from "../types";
import { brief as crudInternalTool } from "./01-crud-internal-tool";
import { brief as multiTenantSaas } from "./02-multi-tenant-saas";

/**
 * Canonical briefs 03-10.
 *
 * Every brief is written the way a client actually talks: vague, incomplete, and
 * silent on the things that matter most. Each declares EXPECTED ENGINEERING
 * PROPERTIES, never one expected architecture — there are many correct designs
 * for each of these, and a benchmark that demands one specific shape measures
 * conformance, not quality.
 */

const marketplace: Brief = {
  id: "03-marketplace",
  title: "Nigerian goods marketplace",
  brief:
    "I want to build a marketplace where Nigerian users can buy products from local merchants. " +
    "Merchants list what they have, customers browse and order, and we take a cut. We would handle " +
    "the payment and pay merchants out weekly. Delivery is handled by third-party riders.",
  expectedTier: 4,
  componentBudget: { min: 8, max: 18 },
  properties: [
    { id: "inventory-consistency", severity: "critical", label: "Stock cannot go negative — reservation or atomic decrement on order", detect: { any: ["inventory", "stock", "reserv", "availability", "oversell", "atomic", "lock"] } },
    { id: "payment-idempotency", severity: "critical", label: "Payment webhooks may arrive more than once and must produce one business effect", detect: { any: ["idempot", "duplicate", "replay", "exactly once", "dedup"] } },
    { id: "order-lifecycle", severity: "critical", label: "An explicit order state machine, not a boolean", detect: { any: ["state machine", "lifecycle", "pending", "fulfil", "fulfill", "cancel", "transition", "status"] } },
    { id: "settlement", severity: "critical", label: "Merchant payout is modelled separately from customer payment", detect: { any: ["settle", "payout", "disburse", "merchant balance", "escrow", "ledger", "commission"] } },
    { id: "authz-boundary", severity: "critical", label: "Merchants can only see and act on their own orders", detect: { any: ["authoriz", "permission", "role", "scope", "access control", "ownership"] } },
    { id: "payment-provider", severity: "important", label: "A real payment integration, not a hand-rolled payment service", detect: { any: ["paystack", "flutterwave", "stripe", "payment gateway", "psp", "payment provider"] } },
    { id: "delivery-integration", severity: "important", label: "Third-party delivery is an external dependency with its own failure path", detect: { any: ["delivery", "rider", "logistics", "courier", "shipment", "dispatch"] } },
    { id: "async-work", severity: "important", label: "Slow or unreliable work is asynchronous", detect: { categories: ["queue"] } },
  ],
  ambiguityAreas: [
    { id: "refunds", label: "Refunds and partial refunds?", keywords: ["refund", "chargeback", "reversal", "dispute"] },
    { id: "payment-failure", label: "Payment succeeds but stock ran out?", keywords: ["compensat", "rollback", "saga", "reconcil", "out of stock"] },
    { id: "cancellation", label: "Who can cancel an order, and until when?", keywords: ["cancel", "cut-off", "window", "policy"] },
    { id: "multi-merchant-cart", label: "Can one order span multiple merchants?", keywords: ["multi-merchant", "split", "sub-order", "per merchant", "basket"] },
    { id: "currency-tax", label: "Currency, VAT and merchant tax?", keywords: ["currency", "ngn", "naira", "vat", "tax", "fx"] },
    { id: "fraud", label: "Fraud and abuse controls?", keywords: ["fraud", "risk", "abuse", "velocity", "blacklist"] },
    { id: "reconciliation", label: "How are payouts reconciled against payments?", keywords: ["reconcil", "ledger", "double entry", "audit", "statement"] },
    { id: "delivery-failure", label: "What if delivery fails?", keywords: ["failed delivery", "undeliver", "return", "retry", "timeout"] },
  ],
  forbidden: [
    { id: "custom-payments", label: "Building card processing in-house", keywords: ["store card number", "pan storage", "custom card processor"] },
  ],
};

const paymentSystem: Brief = {
  id: "04-payment-system",
  title: "Subscription billing",
  brief:
    "We have a SaaS product and we are adding paid plans. Monthly and annual subscriptions, a free " +
    "trial, the ability to upgrade or downgrade mid-cycle, and we need to handle failed card " +
    "payments without immediately cutting people off. Finance needs to see what we actually earned " +
    "each month.",
  expectedTier: 4,
  componentBudget: { min: 6, max: 14 },
  properties: [
    { id: "webhook-idempotency", severity: "critical", label: "Provider webhooks are idempotent and replay-safe", detect: { any: ["idempot", "replay", "duplicate", "dedup", "exactly once", "event id"] } },
    { id: "webhook-verification", severity: "critical", label: "Webhook signatures are verified — never trust a client-reported payment", detect: { any: ["signature", "verif", "webhook secret", "hmac"] } },
    { id: "subscription-state", severity: "critical", label: "Explicit subscription lifecycle (trialing, active, past due, cancelled)", detect: { any: ["trial", "past due", "past_due", "active", "cancel", "lifecycle", "state machine", "status"] } },
    { id: "dunning", severity: "critical", label: "Failed payments enter retry/grace rather than instant termination", detect: { any: ["dunning", "retry", "grace", "past due", "past_due", "reminder", "recover"] } },
    { id: "ledger", severity: "critical", label: "An auditable financial record separate from subscription state", detect: { any: ["ledger", "invoice", "immutable", "audit", "double entry", "revenue", "accounting"] } },
    { id: "pci-scope", severity: "critical", label: "Card data stays with the provider — PCI scope minimised", detect: { any: ["pci", "tokeni", "never store", "hosted checkout", "checkout session", "vault"] } },
    { id: "proration", severity: "important", label: "Mid-cycle plan changes are prorated", detect: { any: ["prorat", "mid-cycle", "credit", "upgrade", "downgrade"] } },
    { id: "entitlement", severity: "important", label: "Access is derived from billing state", detect: { any: ["entitle", "feature flag", "plan limit", "access", "quota", "gating"] } },
  ],
  ambiguityAreas: [
    { id: "provider", label: "Which provider, and does it serve your region?", keywords: ["stripe", "paddle", "paystack", "provider", "processor"] },
    { id: "tax", label: "Who handles VAT — you or a merchant of record?", keywords: ["tax", "vat", "merchant of record", "compliance"] },
    { id: "refund-policy", label: "Refund and cancellation policy?", keywords: ["refund", "cancel policy", "pro-rata"] },
    { id: "grace-length", label: "How long before access is revoked?", keywords: ["grace", "retry schedule", "revoke", "days"] },
    { id: "currency", label: "Multiple currencies?", keywords: ["currency", "fx", "multi-currency"] },
    { id: "trial-abuse", label: "How do you stop trial abuse?", keywords: ["trial abuse", "fraud", "duplicate account"] },
    { id: "revenue-recognition", label: "How is annual revenue recognised monthly?", keywords: ["revenue recognition", "deferred", "accrual", "mrr", "arr"] },
  ],
  forbidden: [
    { id: "store-cards", label: "Storing raw card numbers", keywords: ["store card", "card number", "cvv", "pan"] },
    { id: "client-trust", label: "Granting access from a client-side success callback", keywords: ["client confirms", "frontend grants", "success redirect grants"] },
  ],
};

const aiSaas: Brief = {
  id: "05-ai-saas",
  title: "AI contract review for lawyers",
  brief:
    "I am a lawyer and I want to build a tool where firms upload contracts and AI flags risky " +
    "clauses, missing indemnities, that kind of thing. The lawyer reviews the flags and exports a " +
    "marked-up report for the client. Confidentiality is the whole ballgame in my industry.",
  expectedTier: 3,
  componentBudget: { min: 6, max: 14 },
  properties: [
    { id: "confidentiality", severity: "critical", label: "Client documents are confidential — encryption and access control are explicit", detect: { any: ["encrypt", "confidential", "privileg", "access control", "isolat", "private"] } },
    { id: "no-training", severity: "critical", label: "Documents must not be used for model training / leak to a provider", detect: { any: ["training", "retention", "zero retention", "data processing", "dpa", "opt out", "no training"] } },
    { id: "async-processing", severity: "critical", label: "Contract analysis is long-running and asynchronous with job state", detect: { any: ["async", "job", "queue", "background", "worker", "status", "progress"] } },
    { id: "document-storage", severity: "critical", label: "Object storage for uploaded contracts, separate from the database", detect: { categories: ["storage"] } },
    { id: "llm-capability", severity: "critical", label: "An LLM is an external dependency with its own failure and cost profile", detect: { any: ["llm", "model", "openai", "anthropic", "claude", "gpt", "gemini", "ai provider"] } },
    { id: "human-review", severity: "critical", label: "The lawyer reviews AI output — it is advisory, never authoritative", detect: { any: ["review", "human", "approve", "verif", "confirm", "flag"] } },
    { id: "audit-trail", severity: "important", label: "Who saw and changed what, for professional liability", detect: { any: ["audit", "trail", "log", "history", "provenance"] } },
    { id: "grounding", severity: "important", label: "Flags cite the clause they came from rather than free-floating claims", detect: { any: ["citation", "cite", "reference", "span", "clause", "excerpt", "ground"] } },
  ],
  ambiguityAreas: [
    { id: "accuracy", label: "What happens when the AI misses something? Liability?", keywords: ["accuracy", "liability", "disclaimer", "false negative", "miss", "error rate"] },
    { id: "retention", label: "How long are client contracts retained?", keywords: ["retention", "delete", "purge", "how long", "archive"] },
    { id: "residency", label: "Where may legal documents be processed?", keywords: ["residency", "region", "jurisdiction", "on-premise", "eu", "local"] },
    { id: "doc-formats", label: "Which formats and how large?", keywords: ["pdf", "docx", "format", "size", "ocr", "scan"] },
    { id: "cost", label: "What does analysing a 200-page contract cost in tokens?", keywords: ["cost", "token", "price", "budget", "spend"] },
    { id: "provider-outage", label: "What if the AI provider is down or rate-limits you?", keywords: ["outage", "rate limit", "fallback", "retry", "degraded"] },
    { id: "conflicts", label: "Conflict-of-interest isolation between firms?", keywords: ["conflict", "tenant", "isolat", "firm", "chinese wall"] },
  ],
  forbidden: [
    { id: "public-model", label: "Sending privileged documents to a consumer chatbot endpoint", keywords: ["chatgpt.com", "consumer", "public chat"] },
  ],
};

const ragApp: Brief = {
  id: "06-rag-app",
  title: "Internal knowledge assistant",
  brief:
    "We want an internal assistant that can answer questions from our company handbook, past " +
    "project docs and Slack history. Staff ask it a question in plain English and it answers with " +
    "a link to where it got the answer. About 200 employees.",
  expectedTier: 3,
  componentBudget: { min: 6, max: 13 },
  properties: [
    { id: "vector-store", severity: "critical", label: "A vector store / semantic index, not just SQL LIKE", detect: { any: ["vector", "embedding", "semantic", "pgvector", "pinecone", "qdrant", "weaviate", "index"] } },
    { id: "ingestion", severity: "critical", label: "An ingestion pipeline that chunks and embeds source documents", detect: { any: ["ingest", "chunk", "embed", "pipeline", "index", "etl", "sync"] } },
    { id: "citations", severity: "critical", label: "Answers cite their source — that is the stated requirement", detect: { any: ["citation", "cite", "source", "link", "reference", "provenance"] } },
    { id: "permission-aware", severity: "critical", label: "Retrieval respects who is allowed to see each document", detect: { any: ["permission", "acl", "access control", "authoriz", "scope", "visibility"] } },
    { id: "llm-capability", severity: "critical", label: "An LLM generates the answer from retrieved context", detect: { any: ["llm", "model", "openai", "anthropic", "claude", "gpt", "gemini"] } },
    { id: "freshness", severity: "important", label: "The index is kept up to date as sources change", detect: { any: ["sync", "refresh", "incremental", "webhook", "schedul", "stale", "re-index", "reindex"] } },
    { id: "eval", severity: "nice", label: "Some way to tell whether answers are actually correct", detect: { any: ["eval", "feedback", "thumbs", "quality", "accuracy", "golden"] } },
  ],
  ambiguityAreas: [
    { id: "permissions", label: "Slack DMs and private channels — who can retrieve what?", keywords: ["permission", "private", "dm", "acl", "visibility", "restricted"] },
    { id: "hallucination", label: "What happens when the answer is not in the corpus?", keywords: ["hallucinat", "i don't know", "no answer", "confidence", "abstain", "refuse"] },
    { id: "freshness-sla", label: "How quickly must new documents become searchable?", keywords: ["freshness", "latency", "real-time", "batch", "nightly", "delay"] },
    { id: "pii-in-corpus", label: "Does the corpus contain HR or personal data?", keywords: ["pii", "hr", "sensitive", "personal", "salary", "confidential"] },
    { id: "cost", label: "Embedding and query cost at 200 employees?", keywords: ["cost", "token", "budget", "spend", "price"] },
    { id: "sources", label: "Which systems, and do they have usable APIs?", keywords: ["api", "connector", "integration", "export", "source system"] },
  ],
  forbidden: [
    { id: "finetune", label: "Fine-tuning a model as the first resort", keywords: ["fine-tune", "finetune", "train our own model"] },
  ],
};

const aiVideoPipeline: Brief = {
  id: "07-ai-video-pipeline",
  title: "AI video generation pipeline",
  brief:
    "I want a product where users type an idea and get back a short social video — AI writes the " +
    "script, generates the visuals, adds a voiceover and music, and stitches it together. Users " +
    "can also upload their own clips to mix in. They download the finished video or post it " +
    "straight to TikTok.",
  expectedTier: 4,
  componentBudget: { min: 8, max: 18 },
  properties: [
    { id: "async-jobs", severity: "critical", label: "Generation is long-running, asynchronous, with job state and progress", detect: { any: ["job", "queue", "async", "worker", "background", "progress", "status", "pipeline"] } },
    { id: "object-storage", severity: "critical", label: "Object storage for uploads and rendered output", detect: { categories: ["storage"] } },
    { id: "large-upload", severity: "critical", label: "User clip upload is handled as a large file, not a form post", detect: { any: ["multipart", "resumable", "presigned", "signed url", "direct upload", "chunk", "large file"] } },
    { id: "provider-failure", severity: "critical", label: "External generation providers fail, time out and rate-limit — handled explicitly", detect: { any: ["retry", "fallback", "timeout", "failure", "rate limit", "circuit", "degrad"] } },
    { id: "cost-control", severity: "critical", label: "Per-user cost/quota control — generation is expensive", detect: { any: ["quota", "cost", "credit", "limit", "budget", "billing", "usage"] } },
    { id: "render-step", severity: "critical", label: "An explicit render/stitch stage (ffmpeg or equivalent)", detect: { any: ["ffmpeg", "render", "stitch", "encode", "transcode", "compos", "mux"] } },
    { id: "delivery", severity: "important", label: "Finished videos are delivered efficiently (CDN / signed URLs)", detect: { any: ["cdn", "signed url", "presigned", "download", "stream", "edge"] } },
    { id: "notification", severity: "important", label: "The user is told when a long job finishes", detect: { any: ["notif", "webhook", "email", "push", "realtime", "subscribe", "poll"] } },
    { id: "moderation", severity: "important", label: "Generated and uploaded content is moderated", detect: { any: ["moderat", "nsfw", "abuse", "safety", "content policy", "filter"] } },
  ],
  ambiguityAreas: [
    { id: "duration", label: "Max video length and resolution?", keywords: ["duration", "length", "resolution", "1080", "4k", "seconds", "aspect"] },
    { id: "providers", label: "Which generation providers, and what are their limits?", keywords: ["provider", "kling", "runway", "veo", "sora", "luma", "pika", "elevenlabs"] },
    { id: "cancel", label: "Can a user cancel a running generation, and are they charged?", keywords: ["cancel", "abort", "refund", "partial charge"] },
    { id: "ownership", label: "Who owns the generated video, and what are the licence terms?", keywords: ["ownership", "licence", "license", "rights", "commercial use", "copyright"] },
    { id: "retention", label: "How long are rendered videos stored?", keywords: ["retention", "expire", "delete", "storage cost", "archive"] },
    { id: "upload-limits", label: "Max size and accepted formats for user clips?", keywords: ["file size", "max size", "format", "codec", "mp4", "mime"] },
    { id: "concurrency", label: "How many generations can run at once, per user and overall?", keywords: ["concurren", "parallel", "throughput", "backlog", "capacity"] },
    { id: "publish-auth", label: "Posting to TikTok needs OAuth and their API limits", keywords: ["oauth", "tiktok api", "publish", "token", "scope", "refresh"] },
  ],
  forbidden: [
    { id: "sync-generation", label: "Generating a video inside a request handler", keywords: ["synchronous generation", "inline render", "request handler render"] },
  ],
};

const automationWorkflow: Brief = {
  id: "08-automation-workflow",
  title: "Lead-handling automation",
  brief:
    "Whenever someone fills in the contact form on our website, I want it to automatically check " +
    "if they are already in our CRM, enrich the record with company info, score the lead, notify " +
    "the right salesperson in Slack, and add them to an email sequence. I use n8n for this kind " +
    "of thing.",
  expectedTier: 2,
  componentBudget: { min: 4, max: 10 },
  properties: [
    { id: "trigger", severity: "critical", label: "An explicit trigger (webhook from the form)", detect: { any: ["trigger", "webhook", "form submit", "event", "entry point"] } },
    { id: "idempotency", severity: "critical", label: "A resubmitted or retried form must not create duplicates", detect: { any: ["idempot", "duplicate", "dedup", "already exists", "upsert", "retry"] } },
    { id: "error-path", severity: "critical", label: "Every external call can fail — explicit error handling, not a happy path", detect: { any: ["error", "retry", "fail", "fallback", "dead letter", "alert", "catch"] } },
    { id: "external-deps", severity: "critical", label: "CRM, enrichment, Slack and email are distinct external dependencies", detect: { any: ["crm", "hubspot", "salesforce", "enrich", "slack", "email", "clearbit", "apollo"] } },
    { id: "credentials", severity: "important", label: "Credentials/secrets are managed, not embedded", detect: { any: ["credential", "secret", "api key", "token", "vault", "env"] } },
    { id: "observability", severity: "important", label: "Failed runs are visible to a human", detect: { any: ["log", "monitor", "alert", "observ", "notify", "dashboard", "audit"] } },
  ],
  ambiguityAreas: [
    { id: "dedupe-key", label: "What identifies a duplicate lead — email, domain, phone?", keywords: ["email", "domain", "dedup", "match", "identity", "key"] },
    { id: "enrichment-fail", label: "What if enrichment returns nothing or is down?", keywords: ["fallback", "partial", "skip", "unavailable", "default", "missing"] },
    { id: "routing", label: "How is the right salesperson chosen?", keywords: ["routing", "round robin", "territory", "assign", "owner", "rule"] },
    { id: "scoring", label: "What actually determines the lead score?", keywords: ["score", "criteria", "weight", "rule", "model", "threshold"] },
    { id: "volume", label: "How many leads per day — does n8n cope?", keywords: ["volume", "rate", "per day", "throughput", "scale", "concurrency"] },
    { id: "consent", label: "Consent and GDPR for adding people to an email sequence", keywords: ["consent", "gdpr", "opt-in", "unsubscribe", "can-spam", "privacy"] },
  ],
  forbidden: [
    { id: "custom-platform", label: "Building a workflow engine instead of using the one they named", keywords: ["build our own orchestrat", "custom workflow engine"] },
  ],
};

const contentPlatform: Brief = {
  id: "09-content-platform",
  title: "Creator publishing platform",
  brief:
    "Think of a publishing platform for independent writers. They write posts, readers subscribe " +
    "to them, some posts are paid-only. Writers get paid monthly based on their subscribers. There " +
    "is a public feed, comments, and email delivery of new posts to subscribers.",
  expectedTier: 4,
  componentBudget: { min: 8, max: 16 },
  properties: [
    { id: "paywall", severity: "critical", label: "Paid content is enforced server-side, not hidden in the client", detect: { any: ["paywall", "entitle", "authoriz", "access control", "subscription check", "gate"] } },
    { id: "subscription-billing", severity: "critical", label: "Recurring subscription billing", detect: { any: ["subscription", "recurring", "billing", "stripe", "plan", "payment"] } },
    { id: "payout", severity: "critical", label: "Writer payouts are modelled separately from reader payments", detect: { any: ["payout", "settle", "disburse", "revenue share", "ledger", "balance", "earnings"] } },
    { id: "email-delivery", severity: "critical", label: "Bulk email delivery is asynchronous and rate-aware", detect: { any: ["email", "queue", "batch", "async", "deliver", "resend", "sendgrid", "ses"] } },
    { id: "read-scaling", severity: "important", label: "Public reads are cached or served from the edge", detect: { any: ["cache", "cdn", "static", "isr", "edge", "read replica"] } },
    { id: "moderation", severity: "important", label: "Comments need moderation and abuse handling", detect: { any: ["moderat", "spam", "abuse", "report", "flag", "block"] } },
    { id: "media", severity: "important", label: "Post images/media live in object storage", detect: { categories: ["storage"] } },
  ],
  ambiguityAreas: [
    { id: "payout-threshold", label: "Minimum payout, schedule and fees?", keywords: ["threshold", "minimum", "schedule", "fee", "monthly", "payout"] },
    { id: "tax-forms", label: "Tax reporting obligations for paying writers?", keywords: ["tax", "1099", "w-9", "vat", "withhold", "report"] },
    { id: "refunds", label: "Reader refunds — who bears the cost, you or the writer?", keywords: ["refund", "chargeback", "clawback", "dispute"] },
    { id: "content-ownership", label: "Who owns the content if a writer leaves?", keywords: ["ownership", "export", "leave", "portab", "rights", "delete"] },
    { id: "email-volume", label: "Deliverability and volume at scale?", keywords: ["deliverab", "spam", "volume", "rate limit", "reputation", "bounce"] },
    { id: "free-preview", label: "How much of a paid post is publicly visible?", keywords: ["preview", "excerpt", "teaser", "seo", "partial"] },
  ],
  forbidden: [
    { id: "client-paywall", label: "Enforcing the paywall in the browser only", keywords: ["hide in css", "client-side paywall", "frontend only"] },
  ],
};

const reverseEngineer: Brief = {
  id: "10-reverse-engineer",
  title: "Reverse-engineer an existing product",
  brief:
    "Look at https://linear.app and design the system architecture behind it. I want to understand " +
    "how a product like that is actually built so I can build something similar for a different " +
    "industry.",
  expectedTier: 4,
  componentBudget: { min: 8, max: 18 },
  properties: [
    { id: "realtime-sync", severity: "critical", label: "Real-time collaborative sync is the defining characteristic", detect: { any: ["realtime", "real-time", "sync", "websocket", "crdt", "live", "collaborat", "subscription"] } },
    { id: "offline-local", severity: "important", label: "Local-first / optimistic updates, not request-response CRUD", detect: { any: ["local-first", "offline", "optimistic", "cache", "local store", "client store", "indexeddb"] } },
    { id: "auth-teams", severity: "critical", label: "Workspace/team scoping and authorization", detect: { any: ["workspace", "team", "organization", "tenant", "permission", "role", "authoriz"] } },
    { id: "persistence", severity: "critical", label: "A durable primary datastore", detect: { categories: ["database"] } },
    { id: "search", severity: "important", label: "Search across issues", detect: { any: ["search", "index", "elastic", "full text", "query"] } },
    { id: "integrations", severity: "important", label: "Third-party integrations (GitHub, Slack) as external dependencies", detect: { any: ["github", "slack", "integration", "webhook", "oauth", "api"] } },
    { id: "notifications", severity: "important", label: "Notification delivery", detect: { any: ["notif", "email", "push", "inbox", "alert"] } },
  ],
  ambiguityAreas: [
    { id: "evidence-vs-guess", label: "Which parts are observed versus inferred?", keywords: ["inferred", "observed", "evidence", "assum", "likely", "unknown", "confiden"] },
    { id: "scale", label: "What scale is this design actually for?", keywords: ["scale", "users", "throughput", "capacity", "growth"] },
    { id: "conflict-resolution", label: "How are concurrent edits reconciled?", keywords: ["conflict", "crdt", "operational transform", "merge", "last write", "version"] },
    { id: "data-model", label: "What is the core domain model?", keywords: ["issue", "project", "entity", "model", "schema", "relationship"] },
    { id: "differences", label: "What must change for a different industry?", keywords: ["differ", "adapt", "instead", "your industry", "vary"] },
  ],
  forbidden: [],
};

export const BRIEFS: Brief[] = [
  crudInternalTool,
  multiTenantSaas,
  marketplace,
  paymentSystem,
  aiSaas,
  ragApp,
  aiVideoPipeline,
  automationWorkflow,
  contentPlatform,
  reverseEngineer,
];

export function getBrief(id: string): Brief | undefined {
  return BRIEFS.find((b) => b.id === id);
}

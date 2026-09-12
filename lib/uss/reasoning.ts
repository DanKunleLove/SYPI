import type { CapabilityClass } from "@/lib/capabilities/registry";
import { UssGraph } from "@/lib/uss/graph";
import { capabilities, constraints, nonFunctional, requirements, actors } from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";

/**
 * The implication rulebook — the missing middle of the reasoning chain.
 *
 *   requirement → IMPLICATION → capability → decision → component → technology
 *
 * "Users upload 2GB videos" does not imply S3. It implies that an upload exceeds a
 * single request (so: resumable multipart), that processing exceeds a request
 * timeout (so: async work with job state), that the user needs to know it is
 * working (so: progress), and that any of it can fail (so: recovery). THOSE imply
 * object storage and a queue.
 *
 * Encoding this as rules rather than asking a model matters for three reasons:
 * it is free, it is reproducible, and it cannot forget. The baseline's worst
 * failure — a marketplace with 26 components that still omitted payment
 * idempotency and an order state machine — is precisely a model forgetting
 * something a rule would never miss.
 */

export interface ImplicationDraft {
  statement: string;
  trigger: string;
  demands: CapabilityClass[];
  /** Higher runs first when trimming to a budget. */
  weight: number;
}

export interface ImplicationRule {
  id: string;
  /** Does this rule apply to the current spec? */
  when: (doc: Uss, ctx: RuleContext) => boolean;
  derive: (doc: Uss, ctx: RuleContext) => ImplicationDraft[];
}

interface RuleContext {
  caps: Set<CapabilityClass>;
  tier: number;
  /** Lowercased concatenation of every requirement and constraint statement. */
  text: string;
}

function buildContext(doc: Uss): RuleContext {
  const caps = new Set(capabilities(doc).map((c) => c.capabilityClass as CapabilityClass));
  const text = [
    ...requirements(doc).map((r) => `${r.title} ${r.statement}`),
    ...nonFunctional(doc).map((r) => `${r.title} ${r.statement} ${r.target ?? ""}`),
    ...constraints(doc).map((c) => c.statement),
  ]
    .join(" ")
    .toLowerCase();
  return { caps, tier: doc.complexity.tier, text };
}

const has = (ctx: RuleContext, ...c: CapabilityClass[]) => c.some((x) => ctx.caps.has(x));
const mentions = (ctx: RuleContext, ...terms: string[]) =>
  terms.some((t) => ctx.text.includes(t));

export const IMPLICATION_RULES: ImplicationRule[] = [
  // ── Large uploads: the canonical example ───────────────────────────────────
  {
    id: "large-uploads",
    when: (_d, ctx) =>
      has(ctx, "OBJECT_STORAGE") ||
      mentions(ctx, "upload", "video file", "attachment", "document upload"),
    derive: (_d, ctx) => {
      const large = mentions(ctx, "gb", "large file", "video", "hd", "4k", "raw");
      const out: ImplicationDraft[] = [
        {
          statement: "Uploaded files are stored outside the database, addressed by key",
          trigger: "The system accepts file uploads",
          demands: ["OBJECT_STORAGE"],
          weight: 9,
        },
        {
          statement: "Upload access is granted by short-lived signed URLs rather than proxying bytes through the application",
          trigger: "Files must be private to their owner",
          demands: ["OBJECT_STORAGE", "AUTHZ"],
          weight: 7,
        },
      ];
      if (large) {
        out.push(
          {
            statement: "Uploads exceed what one request can carry, so they must be resumable and chunked (multipart)",
            trigger: "Files are large enough that a single request would time out or fail",
            demands: ["OBJECT_STORAGE"],
            weight: 10,
          },
          {
            statement: "Processing a large file exceeds a request timeout, so it runs as a background job with persisted state",
            trigger: "Large file processing cannot complete inside a web request",
            demands: ["QUEUE"],
            weight: 10,
          },
          {
            statement: "The user must be able to see progress and be told when the job finishes or fails",
            trigger: "Work happens after the request returns",
            demands: ["QUEUE"],
            weight: 8,
          },
          {
            statement: "A failed or interrupted upload must be resumable or cleanly discarded, never left half-written",
            trigger: "Long uploads fail routinely",
            demands: ["OBJECT_STORAGE"],
            weight: 8,
          }
        );
      }
      return out;
    },
  },

  // ── Money ──────────────────────────────────────────────────────────────────
  {
    id: "payments",
    when: (_d, ctx) => has(ctx, "PAYMENTS") || mentions(ctx, "payment", "checkout", "subscription", "billing", "pay out"),
    derive: () => [
      {
        statement: "Payment provider notifications can arrive more than once, so every handler must be idempotent and produce exactly one business effect",
        trigger: "Webhooks are retried by the provider",
        demands: ["PAYMENTS", "RELATIONAL_STORE"],
        weight: 10,
      },
      {
        statement: "Incoming payment notifications must be signature-verified; a client-reported success is never sufficient to grant value",
        trigger: "Money changes hands based on an external message",
        demands: ["PAYMENTS"],
        weight: 10,
      },
      {
        statement: "Money movement needs an append-only record that is separate from mutable order or subscription state",
        trigger: "Finance must be able to audit what was actually earned",
        demands: ["RELATIONAL_STORE"],
        weight: 9,
      },
      {
        statement: "Card data stays with the provider; the system stores only a token, to keep PCI scope minimal",
        trigger: "The system takes card payments",
        demands: ["PAYMENTS"],
        weight: 9,
      },
      {
        statement: "Payment succeeding while fulfilment fails must have a defined outcome — compensate, retry, or refund",
        trigger: "Two systems must agree and either can fail",
        demands: ["QUEUE"],
        weight: 8,
      },
    ],
  },

  // ── Stock and other finite resources ───────────────────────────────────────
  {
    id: "finite-inventory",
    when: (_d, ctx) => mentions(ctx, "inventory", "stock", "seat", "ticket", "booking", "slot", "availability"),
    derive: () => [
      {
        statement: "A finite resource can be claimed by two people at once, so allocation must be atomic or reserved — it must never go negative",
        trigger: "The system allocates something there is a limited amount of",
        demands: ["RELATIONAL_STORE"],
        weight: 10,
      },
      {
        statement: "A reservation that is never completed must expire and return the resource",
        trigger: "Holding a resource without completing the purchase",
        demands: ["SCHEDULER"],
        weight: 7,
      },
    ],
  },

  // ── Lifecycles ─────────────────────────────────────────────────────────────
  {
    id: "order-lifecycle",
    when: (_d, ctx) => mentions(ctx, "order", "booking", "request", "application", "ticket", "claim", "shipment"),
    derive: () => [
      {
        statement: "The item moves through named states with defined legal transitions; impossible moves (such as cancelled to shipped) must be rejected rather than merely avoided",
        trigger: "A record progresses through stages over time",
        demands: ["RELATIONAL_STORE"],
        weight: 9,
      },
    ],
  },

  // ── Several kinds of user ──────────────────────────────────────────────────
  {
    id: "multi-actor-authz",
    when: (d, ctx) => actors(d).filter((a) => a.isHuman).length >= 2 || has(ctx, "AUTHZ"),
    derive: (d) => {
      const names = actors(d).filter((a) => a.isHuman).map((a) => a.title);
      return [
        {
          statement: `Authorization is decided per request, not per screen: ${names.slice(0, 3).join(", ")} must not be able to reach each other's data by calling the API directly`,
          trigger: "The system has more than one kind of user",
          demands: ["AUTHZ", "AUTH"],
          weight: 10,
        },
      ];
    },
  },

  // ── Multi-tenancy ──────────────────────────────────────────────────────────
  {
    id: "tenant-isolation",
    when: (_d, ctx) => mentions(ctx, "organisation", "organization", "company", "team", "tenant", "workspace", "firm", "each business"),
    derive: () => [
      {
        statement: "Every query that reads customer data must be scoped by tenant at a level that cannot be forgotten — a missing filter must fail closed, not return everything",
        trigger: "Several separate customers share one system",
        demands: ["AUTHZ", "RELATIONAL_STORE"],
        weight: 10,
      },
      {
        statement: "Deleting or exporting one customer's data must be possible without touching another's",
        trigger: "Customers can leave and may demand their data",
        demands: ["RELATIONAL_STORE"],
        weight: 7,
      },
    ],
  },

  // ── AI generation ──────────────────────────────────────────────────────────
  {
    id: "generative-work",
    when: (_d, ctx) => has(ctx, "VIDEO_GEN", "IMAGE_GEN", "AUDIO_GEN", "LLM"),
    derive: (_d, ctx) => {
      const slow = has(ctx, "VIDEO_GEN", "AUDIO_GEN");
      const out: ImplicationDraft[] = [
        {
          statement: "Generation cost scales with usage, so per-user quota or credit accounting is required before launch, not after",
          trigger: "Each request costs real money to serve",
          demands: ["RELATIONAL_STORE"],
          weight: 9,
        },
        {
          statement: "The generation provider will be slow, rate-limited or down; the system needs retries, a timeout and a defined user-facing outcome",
          trigger: "A core capability is provided by a third party",
          demands: [],
          weight: 9,
        },
        {
          statement: "Generated output is not trustworthy by default and needs review, citation, or an explicit limitation shown to the user",
          trigger: "A model produces content the user will act on",
          demands: [],
          weight: 8,
        },
      ];
      if (slow) {
        out.push({
          statement: "Generation takes minutes, so it must run as a background job with persisted state and a way to notify the user on completion",
          trigger: "Generation cannot complete inside a web request",
          demands: ["QUEUE", "OBJECT_STORAGE"],
          weight: 10,
        });
      }
      return out;
    },
  },

  // ── Retrieval over private content ─────────────────────────────────────────
  {
    id: "retrieval",
    when: (_d, ctx) => has(ctx, "VECTOR_SEARCH", "EMBEDDING"),
    derive: () => [
      {
        statement: "Source content must be ingested, chunked and embedded by a pipeline that re-runs when the source changes",
        trigger: "Answers are drawn from documents that change",
        demands: ["VECTOR_SEARCH", "QUEUE"],
        weight: 9,
      },
      {
        statement: "Retrieval must filter by what the asker is allowed to see BEFORE the model sees it; filtering the answer afterwards leaks content",
        trigger: "Not everyone may see every document",
        demands: ["AUTHZ"],
        weight: 10,
      },
      {
        statement: "Answers must cite the source they came from, and the system must be able to say it does not know",
        trigger: "A confident wrong answer is worse than no answer",
        demands: [],
        weight: 8,
      },
    ],
  },

  // ── Live collaboration ─────────────────────────────────────────────────────
  {
    id: "realtime",
    when: (_d, ctx) => has(ctx, "REALTIME_SYNC") || mentions(ctx, "real-time", "realtime", "collaborat", "simultaneous", "live"),
    derive: () => [
      {
        statement: "Two people editing at once need a defined conflict resolution strategy; last-write-wins silently destroys work",
        trigger: "Several people change the same thing concurrently",
        demands: ["REALTIME_SYNC"],
        weight: 10,
      },
    ],
  },

  // ── Bulk messaging ─────────────────────────────────────────────────────────
  {
    id: "bulk-email",
    when: (_d, ctx) => has(ctx, "EMAIL") && mentions(ctx, "subscriber", "newsletter", "bulk", "campaign", "broadcast", "all users"),
    derive: () => [
      {
        statement: "Sending to many recipients must be queued and rate-aware; a single burst damages deliverability for everything else",
        trigger: "Messages go to a large list at once",
        demands: ["QUEUE", "EMAIL"],
        weight: 9,
      },
      {
        statement: "Every bulk message needs an unsubscribe path and a record of consent",
        trigger: "Marketing messages are legally regulated in most jurisdictions",
        demands: ["RELATIONAL_STORE"],
        weight: 8,
      },
    ],
  },

  // ── Scale ──────────────────────────────────────────────────────────────────
  {
    id: "read-scaling",
    when: (d, ctx) => ctx.tier >= 3 && mentions(ctx, "public", "feed", "browse", "catalog", "catalogue", "seo") && d.complexity.budget.allowCaching,
    derive: () => [
      {
        statement: "Public reads vastly outnumber writes and should be served from a cache or the edge rather than the primary database",
        trigger: "Anonymous traffic reads the same content repeatedly",
        demands: ["CDN", "CACHE"],
        weight: 7,
      },
    ],
  },

  // ── Operability ────────────────────────────────────────────────────────────
  {
    id: "background-work-visibility",
    when: (_d, ctx) => has(ctx, "QUEUE", "SCHEDULER", "WORKFLOW_ENGINE"),
    derive: () => [
      {
        statement: "Work that happens out of sight needs failure alerting and a retry policy, or it stops silently and nobody notices",
        trigger: "The system does work no user is watching",
        demands: ["OBSERVABILITY"],
        weight: 8,
      },
    ],
  },
];

/** Run the rulebook. Pure, free, reproducible. */
export function deriveImplications(doc: Uss): ImplicationDraft[] {
  const ctx = buildContext(doc);
  const out: ImplicationDraft[] = [];

  for (const rule of IMPLICATION_RULES) {
    if (!rule.when(doc, ctx)) continue;
    out.push(...rule.derive(doc, ctx));
  }

  // De-duplicate by statement, keeping the highest weight.
  const byStatement = new Map<string, ImplicationDraft>();
  for (const d of out) {
    const key = d.statement.toLowerCase().slice(0, 80);
    const existing = byStatement.get(key);
    if (!existing || d.weight > existing.weight) byStatement.set(key, d);
  }

  return [...byStatement.values()].sort((a, b) => b.weight - a.weight);
}

/**
 * Write implications into the graph, linking each to the requirements that
 * triggered it and to the capabilities it demands. Capabilities that do not yet
 * exist are created, because an implication that demands something the spec does
 * not have is exactly the gap worth surfacing.
 */
export function applyImplications(
  doc: Uss,
  drafts: (ImplicationDraft & { source?: "rule" | "model" })[],
  version: number
): Uss {
  const g = new UssGraph(doc);
  const reqs = g.byKind("requirement");
  const capsByClass = new Map(
    g.byKind("capability").map((c) => [c.capabilityClass as string, c])
  );

  for (const draft of drafts) {
    const existing = g
      .byKind("implication")
      .find((i) => i.statement.toLowerCase() === draft.statement.toLowerCase());
    if (existing) continue;

    const source = draft.source ?? "rule";
    const implication = g.add("implication", {
      title: draft.statement.slice(0, 120),
      statement: draft.statement,
      trigger: draft.trigger,
      source,
      demands: draft.demands,
      status: "INFERRED",
      // A rule is reproducible; a model guess is not. The confidence says so.
      confidence: source === "rule" ? 0.9 : 0.65,
      evidence: [{ kind: source === "rule" ? "rule" : "inference" }],
      firstSeenVersion: version,
    });

    // Trace back to the requirements whose words triggered this rule.
    const triggerWords = draft.trigger.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    for (const req of reqs) {
      const haystack = `${req.title} ${req.statement}`.toLowerCase();
      if (triggerWords.some((w) => haystack.includes(w))) {
        g.link("implies", req.id, implication.id, {
          status: "INFERRED",
          confidence: 0.7,
          evidence: [{ kind: "rule" }],
          firstSeenVersion: version,
        });
      }
    }

    // Forward to the capabilities it demands, creating any that are missing.
    for (const demanded of draft.demands) {
      let cap = capsByClass.get(demanded);
      if (!cap) {
        cap = g.add("capability", {
          title: demanded,
          capabilityClass: demanded as never,
          why: draft.statement.slice(0, 300),
          status: "INFERRED",
          confidence: 0.7,
          evidence: [{ kind: "rule" }],
          firstSeenVersion: version,
        });
        capsByClass.set(demanded, cap);
      }
      g.link("requires", implication.id, cap.id, {
        status: "INFERRED",
        confidence: 0.8,
        evidence: [{ kind: "rule" }],
        firstSeenVersion: version,
      });
    }
  }

  return g.snapshot();
}

/** Share of implications that came from rules rather than a model. */
export function ruleCoverage(doc: Uss): { total: number; fromRules: number; pct: number } {
  const implications = new UssGraph(doc).byKind("implication");
  const fromRules = implications.filter((i) => i.source === "rule").length;
  return {
    total: implications.length,
    fromRules,
    pct: implications.length === 0 ? 0 : Math.round((fromRules / implications.length) * 100),
  };
}

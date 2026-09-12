import type { EntityKind, Relation, RelationType } from "@/lib/uss/schema";

/**
 * Stable, human-readable entity ids.
 *
 * They are human-readable on purpose: they appear verbatim in the generated
 * System Kit ("Open question OPN-003"), so a person reading the kit can trace a
 * question back to the spec. They are also NEVER REUSED — a superseded decision
 * keeps its id and the new one gets a fresh number, which is what lets version
 * diffing and `supersedes` chains work.
 */

const PREFIX: Record<EntityKind, string> = {
  product: "PRD",
  actor: "ACT",
  requirement: "REQ",
  constraint: "CON",
  assumption: "ASM",
  unknown: "UNK",
  useCase: "UCS",
  capability: "CAP",
  component: "CMP",
  decision: "DEC",
  openDecision: "OPN",
  term: "TRM",
  implication: "IMP",
  tradeoff: "TRD",
  domainEntity: "DOM",
  invariant: "INV",
  state: "STA",
  transition: "TRN",
  workflow: "WFL",
  finding: "FND",
};

export function prefixFor(kind: EntityKind): string {
  return PREFIX[kind];
}

/** Slugify a label into an id suffix: "Video Generation" → "video-generation". */
export function slugify(label: string, max = 40): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "x";
}

/**
 * Allocate ids that do not collide with anything already in the graph.
 *
 * Numeric for most kinds (REQ-001). Slugged for capabilities (CAP-video-gen),
 * because a capability's identity IS its class and a stable slug makes the graph
 * far easier to read in a diff.
 */
export class IdAllocator {
  private used: Set<string>;
  private counters = new Map<EntityKind, number>();

  constructor(existingIds: Iterable<string> = []) {
    this.used = new Set(existingIds);
  }

  has(id: string): boolean {
    return this.used.has(id);
  }

  /** Reserve a specific id (used when re-hydrating or importing). */
  reserve(id: string): void {
    this.used.add(id);
  }

  next(kind: EntityKind): string {
    const prefix = PREFIX[kind];
    let n = this.counters.get(kind) ?? 0;
    let id: string;
    do {
      n += 1;
      id = `${prefix}-${String(n).padStart(3, "0")}`;
    } while (this.used.has(id));
    this.counters.set(kind, n);
    this.used.add(id);
    return id;
  }

  /** Slugged id, falling back to a numeric suffix on collision. */
  slug(kind: EntityKind, label: string): string {
    const prefix = PREFIX[kind];
    const base = `${prefix}-${slugify(label)}`;
    if (!this.used.has(base)) {
      this.used.add(base);
      return base;
    }
    let n = 2;
    while (this.used.has(`${base}-${n}`)) n += 1;
    const id = `${base}-${n}`;
    this.used.add(id);
    return id;
  }
}

/**
 * Relation ids are derived from their endpoints, so the same edge asserted twice
 * is the same relation rather than a duplicate. Deterministic by design.
 */
export function relationId(type: RelationType, from: string, to: string): string {
  return `${type}:${from}>${to}`;
}

export function isSameRelation(a: Relation, b: Relation): boolean {
  return a.type === b.type && a.from === b.from && a.to === b.to;
}

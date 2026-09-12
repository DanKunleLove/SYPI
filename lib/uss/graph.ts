import { IdAllocator, relationId } from "@/lib/uss/ids";
import type {
  Entity,
  EntityKind,
  EpistemicStatus,
  Evidence,
  Relation,
  RelationType,
  Uss,
} from "@/lib/uss/schema";

/**
 * Graph operations over a USS.
 *
 * Everything here is pure: take a doc, return a new doc. No database, no model.
 * The graph is the only place entities and relations are created, so id
 * allocation, deduplication and provenance defaults live in exactly one place.
 */

export class UssGraph {
  private doc: Uss;
  private ids: IdAllocator;
  private index: Map<string, Entity>;

  constructor(doc: Uss) {
    // Clone so callers never mutate the document they passed in.
    this.doc = structuredClone(doc);
    this.index = new Map(this.doc.entities.map((e) => [e.id, e]));
    this.ids = new IdAllocator(this.index.keys());
  }

  get version(): number {
    return this.doc.meta.lastExtractedAt ? 1 : 1;
  }

  snapshot(): Uss {
    return structuredClone(this.doc);
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  get(id: string): Entity | undefined {
    return this.index.get(id);
  }

  all(): Entity[] {
    return this.doc.entities;
  }

  byKind<K extends EntityKind>(kind: K): Extract<Entity, { kind: K }>[] {
    return this.doc.entities.filter((e) => e.kind === kind) as Extract<Entity, { kind: K }>[];
  }

  relations(): Relation[] {
    return this.doc.relations;
  }

  /** Relations of a type leaving an entity. */
  from(id: string, type?: RelationType): Relation[] {
    return this.doc.relations.filter((r) => r.from === id && (!type || r.type === type));
  }

  /** Relations of a type arriving at an entity. */
  to(id: string, type?: RelationType): Relation[] {
    return this.doc.relations.filter((r) => r.to === id && (!type || r.type === type));
  }

  /** Entities reachable from `id` by one hop of `type`. */
  neighbours(id: string, type: RelationType): Entity[] {
    return this.from(id, type)
      .map((r) => this.index.get(r.to))
      .filter((e): e is Entity => Boolean(e));
  }

  /** Entities that point AT `id` by one hop of `type`. */
  sources(id: string, type: RelationType): Entity[] {
    return this.to(id, type)
      .map((r) => this.index.get(r.from))
      .filter((e): e is Entity => Boolean(e));
  }

  hasRelation(type: RelationType, from: string, to: string): boolean {
    return this.doc.relations.some((r) => r.type === type && r.from === from && r.to === to);
  }

  // ─── Writes ────────────────────────────────────────────────────────────────

  /**
   * Add an entity, allocating its id. Capabilities get a stable slug because a
   * capability's identity is its class; everything else gets a sequence number.
   */
  add<K extends EntityKind>(
    kind: K,
    fields: Omit<Extract<Entity, { kind: K }>, "id" | "kind">
  ): Extract<Entity, { kind: K }> {
    const id =
      kind === "capability"
        ? this.ids.slug(kind, (fields as { capabilityClass?: string }).capabilityClass ?? fields.title)
        : this.ids.next(kind);

    const entity = { ...fields, id, kind } as Extract<Entity, { kind: K }>;
    this.doc.entities.push(entity);
    this.index.set(id, entity);
    return entity;
  }

  /** Add only if no entity of this kind already has the same title (case-insensitive). */
  addUnique<K extends EntityKind>(
    kind: K,
    fields: Omit<Extract<Entity, { kind: K }>, "id" | "kind">
  ): Extract<Entity, { kind: K }> {
    const existing = this.byKind(kind).find(
      (e) => e.title.trim().toLowerCase() === fields.title.trim().toLowerCase()
    );
    if (existing) return existing;
    return this.add(kind, fields);
  }

  update(id: string, patch: Partial<Entity>): Entity | undefined {
    const current = this.index.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, id: current.id, kind: current.kind } as Entity;
    const i = this.doc.entities.findIndex((e) => e.id === id);
    this.doc.entities[i] = next;
    this.index.set(id, next);
    return next;
  }

  remove(id: string): void {
    this.doc.entities = this.doc.entities.filter((e) => e.id !== id);
    // A relation whose endpoint is gone would fail schema validation, so removing
    // an entity must remove its edges too.
    this.doc.relations = this.doc.relations.filter((r) => r.from !== id && r.to !== id);
    this.index.delete(id);
  }

  /**
   * Link two entities. Silently no-ops when either endpoint is missing or the
   * edge already exists — deduplication is the caller's expectation, and a
   * dangling edge would be rejected at parse time anyway.
   */
  link(
    type: RelationType,
    from: string,
    to: string,
    provenance: {
      status: EpistemicStatus;
      confidence: number;
      evidence?: Evidence[];
      firstSeenVersion: number;
      note?: string;
    }
  ): Relation | undefined {
    if (!this.index.has(from) || !this.index.has(to)) return undefined;
    if (this.hasRelation(type, from, to)) return undefined;

    const relation: Relation = {
      id: relationId(type, from, to),
      type,
      from,
      to,
      note: provenance.note,
      status: provenance.status,
      confidence: provenance.confidence,
      evidence: provenance.evidence ?? [],
      firstSeenVersion: provenance.firstSeenVersion,
    };
    this.doc.relations.push(relation);
    return relation;
  }

  unlink(type: RelationType, from: string, to: string): void {
    this.doc.relations = this.doc.relations.filter(
      (r) => !(r.type === type && r.from === from && r.to === to)
    );
  }

  // ─── Traceability ──────────────────────────────────────────────────────────

  /**
   * Why does this component exist?
   *   component --satisfies--> requirement <--causedBy-- decision
   *
   * This is the query the whole graph design exists to make possible, and the
   * answer to the audit's demand that every decision explain itself.
   */
  justificationFor(componentId: string): {
    requirements: Entity[];
    decisions: Entity[];
    capabilities: Entity[];
  } {
    const requirements = this.neighbours(componentId, "satisfies");
    const capabilities = this.neighbours(componentId, "realizes");
    const decisions = this.sources(componentId, "decides");
    return { requirements, decisions, capabilities };
  }

  /** Components with no `satisfies` edge — the primary anti-inflation signal. */
  orphanComponents(): Entity[] {
    return this.byKind("component").filter((c) => this.from(c.id, "satisfies").length === 0);
  }
}

/** Convenience: run a mutation and get the new document back. */
export function mutate(doc: Uss, fn: (g: UssGraph) => void): Uss {
  const g = new UssGraph(doc);
  fn(g);
  return g.snapshot();
}

import type { ArchitectureNode, ArchitectureOutput } from "@/lib/ai/schemas";
import { getCapability } from "@/lib/capabilities/registry";
import { UssGraph } from "@/lib/uss/graph";
import { capabilities, requirements } from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";

/**
 * Generated architecture → USS. Deterministic, zero model calls.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * The generate route produced an architecture and streamed it to the canvas, and
 * that was the end of it. Components only ever entered the spec later, via the
 * canvas-save reconcile. So at no point in the pipeline did the USS see the
 * architecture the model had just written: scenarios, integrity checks and the
 * health bar were all evaluated against a document with zero components. Every
 * structural verdict was necessarily empty, and the ones that were not empty were
 * reading the rulebook's own output back to itself.
 *
 * Writing the architecture into the spec immediately is what makes structural
 * proof possible at all.
 *
 * Matching is by lowercased title — the same key `reconcileCanvasIntoSpec` uses,
 * and `placeArchitectureOnCanvas` preserves the label — so the later canvas sync
 * binds `canvasNodeId` onto these same components instead of duplicating them.
 */

/**
 * Config the canvas carries but `ComponentEntity` has no field for.
 *
 * These are load-bearing for structural proof: "replication=Read replica" and
 * "rateLimit=100/min" are exactly the evidence the durability and cost scenarios
 * look for, and collapsing them to nothing was throwing away the design's own
 * answer. Appended to the responsibility rather than added as schema fields —
 * additive, backward-compatible, and it reads naturally in the Kit exports.
 */
const CARRIED_CONFIG: { key: keyof ArchitectureNode; label: string }[] = [
  { key: "configReplication", label: "replication" },
  { key: "configRateLimit", label: "rate limit" },
  { key: "configAuthMethod", label: "auth" },
  { key: "configCacheType", label: "cache" },
  { key: "configQueueType", label: "queue" },
  { key: "configTtl", label: "ttl" },
  { key: "configScaling", label: "scaling" },
  { key: "configStorageType", label: "storage" },
];

/** A component's description plus the config fields the entity has no home for. */
export function describeComponent(
  description: string,
  config: Partial<Record<keyof ArchitectureNode, string | undefined>>
): string {
  const extras = CARRIED_CONFIG.map(({ key, label }) => {
    const value = config[key];
    return value ? `${label}=${value}` : null;
  }).filter((x): x is string => x !== null);

  if (extras.length === 0) return description;
  return description ? `${description} (${extras.join(", ")})` : `(${extras.join(", ")})`;
}

export interface ApplyArchitectureResult {
  doc: Uss;
  added: number;
  updated: number;
}

export function applyArchitectureToSpec(
  doc: Uss,
  arch: ArchitectureOutput,
  version: number,
  generationRef = "generation"
): ApplyArchitectureResult {
  const g = new UssGraph(doc);
  let added = 0;
  let updated = 0;

  const byTitle = new Map(g.byKind("component").map((c) => [c.title.trim().toLowerCase(), c]));
  const labelToId = new Map<string, string>();

  // ── Components ─────────────────────────────────────────────────────────────
  for (const node of arch.nodes) {
    const label = node.label.trim();
    if (!label) continue;

    const responsibility = describeComponent(node.description ?? "", node);
    const technology = node.configTechnology ?? node.configDbType ?? node.configFramework;
    const existing = byTitle.get(label.toLowerCase());

    if (existing) {
      g.update(existing.id, {
        category: node.category,
        responsibility: responsibility || existing.responsibility,
        technology: technology ?? existing.technology,
        orphaned: false,
      });
      labelToId.set(label, existing.id);
      updated++;
      continue;
    }

    // INFERRED, never KNOWN: a model proposed this. The canvas reconcile promotes
    // it to KNOWN once a human has seen it and saved.
    const created = g.add("component", {
      title: label,
      category: node.category,
      responsibility,
      technology,
      orphaned: false,
      status: "INFERRED",
      confidence: 0.7,
      evidence: [{ kind: "inference", ref: generationRef, quote: label }],
      firstSeenVersion: version,
    });
    labelToId.set(label, created.id);
    byTitle.set(label.toLowerCase(), created);
    added++;
  }

  // ── Dependencies (the canvas edges) ────────────────────────────────────────
  for (const edge of arch.edges) {
    const from = labelToId.get(edge.sourceLabel.trim());
    const to = labelToId.get(edge.targetLabel.trim());
    if (!from || !to || from === to) continue;
    if (g.hasRelation("dependsOn", from, to)) continue;
    g.link("dependsOn", from, to, {
      note: edge.label?.slice(0, 200),
      status: "INFERRED",
      confidence: 0.7,
      evidence: [{ kind: "inference", ref: generationRef }],
      firstSeenVersion: version,
    });
  }

  // ── realizes: capability → the component of its software category ──────────
  const snapshot = g.snapshot();
  for (const cap of capabilities(snapshot)) {
    const def = getCapability(cap.capabilityClass);
    if (!def?.softwareCategory) continue;
    const match = [...labelToId.values()]
      .map((id) => g.get(id))
      .find((c) => c && c.kind === "component" && c.category === def.softwareCategory);
    if (!match) continue;
    if (g.hasRelation("realizes", match.id, cap.id)) continue;
    g.link("realizes", match.id, cap.id, {
      status: "INFERRED",
      confidence: 0.5,
      evidence: [{ kind: "inference", ref: generationRef }],
      firstSeenVersion: version,
    });
  }

  // ── satisfies: conservative word overlap, marked low-confidence ────────────
  //
  // Deliberately weak. A component that traces to nothing must show up as an
  // orphan, and inventing a `satisfies` edge to keep the graph tidy would defeat
  // the single most useful anti-inflation check in the system. Confidence 0.5 and
  // INFERRED, so nothing downstream mistakes it for a stated fact.
  const reqs = requirements(snapshot);
  for (const [label, componentId] of labelToId) {
    const words = new Set(
      label
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3)
    );
    if (words.size === 0) continue;

    for (const req of reqs) {
      const text = `${req.title} ${req.statement}`.toLowerCase();
      const hits = [...words].filter((w) => text.includes(w));
      if (hits.length === 0) continue;
      if (g.hasRelation("satisfies", componentId, req.id)) continue;
      g.link("satisfies", componentId, req.id, {
        status: "INFERRED",
        confidence: 0.5,
        evidence: [{ kind: "inference", ref: generationRef, quote: hits.join(", ") }],
        firstSeenVersion: version,
      });
    }
  }

  return { doc: g.snapshot(), added, updated };
}

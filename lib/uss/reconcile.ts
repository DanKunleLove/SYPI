import { describeComponent } from "@/lib/uss/architecture";
import { UssGraph } from "@/lib/uss/graph";
import type { Uss } from "@/lib/uss/schema";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

/**
 * Canvas → USS. Fully deterministic, ZERO LLM calls.
 *
 * The ownership rule: the USS owns semantics (what a component is, why it exists,
 * what depends on it); the canvas owns layout. A canvas edit is therefore a
 * PROPOSAL that reconciles in with `evidence.kind: "canvas"`, not a fact.
 *
 * The behaviour that earns this module its keep is deletion: a component removed
 * from the canvas while requirements still depend on it is NOT deleted from the
 * spec. It is marked orphaned and raises a blocking question, because silently
 * dropping the reason a thing existed is how designs rot.
 *
 * Idempotent — running it twice changes nothing, which is why it can be fired
 * after every save without coordination.
 */

export interface ReconcileResult {
  doc: Uss;
  added: number;
  updated: number;
  orphaned: number;
  /** Questions raised by this reconcile, to be merged as openDecisions. */
  questions: { title: string; question: string; why: string; severity: "blocking" | "material" }[];
}

export function reconcileCanvasIntoSpec(
  doc: Uss,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  version: number
): ReconcileResult {
  const g = new UssGraph(doc);
  const questions: ReconcileResult["questions"] = [];
  let added = 0;
  let updated = 0;
  let orphaned = 0;

  const components = g.byKind("component");
  const byNodeId = new Map(components.filter((c) => c.canvasNodeId).map((c) => [c.canvasNodeId!, c]));
  const byTitle = new Map(components.map((c) => [c.title.trim().toLowerCase(), c]));

  const nodeIdToComponentId = new Map<string, string>();

  // ── Nodes present on the canvas ────────────────────────────────────────────
  for (const node of nodes) {
    const label = String(node.data?.label ?? "").trim();
    if (!label) continue;

    const category = (node.data?.nodeCategory ?? "custom") as (typeof components)[number]["category"];
    // Config the entity has no field for is folded into the responsibility. Without
    // this a canvas save would erase "replication=Read replica" — which is exactly
    // the evidence the durability scenario needs — on the round trip.
    const description = describeComponent(
      String(node.data?.description ?? ""),
      (node.data ?? {}) as Record<string, string | undefined>
    );
    const technology =
      (node.data?.configTechnology as string | undefined) ??
      (node.data?.configDbType as string | undefined) ??
      (node.data?.configFramework as string | undefined);

    const existing = byNodeId.get(node.id) ?? byTitle.get(label.toLowerCase());

    if (existing) {
      const changed =
        existing.title !== label ||
        existing.category !== category ||
        existing.canvasNodeId !== node.id ||
        (description && existing.responsibility !== description);
      if (changed) {
        g.update(existing.id, {
          title: label,
          category,
          canvasNodeId: node.id,
          responsibility: description || existing.responsibility,
          technology: technology ?? existing.technology,
          // A component confirmed on the canvas is observed, not inferred.
          status: "KNOWN",
          evidence: [{ kind: "canvas", ref: node.id, quote: label }],
          orphaned: false,
        });
        updated++;
      } else if (existing.orphaned) {
        g.update(existing.id, { orphaned: false });
        updated++;
      }
      nodeIdToComponentId.set(node.id, existing.id);
      continue;
    }

    // A component nobody has explained yet. Recorded as UNKNOWN, not invented.
    const created = g.add("component", {
      title: label,
      category,
      responsibility: description,
      technology,
      canvasNodeId: node.id,
      orphaned: false,
      status: "UNKNOWN",
      confidence: 0.3,
      evidence: [{ kind: "canvas", ref: node.id, quote: label }],
      firstSeenVersion: version,
    });
    nodeIdToComponentId.set(node.id, created.id);
    added++;

    questions.push({
      title: `What is ${label} for?`,
      question: `You added "${label}" to the canvas. What does it do, and which requirement does it serve?`,
      why: "A component with no purpose recorded cannot be built from the spec, and cannot be justified later.",
      severity: "material",
    });
  }

  // ── Components whose canvas node is gone ───────────────────────────────────
  const liveNodeIds = new Set(nodes.map((n) => n.id));
  for (const c of g.byKind("component")) {
    if (!c.canvasNodeId || liveNodeIds.has(c.canvasNodeId)) continue;

    const dependents = g.from(c.id, "satisfies");
    if (dependents.length > 0) {
      // Depended upon: keep it, flag it, ask. Never delete silently.
      if (!c.orphaned) {
        g.update(c.id, { orphaned: true });
        orphaned++;
        const reqs = dependents.map((r) => r.to).join(", ");
        questions.push({
          title: `${c.title} was removed`,
          question: `"${c.title}" was deleted from the canvas, but ${reqs} still depends on it. Was that intentional?`,
          why: "Removing something a requirement depends on leaves the design unable to deliver that requirement.",
          severity: "blocking",
        });
      }
    } else {
      // Nothing depends on it — safe to drop.
      g.remove(c.id);
    }
  }

  // ── Edges → dependsOn ──────────────────────────────────────────────────────
  const wanted = new Set<string>();
  for (const edge of edges) {
    const from = nodeIdToComponentId.get(edge.source);
    const to = nodeIdToComponentId.get(edge.target);
    if (!from || !to) continue; // dangling canvas edge; never written to the graph
    wanted.add(`${from}>${to}`);
    g.link("dependsOn", from, to, {
      status: "KNOWN",
      confidence: 0.9,
      evidence: [{ kind: "canvas", ref: edge.id }],
      firstSeenVersion: version,
      note: (edge.data?.label as string | undefined) || undefined,
    });
  }

  // Drop dependsOn edges the canvas no longer has, but only between components
  // that are both still mirrored on the canvas — otherwise a spec-only dependency
  // asserted by reasoning would be deleted by a canvas that never knew about it.
  const mirrored = new Set(nodeIdToComponentId.values());
  for (const r of g.relations().filter((x) => x.type === "dependsOn")) {
    if (!mirrored.has(r.from) || !mirrored.has(r.to)) continue;
    if (!wanted.has(`${r.from}>${r.to}`)) g.unlink("dependsOn", r.from, r.to);
  }

  return { doc: g.snapshot(), added, updated, orphaned, questions };
}

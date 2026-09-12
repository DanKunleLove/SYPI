import { UssSchema, type Entity, type Relation } from "@/lib/uss/schema";
import { createEmptySpec } from "@/lib/uss/empty";
import { deriveBudget, normaliseComplexity, renderBudgetForPrompt } from "@/lib/uss/complexity";
import { IdAllocator, relationId } from "@/lib/uss/ids";

/**
 * Self-test for the USS foundation. Run with `npm run uss:test`.
 *
 * Kept rather than thrown away because these are the invariants every later unit
 * depends on, and two of them are load-bearing: referential integrity (the fix for
 * the baseline's brief-09 failure, where 33 edges pointed at components that did
 * not exist) and budget non-negotiability (a model must not be able to widen its
 * own complexity allowance). One script, no test framework.
 */

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

// 1. An empty spec is valid.
const empty = createEmptySpec({ specId: "spec_1", projectId: "proj_1" });
const emptyParse = UssSchema.safeParse(empty);
check("empty spec parses", emptyParse.success, emptyParse.success ? "" : JSON.stringify(emptyParse.error.issues[0]));

// 2. A realistic graph parses.
const prov = { status: "KNOWN" as const, confidence: 0.9, evidence: [], firstSeenVersion: 1 };
const entities: Entity[] = [
  { ...prov, id: "REQ-001", kind: "requirement", title: "Staff can check equipment out", requirementKind: "functional", statement: "A manager can assign an item to a crew.", acceptanceCriteria: [], priority: "must" },
  { ...prov, id: "CAP-relational-store", kind: "capability", title: "Relational database", capabilityClass: "RELATIONAL_STORE", why: "Assignments are related records." },
  { ...prov, id: "CMP-001", kind: "component", title: "Equipment DB", category: "database", responsibility: "Stores assignments", orphaned: false },
];
const relations: Relation[] = [
  { ...prov, id: relationId("satisfies", "CMP-001", "REQ-001"), type: "satisfies", from: "CMP-001", to: "REQ-001" },
  { ...prov, id: relationId("requires", "REQ-001", "CAP-relational-store"), type: "requires", from: "REQ-001", to: "CAP-relational-store" },
];
const graph = { ...empty, entities, relations };
const graphParse = UssSchema.safeParse(graph);
check("populated graph parses", graphParse.success, graphParse.success ? "" : JSON.stringify(graphParse.error.issues[0]));

// 3. Duplicate entity ids are REJECTED.
const dup = UssSchema.safeParse({ ...graph, entities: [...entities, entities[0]] });
check("duplicate entity id rejected", !dup.success);

// 4. A relation pointing at a missing entity is REJECTED (referential integrity).
const dangling = UssSchema.safeParse({
  ...graph,
  relations: [...relations, { ...prov, id: "x", type: "satisfies", from: "CMP-999", to: "REQ-001" }],
});
check("dangling relation rejected", !dangling.success);

// 5. A decision with no rejected alternative is REJECTED (it is a default, not a decision).
const badDecision = UssSchema.safeParse({
  ...graph,
  entities: [...entities, { ...prov, id: "DEC-001", kind: "decision", title: "Use Postgres", choice: "PostgreSQL", rationale: "", alternatives: [], reversibility: "costly", revisitTriggers: [] }],
});
check("decision with no alternatives rejected", !badDecision.success);

// 6. Budgets tighten monotonically and tier 1 forbids what tier 4 allows.
const t1 = deriveBudget(1);
const t4 = deriveBudget(4);
check("tier 1 forbids async messaging", t1.allowAsyncMessaging === false);
check("tier 1 forbids caching", t1.allowCaching === false);
check("tier 4 allows decomposition", t4.allowServiceDecomposition === true);
check("component ceiling rises with tier", t1.maxComponents < t4.maxComponents);
check("tier is clamped", deriveBudget(99).maxComponents === deriveBudget(5).maxComponents);

// 7. A model cannot negotiate the budget.
const tampered = normaliseComplexity({
  ...empty.complexity,
  tier: 1,
  budget: { ...deriveBudget(5), maxComponents: 99 },
});
check("model-proposed budget is overwritten", tampered.budget.maxComponents === t1.maxComponents);
check("label forced to match tier", tampered.label === "tool");

// 8. Prompt rendering states prohibitions, not preferences.
const rendered = renderBudgetForPrompt(tampered);
check("budget prompt names prohibitions", rendered.includes("DO NOT include") && rendered.includes("at most 6 components"));

// 9. Id allocation never collides.
const alloc = new IdAllocator(["REQ-001", "REQ-002"]);
const nextReq = alloc.next("requirement");
check("id allocator skips taken ids", nextReq === "REQ-003", nextReq);
const slug1 = alloc.slug("capability", "Video Generation");
const slug2 = alloc.slug("capability", "Video Generation");
check("slug ids deduplicate", slug1 === "CAP-video-generation" && slug2 === "CAP-video-generation-2", `${slug1} / ${slug2}`);

// 10. Relation ids are deterministic — the same edge asserted twice is one edge.
check("relation ids are deterministic", relationId("satisfies", "CMP-001", "REQ-001") === relationId("satisfies", "CMP-001", "REQ-001"));

// ─── Deterministic layer ─────────────────────────────────────────────────────

import { mutate } from "@/lib/uss/graph";
import { computeCompleteness, checkIntegrity, detectGaps } from "@/lib/uss/gaps";
import { renderUssForPrompt } from "@/lib/uss/render";
import { reconcileCanvasIntoSpec } from "@/lib/uss/reconcile";
import { diffUssToCanvas } from "@/lib/uss/project";
import { ALL_SECTIONS, materialOpenDecisions } from "@/lib/uss/views";
import type { CanvasNode, CanvasEdge } from "@/types/canvas";

console.log("");

// A tier-1 project that states its problem, its actor and three requirements is
// COMPLETE. Punishing simple projects with a low score would make the whole rigor
// layer read as an accusation — the likeliest way this feature fails.
const simple = mutate(
  { ...createEmptySpec({ specId: "s", projectId: "p" }), complexity: { ...normaliseComplexity({ ...createEmptySpec({ specId: "s", projectId: "p" }).complexity, tier: 1, status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }] }) } },
  (g) => {
    g.add("product", { ...prov, title: "Equipment tracker", problem: "Spreadsheet keeps getting overwritten.", valueProposition: "", inScope: ["check in/out"], outOfScope: ["billing"], successCriteria: ["a manager can assign an item"] });
    const actor = g.add("actor", { ...prov, title: "Site manager", description: "", isHuman: true, goals: [], permissions: ["assign equipment"] });
    const uc = g.add("useCase", { ...prov, title: "Check out equipment", trigger: "crew needs a tool", mainFlow: ["pick item", "assign to crew"], alternateFlows: [], postconditions: [] });
    g.link("actsOn", actor.id, uc.id, { status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }], firstSeenVersion: 1 });
    const cap = g.add("capability", { ...prov, title: "Relational database", capabilityClass: "RELATIONAL_STORE", why: "assignments are related records" });
    const cmp = g.add("component", { ...prov, title: "Equipment DB", category: "database", responsibility: "stores assignments", orphaned: false });
    g.link("realizes", cmp.id, cap.id, { status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }], firstSeenVersion: 1 });
    for (let i = 1; i <= 3; i++) {
      const r = g.add("requirement", { ...prov, title: `Requirement ${i}`, requirementKind: "functional", statement: `Does thing ${i}`, acceptanceCriteria: ["verifiable"], priority: "must" });
      g.link("satisfies", cmp.id, r.id, { status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }], firstSeenVersion: 1 });
      g.link("requires", r.id, cap.id, { status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }], firstSeenVersion: 1 });
    }
  }
);
const simpleScore = computeCompleteness(simple);
check("a complete tier-1 project scores 100", simpleScore === 100, `got ${simpleScore}`);
check("simple project has no orphan components", !checkIntegrity(simple).some((f) => f.rule === "orphan-component"));

// An unjustified component must be caught deterministically.
const inflated = mutate(simple, (g) => {
  g.add("component", { ...prov, title: "Redis Cache", category: "cache", responsibility: "", orphaned: false });
});
const inflatedFindings = checkIntegrity(inflated);
check("orphan component detected", inflatedFindings.some((f) => f.rule === "orphan-component"));

// Removing a depended-on canvas node raises exactly one BLOCKING question and
// does NOT delete the component.
const dbComponent = simple.entities.find((e) => e.kind === "component")!;
const withNode = mutate(simple, (g) => {
  g.update(dbComponent.id, { canvasNodeId: "node-1" });
});
const removed = reconcileCanvasIntoSpec(withNode, [], [], 2);
check("depended-on component is not deleted", removed.doc.entities.some((e) => e.id === dbComponent.id));
check("removal raises one blocking question", removed.questions.filter((q) => q.severity === "blocking").length === 1);
check("removal marks the component orphaned", removed.orphaned === 1);

// Reconcile is idempotent — it runs after every save, so a double run must be a no-op.
const nodes: CanvasNode[] = [
  // description matches the spec's responsibility: a genuinely synced canvas.
  { id: "node-1", type: "systemNode", position: { x: 0, y: 0 }, data: { label: "Equipment DB", color: "", shape: "rounded", nodeCategory: "database", description: "stores assignments" } },
];
const edges: CanvasEdge[] = [];
const once = reconcileCanvasIntoSpec(withNode, nodes, edges, 2);
const twice = reconcileCanvasIntoSpec(once.doc, nodes, edges, 3);
check("reconcile is idempotent", twice.added === 0 && twice.orphaned === 0 && twice.questions.length === 0);

// A canvas already matching the spec produces no diff.
check("synced canvas produces no diff", diffUssToCanvas(once.doc, nodes, edges).length === 0);

// THE critical render rule: an empty section must never reach a prompt.
const emptyDoc = createEmptySpec({ specId: "s", projectId: "p" });
const renderedEmpty = renderUssForPrompt(emptyDoc, { sections: ALL_SECTIONS });
check("empty spec renders nothing", renderedEmpty.trim().length === 0, `got ${renderedEmpty.length} chars`);
const renderedSimple = renderUssForPrompt(simple, { sections: ALL_SECTIONS });
check("populated spec renders no empty headings", !/GLOSSARY|ASSUMPTIONS|KNOWN UNKNOWNS/.test(renderedSimple));
check("render respects maxChars", renderUssForPrompt(simple, { sections: ALL_SECTIONS, maxChars: 300 }).length <= 300);

// Gap detection is free and finds capability questions.
const gaps = detectGaps(simple);
check("gap rules produce questions with zero LLM calls", gaps.length > 0, `${gaps.length} found`);

// Material ranking: only decisions that would change the design count.
const withDecisions = mutate(simple, (g) => {
  g.add("openDecision", { ...prov, title: "Cosmetic", question: "What colour?", why: "", category: "scope", options: [], impact: { affectsComponents: [], affectsRequirements: [], severity: "cosmetic" } });
  g.add("openDecision", { ...prov, title: "Material", question: "Who can delete?", why: "", category: "auth", options: [], impact: { affectsComponents: [dbComponent.id], affectsRequirements: [], severity: "material" } });
});
check("only material decisions are surfaced", materialOpenDecisions(withDecisions).length === 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

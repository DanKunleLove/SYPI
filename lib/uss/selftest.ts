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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

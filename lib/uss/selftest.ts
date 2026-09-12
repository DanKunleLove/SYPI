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
  // `type` is the React Flow registry key ("systemNode"); the CanvasNode generic
  // says "canvasNode" and is cosmetic, hence the cast.
  { id: "node-1", type: "canvasNode", position: { x: 0, y: 0 }, data: { label: "Equipment DB", color: "", shape: "rounded", nodeCategory: "database", description: "stores assignments" } },
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

// ─── Unit 2: the reasoning chain ─────────────────────────────────────────────

import { applyImplications, deriveImplications, ruleCoverage } from "@/lib/uss/reasoning";
import { UssGraph } from "@/lib/uss/graph";
import { implications as implicationsView } from "@/lib/uss/views";

console.log("");

// The canonical case from the plan: "users upload 2GB videos" must imply
// multipart, async processing, job state, progress and recovery — WITHOUT any
// model being asked.
const uploads = mutate(
  { ...createEmptySpec({ specId: "s", projectId: "p" }), complexity: normaliseComplexity({ ...createEmptySpec({ specId: "s", projectId: "p" }).complexity, tier: 3, status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }] }) },
  (g) => {
    g.add("product", { ...prov, title: "Video platform", problem: "Users upload and share video.", valueProposition: "", inScope: [], outOfScope: [], successCriteria: ["a user can upload a 2GB video"] });
    g.add("actor", { ...prov, title: "Creator", description: "", isHuman: true, goals: [], permissions: ["upload video"] });
    g.add("actor", { ...prov, title: "Viewer", description: "", isHuman: true, goals: [], permissions: ["watch video"] });
    g.add("requirement", { ...prov, title: "Upload large video", requirementKind: "functional", statement: "Users upload video files up to 2GB in size", acceptanceCriteria: ["a 2GB upload completes"], priority: "must" });
    g.add("requirement", { ...prov, title: "Process uploaded video", requirementKind: "functional", statement: "Uploaded video is transcoded before playback", acceptanceCriteria: ["playback works"], priority: "must" });
    g.add("capability", { ...prov, title: "OBJECT_STORAGE", capabilityClass: "OBJECT_STORAGE", why: "stores video" });
  }
);

const drafts = deriveImplications(uploads);
check("2GB upload derives implications with no model call", drafts.length >= 5, `${drafts.length} derived`);
const statements = drafts.map((d) => d.statement.toLowerCase()).join(" | ");
check("implies resumable/multipart upload", /multipart|resumable/.test(statements));
check("implies async background processing", /background job|async/.test(statements));
check("implies progress reporting", /progress/.test(statements));
check("implies failure recovery", /resumable or cleanly discarded|recover/.test(statements));

const withImplications = applyImplications(uploads, drafts.map((d) => ({ ...d, source: "rule" as const })), 2);
const coverage = ruleCoverage(withImplications);
check("rule coverage is at least 70%", coverage.pct >= 70, `${coverage.pct}% of ${coverage.total}`);

// The chain must be TRAVERSABLE: implication → capability, and requirement → implication.
const cg = new UssGraph(withImplications);
const anyImplication = implicationsView(withImplications)[0];
check("implication demands a capability", cg.neighbours(anyImplication.id, "requires").length > 0);
const tracedFromRequirement = cg
  .byKind("requirement")
  .some((r) => cg.from(r.id, "implies").length > 0);
check("requirement traces forward to an implication", tracedFromRequirement);

// Capabilities the implications demanded but the spec lacked must be created,
// so the gap surfaces rather than silently vanishing.
const capClasses = cg.byKind("capability").map((c) => c.capabilityClass);
check("missing demanded capability is created", capClasses.includes("QUEUE"), capClasses.join(","));

// Payments: the baseline's worst miss. A rule must never forget idempotency.
const marketplace = mutate(uploads, (g) => {
  g.add("requirement", { ...prov, title: "Take payment", requirementKind: "functional", statement: "Customers pay for orders by card at checkout", acceptanceCriteria: ["payment succeeds"], priority: "must" });
  g.add("capability", { ...prov, title: "PAYMENTS", capabilityClass: "PAYMENTS", why: "checkout" });
});
const payStatements = deriveImplications(marketplace).map((d) => d.statement.toLowerCase()).join(" | ");
check("payments implies webhook idempotency", /idempotent/.test(payStatements));
check("payments implies signature verification", /signature-verified|signature/.test(payStatements));
check("payments implies an auditable record", /append-only|audit/.test(payStatements));
check("order lifecycle implies a state machine", /named states|legal transitions/.test(payStatements));

// Multiple human actors must imply per-request authorization.
check("two actors imply authorization per request", /authorization is decided per request/.test(payStatements));

// Rules must respect the budget: a tier-1 project must not acquire a CDN.
const tiny = mutate(
  { ...createEmptySpec({ specId: "s", projectId: "p" }), complexity: normaliseComplexity({ ...createEmptySpec({ specId: "s", projectId: "p" }).complexity, tier: 1, status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }] }) },
  (g) => {
    g.add("requirement", { ...prov, title: "Browse public catalog", requirementKind: "functional", statement: "Anyone can browse the public feed and catalog", acceptanceCriteria: ["page loads"], priority: "must" });
  }
);
const tinyDemands = deriveImplications(tiny).flatMap((d) => d.demands);
check("tier 1 does not acquire a CDN from the read-scaling rule", !tinyDemands.includes("CDN"), tinyDemands.join(","));

// ─── Unit 3: domain model and invariants ─────────────────────────────────────

import { applyInvariants, checkDomainIntegrity, seedInvariants } from "@/lib/uss/domain";
import { invariants as invariantsView, domainEntities } from "@/lib/uss/views";

console.log("");

// The marketplace case from the plan: User/Seller/Product/Inventory/Order/Payment,
// an Order lifecycle where cancelled→shipped is ABSENT, and invariants traced to
// what enforces them.
const market = mutate(
  { ...createEmptySpec({ specId: "s", projectId: "p" }), complexity: normaliseComplexity({ ...createEmptySpec({ specId: "s", projectId: "p" }).complexity, tier: 4, status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }] }) },
  (g) => {
    g.add("requirement", { ...prov, title: "Buy from merchants", requirementKind: "functional", statement: "Customers place an order and pay for it; merchants hold inventory and we pay them out", acceptanceCriteria: ["an order completes"], priority: "must" });
    g.add("capability", { ...prov, title: "PAYMENTS", capabilityClass: "PAYMENTS", why: "checkout" });
    g.add("capability", { ...prov, title: "AUTHZ", capabilityClass: "AUTHZ", why: "merchants see only their own" });
    for (const name of ["Order", "Payment", "Inventory", "Product"]) {
      g.add("domainEntity", {
        ...prov, title: name, description: "", keyAttributes: [],
        tenantScoped: name === "Order" || name === "Inventory",
        financial: name === "Payment",
      });
    }
    // A deliberately incomplete lifecycle: no terminal state, unguarded ship.
    for (const [from, to, guard] of [["pending", "paid", "payment confirmed"], ["paid", "shipped", ""]]) {
      g.add("transition", { ...prov, title: `Order: ${from} → ${to}`, entityTitle: "Order", from, to, trigger: "", guard });
    }
    for (const s of ["pending", "paid", "shipped"]) {
      g.add("state", { ...prov, title: `Order: ${s}`, entityTitle: "Order", isInitial: s === "pending", isTerminal: false });
    }
  }
);

const seeds = seedInvariants(market);
const seedText = seeds.map((s) => s.statement.toLowerCase()).join(" | ");
check("marketplace seeds invariants with no model call", seeds.length >= 4, `${seeds.length} seeded`);
check("seeds: a payment cannot be recorded twice", /at most once/.test(seedText));
check("seeds: inventory cannot go negative", /never go below zero/.test(seedText));
check("seeds: no cross-tenant reads", /own organisation/.test(seedText));
check("seeds: only legal state transitions", /defined transition/.test(seedText));
check("seeds: money has an append-only history", /append-only/.test(seedText));

const withInvariants = applyInvariants(market, seeds, 2);
check("invariants are written and linked", invariantsView(withInvariants).length >= 4);
check("domain entities survive", domainEntities(withInvariants).length === 4);

const domainFindings = checkDomainIntegrity(withInvariants);
const findingRules = domainFindings.map((f) => f.rule);
check("detects an unguarded money/value transition", findingRules.includes("unguarded-transition"), findingRules.join(","));
check("detects a lifecycle that never ends", findingRules.includes("lifecycle-never-ends"));
check("detects domain entities no component owns", findingRules.includes("unmanaged-domain-entity"));

// Money present, but no financial invariant → must be flagged.
const moneyNoAudit = mutate(market, (g) => {
  for (const inv of g.byKind("invariant")) g.remove(inv.id);
});
check(
  "money without an auditable history is blocking",
  checkDomainIntegrity(moneyNoAudit).some((f) => f.rule === "money-without-audit")
);

// Tenant-scoped data with no isolation rule → must be flagged.
check(
  "tenant data without an isolation rule is blocking",
  checkDomainIntegrity(moneyNoAudit).some((f) => f.rule === "missing-tenant-isolation")
);

// A simple project must NOT acquire payment invariants it has no use for.
const simpleSeeds = seedInvariants(simple);
check("a simple tool seeds no payment invariants", !simpleSeeds.some((s) => s.category === "financial"), `${simpleSeeds.length} seeded`);

// ─── Unit 4: the engineering council ─────────────────────────────────────────

import { selectCouncil, estimateCouncilCalls, preReviewFindings } from "@/lib/uss/council";

console.log("");

// A simple tool gets the two mandatory reviewers and nothing else. Paying for six
// specialist opinions on an 8-user internal tool is the same over-engineering this
// product exists to prevent.
const simpleCouncil = selectCouncil(simple);
check(
  "tier-1 tool invokes only the two mandatory reviewers",
  simpleCouncil.disciplines.length === 2,
  simpleCouncil.disciplines.map((d) => d.id).join(",")
);
check(
  "the mandatory two are architecture and implementability",
  simpleCouncil.disciplines.map((d) => d.id).sort().join(",") === "architecture,implementability"
);

// A payments platform pulls in the specialists that money demands.
const marketCouncil = selectCouncil(withInvariants);
const marketIds = marketCouncil.disciplines.map((d) => d.id);
check("payments platform invokes security", marketIds.includes("security"), marketIds.join(","));
check("payments platform invokes data review", marketIds.includes("data"));
check("payments platform invokes more reviewers than a simple tool", marketIds.length > simpleCouncil.disciplines.length);
check(
  "every reviewer states why it was selected",
  marketCouncil.disciplines.every((d) => Boolean(marketCouncil.reasons[d.id]))
);
check("council is capped", selectCouncil(withInvariants, 3).disciplines.length === 3);

// Cost is knowable before spending it.
check("call count is estimable up front", estimateCouncilCalls(simple) === 3);

// Reviewers receive what the rules already proved, so they go deeper instead of
// rediscovering it.
const pre = preReviewFindings(withInvariants);
check("deterministic findings are handed to reviewers", pre.length > 0, `${pre.length} passed through`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

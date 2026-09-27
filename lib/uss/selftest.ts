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
import { computeSpecCoverage, computeSpecHealth, checkIntegrity, detectGaps } from "@/lib/uss/gaps";
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
const simpleScore = computeSpecCoverage(simple);
check("a complete tier-1 project scores 100", simpleScore === 100, `got ${simpleScore}`);
check("simple project has no orphan components", !checkIntegrity(simple).some((f) => f.rule === "orphan-component"));

// The inverted-incentive regression test. Coverage used to dock 2 points for a
// blocking open decision, so the meter went DOWN when the system did the one
// thing it exists to do. Surfacing a question must never cost the user score.
const withBlockingQuestion = mutate(simple, (g) => {
  g.add("openDecision", {
    ...prov,
    title: "Who may delete equipment?",
    question: "Who is allowed to delete an equipment record, and is it recoverable?",
    why: "Deletion rights decide the whole authorization model.",
    category: "auth",
    options: [],
    impact: { affectsComponents: [], affectsRequirements: [], severity: "blocking" },
  });
});
check(
  "surfacing a blocking question does NOT lower coverage",
  computeSpecCoverage(withBlockingQuestion) === simpleScore,
  `${simpleScore} → ${computeSpecCoverage(withBlockingQuestion)}`
);
check(
  "the blocking question is counted and reported, not subtracted",
  computeSpecHealth(withBlockingQuestion).blockingDecisions === 1
);
const simpleHealth = computeSpecHealth(simple);
check("health reports coverage separately from scenarios", simpleHealth.coverage === simpleScore);
check(
  "a tier-1 tool with two decided scenarios gets no scenario score",
  simpleHealth.scenarioScore === null,
  String(simpleHealth.scenarioScore)
);

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

import {
  applyInvariants,
  checkDomainIntegrity,
  linkEnforcement,
  seedInvariants,
  unenforcedInvariants,
} from "@/lib/uss/domain";
import { invariants as invariantsView, domainEntities, decisions as decisionsView } from "@/lib/uss/views";

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

// ─── enforcedBy — the fix for a check that could never fire ──────────────────
//
// The old predicate was `!enforcement && no governs`. But applyInvariants creates
// a governs edge for every seeded invariant and three seeds apply to "*", so the
// finding was unreachable — while render.ts told the model "[NOTHING ENFORCES
// THIS YET]" about the same invariants. Two parts of the system, opposite answers.

const noComponents = linkEnforcement(withInvariants, 3);
check(
  "with no components, no invariant claims to be enforced",
  unenforcedInvariants(noComponents).length === invariantsView(noComponents).length,
  `${unenforcedInvariants(noComponents).length}/${invariantsView(noComponents).length}`
);
check(
  "a spec with no architecture is NOT accused of unenforced invariants",
  !checkDomainIntegrity(noComponents).some((f) => f.rule === "unenforced-invariant")
);

// A component that says what it does is evidence. One that does not, is not.
const withHandler = linkEnforcement(
  mutate(withInvariants, (g) => {
    g.add("component", {
      ...prov,
      title: "Payment Webhook Handler",
      category: "service",
      responsibility: "verifies the provider signature and deduplicates by provider event id",
      orphaned: false,
    });
  }),
  3
);
const uniqueness = invariantsView(withHandler).filter((i) => i.category === "uniqueness");
check("a uniqueness invariant exists to be enforced", uniqueness.length > 0);
check(
  "a component demonstrating the mechanism enforces the invariant",
  uniqueness.every((i) => !unenforcedInvariants(withHandler).some((u) => u.id === i.id)),
  unenforcedInvariants(withHandler).map((i) => i.category).join(",")
);
check(
  "enforcement names the component and the phrase that proved it",
  uniqueness.every((i) => i.enforcement.includes("Payment Webhook Handler")),
  uniqueness[0]?.enforcement
);
const enforcedEdges = new UssGraph(withHandler).relations().filter((r) => r.type === "enforcedBy");
check("enforcedBy edges are written", enforcedEdges.length > 0);
check(
  "auto-derived enforcement is INFERRED, never KNOWN",
  enforcedEdges.every((r) => r.status === "INFERRED" && r.confidence <= 0.7),
  enforcedEdges.map((r) => `${r.status}/${r.confidence}`).join(",")
);

// A component that demonstrates nothing leaves the invariant unenforced, and now
// that an architecture exists, that IS a finding.
const withVagueComponent = linkEnforcement(
  mutate(withInvariants, (g) => {
    g.add("component", {
      ...prov,
      title: "Backend",
      category: "service",
      responsibility: "handles the business logic",
      orphaned: false,
    });
  }),
  3
);
check(
  "a component that demonstrates nothing does not enforce anything",
  unenforcedInvariants(withVagueComponent).length === invariantsView(withVagueComponent).length
);
check(
  "with an architecture present, an unenforced invariant IS blocking",
  checkDomainIntegrity(withVagueComponent).some(
    (f) => f.rule === "unenforced-invariant" && f.severity === "blocking"
  )
);

// The agreement test. Three call sites used to answer this three different ways;
// this is the check that stops that recurring.
const agreementDoc = withVagueComponent;
const viaIntegrity =
  checkDomainIntegrity(agreementDoc).find((f) => f.rule === "unenforced-invariant")?.subjects
    .length ?? 0;
const viaPredicate = unenforcedInvariants(agreementDoc).length;
const viaRender = (
  renderUssForPrompt(agreementDoc, { sections: ["invariants"] }).match(/NOTHING ENFORCES THIS YET/g) ??
  []
).length;
check(
  "integrity, the predicate and the render all agree on what is unenforced",
  viaIntegrity === viaPredicate && viaPredicate === viaRender,
  `integrity=${viaIntegrity} predicate=${viaPredicate} render=${viaRender}`
);
check(
  "an enforced invariant is rendered as inferred, never as settled fact",
  renderUssForPrompt(withHandler, { sections: ["invariants"] }).includes("(inferred — confirm)")
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
const pre = preReviewFindings(withVagueComponent);
check("deterministic findings are handed to reviewers", pre.length > 0, `${pre.length} passed through`);
// And the council must agree with checkDomainIntegrity about enforcement rather
// than running its own, different predicate as it used to.
check(
  "the council sees the same unenforced invariants the integrity check does",
  pre.some((p) => p.includes(`${unenforcedInvariants(withVagueComponent).length} invariant(s)`)),
  pre.join(" | ")
);
check(
  "the council does not accuse an architecture-free spec",
  !preReviewFindings(noComponents).some((p) => p.includes("invariant(s) have no component"))
);

// ─── Unit 5: validation by scenario ──────────────────────────────────────────

import { runScenarios, summariseScenarios } from "@/lib/uss/scenarios";
import { applyImplications as applyImp, deriveImplications as derImp } from "@/lib/uss/reasoning";

console.log("");

// A payments design with no idempotency stated must FAIL the webhook-replay
// scenario. This is the baseline's worst miss, now caught deterministically.
const rawPayments = mutate(
  { ...createEmptySpec({ specId: "s", projectId: "p" }), complexity: normaliseComplexity({ ...createEmptySpec({ specId: "s", projectId: "p" }).complexity, tier: 4, status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }] }) },
  (g) => {
    g.add("requirement", { ...prov, title: "Checkout", requirementKind: "functional", statement: "Customers pay by card", acceptanceCriteria: ["payment taken"], priority: "must" });
    g.add("capability", { ...prov, title: "PAYMENTS", capabilityClass: "PAYMENTS", why: "checkout" });
    g.add("component", { ...prov, title: "Payment Service", category: "service", responsibility: "takes payments", orphaned: false });
  }
);
const rawResults = runScenarios(rawPayments);
const replay = rawResults.find((r) => r.id === "webhook-replay");
check("webhook-replay scenario applies to a payments system", Boolean(replay));
check("a design with no idempotency FAILS webhook replay", replay?.outcome === "gap", replay?.outcome);
check("that failure is blocking", replay?.severity === "blocking");
check(
  "a gap tells the reader what would prove it",
  Boolean(replay?.proofDescription) && replay!.proofDescription.includes("deduplicat"),
  replay?.proofDescription
);

// ── The anti-circularity test ────────────────────────────────────────────────
//
// This assertion is the inversion of the one it replaces. The old test asserted
// "after reasoning, webhook replay PASSES" — but reasoning writes "payment
// notifications must be idempotent" INTO the spec, and the scenario then searched
// that same spec for "idempot". The rulebook was grading itself and the test
// certified it. What the implication rulebook says the system OUGHT to do can
// never be evidence that the architecture DOES it.
const reasonedPayments = applyImp(
  rawPayments,
  derImp(rawPayments).map((d) => ({ ...d, source: "rule" as const })),
  2
);
const implicationText = implicationsView(reasonedPayments)
  .map((i) => i.statement)
  .join(" ")
  .toLowerCase();
check(
  "the rulebook did write an idempotency implication",
  implicationText.includes("idempot"),
  `${implicationsView(reasonedPayments).length} implications`
);
const replayAfter = runScenarios(reasonedPayments).find((r) => r.id === "webhook-replay");
check(
  "an implication saying it SHOULD be idempotent does not make the scenario pass",
  replayAfter?.outcome !== "pass",
  replayAfter?.outcome
);

// Only the architecture can prove it. A component that states the mechanism does.
const provenPayments = mutate(rawPayments, (g) => {
  g.add("component", {
    ...prov,
    title: "Payment Webhook Handler",
    category: "service",
    responsibility: "verifies the provider signature and deduplicates by provider event id",
    orphaned: false,
  });
});
const replayProven = runScenarios(provenPayments).find((r) => r.id === "webhook-replay");
check("a component that states the mechanism PASSES webhook replay", replayProven?.outcome === "pass", replayProven?.reasoning);
check("a pass names the component that proved it", (replayProven?.provenBy.length ?? 0) > 0, replayProven?.provenBy.join(","));
check(
  "the proof is quoted back, not merely asserted",
  replayProven?.reasoning.includes("Payment Webhook Handler") === true,
  replayProven?.reasoning
);

// Before any architecture exists, the honest answer is UNKNOWN — never PASS, and
// never a gap, because there was nothing to inspect.
const noArchPayments = mutate(rawPayments, (g) => {
  for (const c of g.byKind("component")) g.remove(c.id);
});
const replayNoArch = runScenarios(noArchPayments).find((r) => r.id === "webhook-replay");
check("with no architecture, the scenario is UNKNOWN not PASS", replayNoArch?.outcome === "unknown", replayNoArch?.outcome);

// The word "tenant" appearing somewhere in a brief is not an authorization model.
const tenantWords = mutate(rawPayments, (g) => {
  g.add("capability", { ...prov, title: "AUTHZ", capabilityClass: "AUTHZ", why: "multi-tenant" });
  g.add("requirement", { ...prov, title: "Tenancy", requirementKind: "functional", statement: "Each tenant sees only their own data", acceptanceCriteria: ["scoped"], priority: "must" });
});
const tenantResult = runScenarios(tenantWords).find((r) => r.id === "cross-tenant");
check(
  "saying 'each tenant sees only their own data' does not pass cross-tenant",
  tenantResult?.outcome === "gap",
  tenantResult?.outcome
);

// Unknown is a distinct, honest outcome — never counted as a failure.
const summary = summariseScenarios(rawResults);
check("summary separates gaps from unknowns", summary.unknown + summary.gaps + summary.passed === summary.total);
check("score excludes unknowns", summary.score === null || summary.score === Math.round((summary.passed / (summary.passed + summary.gaps)) * 100));

// Scenarios must not fire for systems they do not apply to.
const simpleScenarios = runScenarios(simple);
check("a simple tool gets no payment scenarios", !simpleScenarios.some((r) => r.id.startsWith("webhook")), simpleScenarios.map((r) => r.id).join(","));

// An unguarded money transition is caught by the lifecycle scenario.
const illegal = runScenarios(withInvariants).find((r) => r.id === "illegal-transition");
check("unguarded paid→shipped is caught as a scenario gap", illegal?.outcome === "gap", illegal?.reasoning);

// Actors WITH permissions pass the authorization scenario; the uploads fixture
// gives both its actors explicit permissions, so this must be a pass.
const authScenario = runScenarios(withImplications).find((r) => r.id === "no-actor-permissions");
check(
  "actors with stated permissions pass the authorization scenario",
  authScenario?.outcome === "pass",
  authScenario ? authScenario.reasoning : "scenario did not apply"
);

// ─── Unit 6: provider binding ────────────────────────────────────────────────

import { applyBindings, chooseProvider, readBindingConstraints } from "@/lib/uss/binding";
import { providerBindings } from "@/lib/uss/views";

console.log("");

// The case that motivates the whole unit: a Nigerian marketplace must not be
// handed Stripe, which is not available to businesses there.
const nigerian = mutate(
  { ...createEmptySpec({ specId: "s", projectId: "p" }), complexity: normaliseComplexity({ ...createEmptySpec({ specId: "s", projectId: "p" }).complexity, tier: 4, status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }] }) },
  (g) => {
    g.add("product", { ...prov, title: "Marketplace", problem: "Nigerian users buy from local merchants.", valueProposition: "", inScope: [], outOfScope: [], successCriteria: ["an order completes"] });
    g.add("requirement", { ...prov, title: "Take payment", requirementKind: "functional", statement: "Customers in Nigeria pay by card", acceptanceCriteria: ["payment taken"], priority: "must" });
    g.add("capability", { ...prov, title: "PAYMENTS", capabilityClass: "PAYMENTS", why: "checkout" });
    g.add("capability", { ...prov, title: "RELATIONAL_STORE", capabilityClass: "RELATIONAL_STORE", why: "orders" });
  }
);

const ngCtx = readBindingConstraints(nigerian);
check("market is read from the spec", ngCtx.markets.includes("nigeria"), ngCtx.markets.join(","));

const payChoice = chooseProvider("PAYMENTS", ngCtx);
check("a payment provider is chosen", Boolean(payChoice));
check(
  "a Nigerian marketplace is NOT given Stripe",
  payChoice?.chosen.id !== "stripe",
  payChoice?.chosen.label
);
check(
  "the chosen provider serves the stated market",
  Boolean(payChoice?.chosen.strongIn?.includes("nigeria")),
  payChoice?.chosen.label
);
check("rejected alternatives are recorded with reasons", (payChoice?.rejected.length ?? 0) > 0);
check(
  "Stripe's rejection names the market",
  Boolean(payChoice?.rejected.some((r) => r.option.id === "stripe" && /market/i.test(r.because))),
  payChoice?.rejected.find((r) => r.option.id === "stripe")?.because
);

// Bindings become entities, and every real choice produces a decision with
// rejected alternatives — the schema refuses a decision without one.
const bound = applyBindings(nigerian, 2);
check("bindings are written as entities", providerBindings(bound).length >= 2);
const payDecision = decisionsView(bound).find((d) => /PAYMENTS/.test(d.title));
check("a decision records the technology choice", Boolean(payDecision));
check(
  "that decision names what was rejected and why",
  (payDecision?.alternatives.length ?? 0) > 0 &&
    payDecision!.alternatives.every((a) => a.rejectedBecause.length > 0)
);
check("payment choice is marked costly to reverse", payDecision?.reversibility === "costly");

// Re-running must not duplicate or silently re-decide.
const boundTwice = applyBindings(bound, 3);
check(
  "binding is idempotent",
  providerBindings(boundTwice).length === providerBindings(bound).length
);

// A tier-1 project must not be handed infrastructure it cannot operate.
const tinyCtx = readBindingConstraints(simple);
const queueForTiny = chooseProvider("QUEUE", tinyCtx);
check(
  "tier 1 is not given a managed queue service",
  queueForTiny === null || queueForTiny.chosen.tierFloor <= 1 || queueForTiny.chosen.id === "db-queue",
  queueForTiny?.chosen.label ?? "none"
);

// Cost sensitivity actually changes the answer.
const frugal = mutate(nigerian, (g) => {
  g.add("constraint", { ...prov, title: "Budget", category: "budget", statement: "We are bootstrapping with almost no budget" });
});
const frugalCtx = readBindingConstraints(frugal);
check("a budget constraint is detected", frugalCtx.costSensitive);
check("the constraint is quoted in the audit trail", frugalCtx.sources.some((s) => /bootstrapping/i.test(s)));

// ─── Regressions caught by the benchmark ─────────────────────────────────────

console.log("");

// A single-actor internal tool must still demand authentication. The benchmark
// caught a design that met its component budget by dropping auth and spending the
// slot on a read replica — "internal" is not an access control.
const soloActorDemands = derImp(simple).flatMap((d) => d.demands);
check(
  "a single-actor internal tool still demands AUTH",
  soloActorDemands.includes("AUTH"),
  soloActorDemands.join(",") || "none"
);

// A system explicitly described as public should not be forced into a login.
const publicSite = mutate(simple, (g) => {
  g.add("requirement", { ...prov, title: "Public catalogue", requirementKind: "functional", statement: "Anyone can browse the public catalogue anonymously with no login", acceptanceCriteria: ["page loads"], priority: "must" });
});
check(
  "an explicitly public system is not forced into authentication",
  !derImp(publicSite).some((d) => d.statement.includes("who is making each request"))
);

// The budget must bind optional infrastructure, not required capability.
check(
  "the budget prompt forbids meeting the limit by dropping required components",
  renderBudgetForPrompt(simple.complexity).includes("NEVER meet this limit by omitting")
);

// ─── Unit 7: execution targets ───────────────────────────────────────────────

import { EXECUTION_TARGETS, getTarget, isTargetId, targetSystemPrompt } from "@/lib/uss/targets";
import { ALL_SECTIONS as SECTIONS } from "@/lib/uss/views";

console.log("");

check("six execution targets are defined", EXECUTION_TARGETS.length === 6);
check("an unknown target falls back rather than throwing", getTarget("nonsense").id === "claude-code");
check("target ids are validated", isTargetId("n8n") && !isTargetId("n9n"));

// Every file must declare real sections — a typo here would silently render nothing.
const badSections = EXECUTION_TARGETS.flatMap((t) =>
  t.files.flatMap((f) => f.sections.filter((s) => !SECTIONS.includes(s)).map((s) => `${t.id}/${f.path}:${s}`))
);
check("every target file references real spec sections", badSections.length === 0, badSections.join(", "));

check(
  "every target file has guidance",
  EXECUTION_TARGETS.every((t) => t.files.every((f) => f.guidance.trim().length > 40))
);
check(
  "no two files in a target share a path",
  EXECUTION_TARGETS.every((t) => new Set(t.files.map((f) => f.path)).size === t.files.length)
);

// The core neutrality property: no target's vocabulary in the specification.
const specVocabulary = SECTIONS.join(" ").toLowerCase();
check(
  "no execution target's name leaks into the spec sections",
  !["claude", "codex", "lovable", "n8n", "cursor", "bolt"].some((v) => specVocabulary.includes(v))
);

// Each target must be genuinely different, not the same bundle relabelled.
const claudePaths = getTarget("claude-code").files.map((f) => f.path).join(",");
const n8nPaths = getTarget("n8n").files.map((f) => f.path).join(",");
const humanPaths = getTarget("human-team").files.map((f) => f.path).join(",");
check("targets render genuinely different bundles", claudePaths !== n8nPaths && n8nPaths !== humanPaths);

// n8n is the one where failure paths are non-negotiable.
check(
  "the automation target demands failure paths",
  getTarget("n8n").files.some((f) => /failure/i.test(f.path))
);
// A human team gets the artefacts a team actually reviews.
check(
  "the human team target includes ADRs and a threat model",
  humanPaths.includes("DECISIONS.md") && humanPaths.includes("THREAT-MODEL.md")
);

// The epistemic clause must survive into every target's prompt.
check(
  "every target prompt carries the epistemic discipline",
  EXECUTION_TARGETS.every((t) => {
    const p = targetSystemPrompt(t);
    return p.includes("confirm before building") && p.includes("do NOT resolve it");
  })
);


// ─── The design prompt: the spec must DRIVE generation, not argue with it ────

import { buildDesignPrompt } from "@/lib/ai/design-prompt";
import { GENERATION_SYSTEM_PROMPT, URL_ANALYSIS_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { applyArchitectureToSpec } from "@/lib/uss/architecture";
import { components as componentsView } from "@/lib/uss/views";

console.log("");

// The control arm of the A/B. If this ever stops being byte-identical, the
// experiment is measuring two changes instead of one.
const noSpec = buildDesignPrompt({ brief: "a tool that renames files", doc: null });
check(
  "with no spec, the system prompt is byte-identical to what shipped",
  noSpec.system === GENERATION_SYSTEM_PROMPT
);
check("with no spec, the user prompt is just the brief", noSpec.user === "a tool that renames files");
check("no spec means no USS applied", noSpec.ussApplied === false);

// An empty spec is not a spec. It must not trigger the spec-driven path.
check(
  "an empty spec falls back to the shipped prompt",
  buildDesignPrompt({ brief: "x", doc: createEmptySpec({ specId: "s", projectId: "p" }) }).system ===
    GENERATION_SYSTEM_PROMPT
);

// With a spec, the contradiction must be GONE. That was the bug: a system prompt
// saying "typically 5-15 nodes" and "add appropriate middleware" outranking a
// user message saying "at most 6 components" and "DO NOT include a cache tier".
const tier1Design = buildDesignPrompt({ brief: "an equipment tracker", doc: simple });
check("a spec drives the system prompt", tier1Design.ussApplied === true);
check(
  "the budget is IN the system prompt, at the same authority as everything else",
  tier1Design.system.includes("at most 6 components")
);
check("the system prompt states the prohibitions", tier1Design.system.includes("DO NOT include"));
check(
  "the contradicting node-count advice is gone",
  !tier1Design.system.includes("5-15"),
  "system prompt still says 5-15"
);
check(
  "the contradicting middleware advice is gone",
  !tier1Design.system.toLowerCase().includes("appropriate middleware")
);
check(
  "the schema contract survives",
  tier1Design.system.includes("sourceLabel") && tier1Design.system.includes("configDbType")
);
check(
  "the design is told to name the enforcing mechanism",
  tier1Design.system.includes("NAME THE MECHANISM")
);
check("the spec travels in the user message too", tier1Design.user.includes("REQUIREMENTS:"));

// Reverse-engineering a live site: a budget would make the model describe a
// system that does not exist.
const research = buildDesignPrompt({
  brief: "rebuild this",
  researchBrief: "The site uses Next.js and Stripe.",
  doc: simple,
});
check("a research brief uses the URL prompt", research.system === URL_ANALYSIS_SYSTEM_PROMPT);
check("a research brief is NOT given a component budget", !research.system.includes("at most"));

// ─── Recording the architecture into the spec ────────────────────────────────

const generated = applyArchitectureToSpec(
  simple,
  {
    reasoning: "",
    nodes: [
      { label: "Equipment API", category: "service", description: "serves the tracker", configTechnology: "Node.js" },
      { label: "Equipment DB", category: "database", description: "stores assignments", configReplication: "Replica" },
    ],
    edges: [{ sourceLabel: "Equipment API", targetLabel: "Equipment DB", label: "reads/writes" }],
  },
  2,
  "gen_1"
);
check("a new component is added", generated.added === 1, String(generated.added));
check("an existing component is matched by title, not duplicated", generated.updated === 1);
check(
  "no duplicate Equipment DB is created",
  componentsView(generated.doc).filter((c) => c.title === "Equipment DB").length === 1
);
check(
  "config the entity has no field for is carried into the responsibility",
  componentsView(generated.doc).some((c) => c.responsibility.includes("replication=Replica")),
  componentsView(generated.doc).map((c) => c.responsibility).join(" | ")
);
check(
  "generated components are INFERRED, never KNOWN",
  componentsView(generated.doc).some((c) => c.title === "Equipment API" && c.status === "INFERRED")
);
check(
  "edges become dependsOn relations carrying their label",
  new UssGraph(generated.doc).relations().some((r) => r.type === "dependsOn" && r.note === "reads/writes")
);
check("the result still parses", UssSchema.safeParse(generated.doc).success);

// ─── Requirement quality: EARS, vague words, contradictions ──────────────────

import {
  checkRequirementQuality,
  classifyEars,
  parseTarget,
  testabilityScore,
  vagueTermsIn,
} from "@/lib/uss/requirements-quality";

console.log("");

check("EARS event", classifyEars("WHEN a crew returns an item, THE SYSTEM SHALL mark it available") === "event");
check("EARS state", classifyEars("While offline, the app shall queue edits") === "state");
check("EARS unwanted", classifyEars("If payment fails, then the system shall release the stock") === "unwanted");
check("EARS optional", classifyEars("Where SSO is enabled, the system shall hide the password form") === "optional");
check("EARS ubiquitous", classifyEars("The system shall log every sign-in") === "ubiquitous");
check("EARS complex", classifyEars("While a sync is running, when the user edits, the system shall queue the edit") === "complex");
check("prose is not EARS", classifyEars("playback works") === null);
check("a trigger with no SHALL is not EARS", classifyEars("When the user uploads a file") === null);

check("vague words found", vagueTermsIn("Search is fast and user-friendly").join(",") === "fast,user-friendly");
check("vague match respects word boundaries", vagueTermsIn("THE SYSTEM SHALL serve breakfast menus").length === 0);
check("precise criterion has no vague words", vagueTermsIn("WHEN searching, THE SYSTEM SHALL respond in under 2 seconds").length === 0);

const reqDoc = (build: (g: UssGraph) => void) =>
  mutate(
    { ...createEmptySpec({ specId: "s", projectId: "p" }), complexity: normaliseComplexity({ ...createEmptySpec({ specId: "s", projectId: "p" }).complexity, tier: 2, status: "KNOWN", confidence: 1, evidence: [{ kind: "user-statement" }] }) },
    build
  );
const rq = (g: UssGraph, title: string, statement: string, criteria: string[] = [], priority: "must" | "should" | "could" = "must") =>
  g.add("requirement", { ...prov, title, requirementKind: "functional", statement, acceptanceCriteria: criteria, priority });
const nfr = (g: UssGraph, title: string, target: string) =>
  g.add("requirement", { ...prov, title, requirementKind: "non-functional", statement: title, nfrCategory: "performance", target, acceptanceCriteria: [], priority: "must" });

const testable = reqDoc((g) => {
  rq(g, "Check out", "Managers assign items", ["WHEN a manager assigns an item, THE SYSTEM SHALL show it as checked out"]);
  rq(g, "Search", "Find items", ["search is quick"]);
});
check("testability counts EARS + vague-free criteria", testabilityScore(testable) === 50, String(testabilityScore(testable)));
check("testability is null with no criteria", testabilityScore(reqDoc(() => {})) === null);
check("vague criteria raise one finding", checkRequirementQuality(testable).filter((f) => f.rule === "vague-criteria").length === 1);

const contradictory = reqDoc((g) => {
  rq(g, "Export", "Users can export their order history as CSV");
  rq(g, "No export", "The system shall not allow users to export their order history as CSV");
});
check(
  "direct contradiction is caught",
  checkRequirementQuality(contradictory).some((f) => f.rule === "contradictory-requirements" && f.severity === "blocking")
);

const notContradictory = reqDoc((g) => {
  rq(g, "Delete account", "Users can delete their account and profile");
  rq(g, "Keep audit", "The system shall not delete audit records of payments");
});
check("a shared verb alone is not a contradiction", !checkRequirementQuality(notContradictory).some((f) => f.rule === "contradictory-requirements"));

const outOfScope = reqDoc((g) => {
  g.add("product", { ...prov, title: "Tracker", problem: "p", valueProposition: "", inScope: [], outOfScope: ["billing"], successCriteria: [] });
  rq(g, "Invoices", "Send monthly billing invoices to crews");
  rq(g, "Maybe", "Show billing history", [], "could");
});
const scopeFindings = checkRequirementQuality(outOfScope).filter((f) => f.rule === "requirement-out-of-scope");
check("a must-requirement asking for out-of-scope work is caught", scopeFindings.length === 1);
check("a could-requirement is not held to scope", scopeFindings[0]?.subjects.length === 1);

check("parse availability target", parseTarget("99.9% uptime")?.value === 99.9);
check("parse latency target in seconds", parseTarget("p95 under 2s")?.value === 2000);
check("target with no metric is not parsed", parseTarget("feels snappy") === null);

const conflicting = reqDoc((g) => {
  nfr(g, "Search latency", "p95 < 300ms");
  nfr(g, "Page latency", "p95 under 2s");
});
check("two p95 targets that disagree are caught", checkRequirementQuality(conflicting).some((f) => f.rule === "conflicting-targets"));
const agreeing = reqDoc((g) => {
  nfr(g, "Search latency", "p95 < 300ms");
  nfr(g, "Same, in seconds", "p95 < 0.3s");
});
check("the same target in different units is not a conflict", !checkRequirementQuality(agreeing).some((f) => f.rule === "conflicting-targets"));
check("the complete tier-1 fixture raises no quality findings", checkRequirementQuality(simple).length === 0);
check("quality findings flow into checkIntegrity", checkIntegrity(contradictory).some((f) => f.rule === "contradictory-requirements"));

// ─── Task breakdown: requirements → design → ordered tasks ───────────────────

import { renderTasksMarkdown, taskBreakdown } from "@/lib/uss/tasks";

console.log("");

const linkProv = { status: "KNOWN" as const, confidence: 1, evidence: [{ kind: "user-statement" as const }], firstSeenVersion: 1 };
const ids: Record<string, string> = {};
const shop = reqDoc((g) => {
  const db = g.add("component", { ...prov, title: "Orders DB", category: "database", responsibility: "stores orders", technology: "PostgreSQL", orphaned: false });
  const files = g.add("component", { ...prov, title: "Receipts Store", category: "storage", responsibility: "stores receipts", orphaned: false });
  const api = g.add("component", { ...prov, title: "Orders API", category: "service", responsibility: "takes orders", orphaned: false });
  const web = g.add("component", { ...prov, title: "Web App", category: "client", responsibility: "checkout UI", orphaned: false });
  g.link("dependsOn", web.id, api.id, linkProv);
  g.link("dependsOn", api.id, db.id, linkProv);
  g.link("dependsOn", api.id, files.id, linkProv);
  const place = rq(g, "Place order", "Customers place an order", ["WHEN a customer submits a cart, THE SYSTEM SHALL create one order"]);
  const lonely = rq(g, "Export", "Managers export orders as CSV");
  g.link("satisfies", api.id, place.id, linkProv);
  const order = g.add("domainEntity", { ...prov, title: "Order", description: "", keyAttributes: [], tenantScoped: false, financial: false });
  g.link("manages", api.id, order.id, linkProv);
  g.add("transition", { ...prov, title: "Order: pending → paid", entityTitle: "Order", from: "pending", to: "paid", trigger: "", guard: "payment confirmed" });
  const inv = g.add("invariant", { ...prov, title: "No double pay", statement: "An order is paid at most once", category: "uniqueness", enforcement: "unique payment key", violationConsequence: "customer charged twice", severity: "critical" });
  g.link("enforcedBy", inv.id, api.id, linkProv);
  g.add("openDecision", { ...prov, title: "Guest checkout?", question: "Can customers check out without an account?", why: "", category: "auth", options: [], impact: { affectsComponents: [api.id], affectsRequirements: [], severity: "material" } });
  Object.assign(ids, { db: db.id, files: files.id, api: api.id, web: web.id, place: place.id, lonely: lonely.id, inv: inv.id });
});

const plan = taskBreakdown(shop);
const bySource = (id: string) => plan.tasks.find((t) => t.sourceId === id)!;
check("setup is the first task", plan.tasks[0]?.kind === "setup" && plan.tasks[0].id === "T001");
check("setup names the chosen stack", plan.tasks[0]?.detail.includes("PostgreSQL"));
check("stores are built before the API that needs them", bySource(ids.db).phase < bySource(ids.api).phase);
check("the API is built before the client that calls it", bySource(ids.api).phase < bySource(ids.web).phase);
check("the API task waits on both stores", [bySource(ids.db).id, bySource(ids.files).id].every((x) => bySource(ids.api).dependsOn.includes(x)));
check("independent stores in one phase are marked parallel", bySource(ids.db).parallel && bySource(ids.files).parallel);
check("a lone component in its phase is not marked parallel", !bySource(ids.web).parallel);
check("a task carries the requirements it delivers", bySource(ids.api).satisfies.includes(ids.place));
check("…and their acceptance criteria as its done-when", bySource(ids.api).doneWhen.some((d) => d.includes("THE SYSTEM SHALL create one order")));
check("an open question on a component blocks its task", bySource(ids.api).blockedBy.some((b) => b.question.includes("without an account")));
check("an invariant becomes a task after its enforcer", bySource(ids.inv).dependsOn.includes(bySource(ids.api).id));
check("a lifecycle becomes a task that rejects unlisted transitions", plan.tasks.some((t) => t.kind === "lifecycle" && t.detail.includes("pending → paid") && t.detail.includes("Reject")));
check("a requirement nothing delivers is surfaced, not dropped", bySource(ids.lonely)?.kind === "unassigned");
check("phases are numbered without gaps", plan.phases.every((p, i) => p.number === i + 1));
check("no task depends on a task in its own or a later phase", plan.tasks.every((t) => t.dependsOn.every((d) => plan.tasks.find((x) => x.id === d)!.phase < t.phase)));
check("task ids are deterministic", JSON.stringify(taskBreakdown(shop)) === JSON.stringify(plan));

const looped = reqDoc((g) => {
  const a = g.add("component", { ...prov, title: "A", category: "service", responsibility: "", orphaned: false });
  const b = g.add("component", { ...prov, title: "B", category: "service", responsibility: "", orphaned: false });
  g.link("dependsOn", a.id, b.id, linkProv);
  g.link("dependsOn", b.id, a.id, linkProv);
});
check("a dependency loop is detected, not hung on", taskBreakdown(looped).cycles.length === 2);
check("…and still produces tasks for both", taskBreakdown(looped).tasks.filter((t) => t.kind === "component").length === 2);

const md = renderTasksMarkdown(shop);
check("tasks.md uses the Spec Kit checkbox shape", /^- \[ \] T001 /m.test(md));
check("tasks.md tags parallel tasks and requirement ids", md.includes("[P]") && md.includes(`[${ids.place}]`));
check("an empty spec yields no tasks", taskBreakdown(reqDoc(() => {})).tasks.length === 0);

// ─── GitHub Spec Kit export ──────────────────────────────────────────────────

import { earsToScenario, renderConstitution, renderDataModel, renderPlan, renderSpec, renderSpeckitTasks } from "@/lib/uss/speckit";

console.log("");

check(
  "EARS event criterion becomes When/Then",
  earsToScenario("WHEN a cart is submitted, THE SYSTEM SHALL create one order") ===
    "**When** a cart is submitted, **Then** the system shall create one order"
);
check("EARS state criterion becomes Given/Then", earsToScenario("While offline, the app shall queue edits").startsWith("**Given** offline"));
check("non-EARS criterion is left as written", earsToScenario("playback works") === "playback works");

const speckit = getTarget("spec-kit");
check("Spec Kit target exists", speckit.id === "spec-kit");
check("every Spec Kit file renders without a model", speckit.files.every((f) => typeof f.render === "function"));
check("Spec Kit files use Spec Kit's layout", speckit.files.some((f) => f.path === ".specify/memory/constitution.md") && speckit.files.some((f) => /^specs\/\d{3}-[a-z-]+\/tasks\.md$/.test(f.path)));

const shopWithQuestion = mutate(shop, (g) => {
  g.add("openDecision", { ...prov, title: "Refunds?", question: "Can an order be refunded after shipping?", why: "", category: "scope", options: [], impact: { affectsComponents: [], affectsRequirements: [ids.place], severity: "material" } });
});
const specMd = renderSpec(shopWithQuestion, "Shop");
check("spec.md has Spec Kit's mandatory sections", ["## User Scenarios & Testing", "## Requirements", "## Success Criteria", "## Assumptions"].every((h) => specMd.includes(h)));
check("spec.md numbers requirements FR-### and keeps the SYPI id", /\*\*FR-001\*\* \(REQ-\d+/.test(specMd));
check("an open question on a requirement becomes a clarification marker", specMd.includes("[NEEDS CLARIFICATION: Can an order be refunded after shipping?]"));
check("acceptance criteria are rendered as When/Then", specMd.includes("**When** a customer submits a cart"));
check("a spec with no success criteria asks for them", specMd.includes("[NEEDS CLARIFICATION: how will you know this works?]"));

const planMd = renderPlan(shop, "Shop");
check("plan.md has Technical Context and a Constitution Check", planMd.includes("## Technical Context") && planMd.includes("## Constitution Check"));
check("plan.md names the chosen storage", planMd.includes("**Storage**: PostgreSQL"));
check("plan.md checks the invariant has an enforcer", planMd.includes(`[x] ${ids.inv} has an enforcer`));

check("constitution states the complexity budget", renderConstitution(shop, "Shop").includes("Proportionate complexity"));
check("constitution carries the invariants as laws", renderConstitution(shop, "Shop").includes("An order is paid at most once"));
check("data-model lists the legal lifecycle", renderDataModel(shop, "Shop").includes("pending → paid"));
check("Spec Kit tasks.md points at its design documents", renderSpeckitTasks(shop).includes("**Input**: Design documents from `/specs/001-initial-system/`"));
check("renderers survive an empty spec", [renderSpec, renderPlan, renderConstitution, renderDataModel].every((r) => r(reqDoc(() => {}), "X").length > 20));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

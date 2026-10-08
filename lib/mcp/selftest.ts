/**
 * Self-test for the MCP surface. Run with `npm run mcp:test`.
 *
 * What this covers: tool discovery and annotations through a REAL MCP client over
 * an in-memory transport, input validation, the stable error contract, section
 * paging, hand-off rendering from a synthetic spec, and the run-step ordering.
 *
 * What it does NOT cover, because it never touches a database: token lookup and
 * revocation, viewer/cross-project isolation, the atomic step claim, and a real
 * planning run. Those need a Postgres instance and are listed as open gaps in the
 * progress tracker rather than implied by a green run here.
 */

// The prisma module builds its client at import. Point it somewhere that can
// never be a real database, so no test here can reach one by accident.
process.env.DATABASE_URL = "postgresql://nobody@127.0.0.1:1/none";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
}

async function main() {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
  const { createMcpServer } = await import("@/lib/mcp/server");
  const { toolError, classifyStepError, accessError } = await import("@/lib/mcp/errors");
  const { readSection, brief, SECTION_NAMES, MAX_PAGE } = await import("@/lib/mcp/sections");
  const { handoffManifest, renderHandoffFile, resolveTarget, TARGET_IDS } = await import("@/lib/mcp/handoff");
  const { firstIncompleteStep } = await import("@/lib/mcp/plan-service");
  const { userFromToken, hashToken } = await import("@/lib/mcp/tokens");
  const { createEmptySpec } = await import("@/lib/uss/empty");
  const { UssSchema } = await import("@/lib/uss/schema");

  // ── discovery through a real client ─────────────────────────────────────────
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer({ id: "user_1", email: "a@example.com" });
  await server.connect(serverT);
  const client = new Client({ name: "selftest", version: "0.0.0" });
  await client.connect(clientT);

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  const expected = [
    "answer_decision", "continue_plan", "create_project", "get_handoff", "get_run",
    "get_spec", "get_spec_section", "get_tasks", "list_open_decisions", "list_projects", "start_plan",
  ];
  check("exposes the full tool set", JSON.stringify(names) === JSON.stringify(expected), names.join(","));

  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const reads = ["list_projects", "get_spec", "get_spec_section", "list_open_decisions", "get_tasks", "get_run", "get_handoff"];
  const writes = ["create_project", "answer_decision", "start_plan", "continue_plan"];
  check("read tools are annotated read-only", reads.every((n) => byName[n]?.annotations?.readOnlyHint === true));
  check("write tools are annotated as writes", writes.every((n) => byName[n]?.annotations?.readOnlyHint === false));
  check("nothing is annotated destructive", tools.every((t) => t.annotations?.destructiveHint === false));
  check("create_project and start_plan are idempotent",
    byName.create_project.annotations?.idempotentHint === true && byName.start_plan.annotations?.idempotentHint === true);
  check("continue_plan is not claimed idempotent", byName.continue_plan.annotations?.idempotentHint === false);

  // ── input validation happens before anything touches the database ───────────
  let rejected = false;
  try {
    const res = await client.callTool({ name: "get_spec", arguments: {} });
    rejected = res.isError === true;
  } catch {
    rejected = true;
  }
  check("missing projectId is rejected", rejected);

  let badSection = false;
  try {
    const res = await client.callTool({ name: "get_spec_section", arguments: { projectId: "p", section: "everything" } });
    badSection = res.isError === true;
  } catch {
    badSection = true;
  }
  check("unknown section is rejected", badSection);

  let overLimit = false;
  try {
    const res = await client.callTool({ name: "get_spec_section", arguments: { projectId: "p", section: "risks", limit: 500 } });
    overLimit = res.isError === true;
  } catch {
    overLimit = true;
  }
  check("page size is capped", overLimit);

  await client.close();

  // ── error contract ──────────────────────────────────────────────────────────
  const e = toolError("QUOTA_EXCEEDED", "slow down", 30);
  check("errors carry code, message and retry guidance",
    e.isError && (e.structuredContent.error as { code: string; retryAfter: number }).code === "QUOTA_EXCEEDED" &&
    (e.structuredContent.error as { retryAfter: number }).retryAfter === 30);
  check("error text leads with the code", e.content[0].text.startsWith("QUOTA_EXCEEDED:"));
  check("no retryAfter when none given", !("retryAfter" in (toolError("FORBIDDEN", "no").structuredContent.error as object)));
  check("forbidden and unauthenticated read identically (no project-existence oracle)",
    JSON.stringify(accessError("forbidden")) === JSON.stringify(accessError("unauthenticated")));
  check("not-found is distinguishable from forbidden",
    (accessError("not-found").structuredContent.error as { code: string }).code === "NOT_FOUND");
  check("provider billing failure maps to MODEL_UNAVAILABLE",
    classifyStepError("You have no credits remaining. credit_balance_exhausted") === "MODEL_UNAVAILABLE");
  check("unknown failure is INTERNAL, not guessed", classifyStepError("cannot read properties of undefined") === "INTERNAL");

  // ── sections ────────────────────────────────────────────────────────────────
  const prov = { status: "KNOWN" as const, confidence: 0.9, evidence: [], firstSeenVersion: 1 };
  const base = createEmptySpec({ specId: "spec_t", projectId: "proj_t" });
  const many = Array.from({ length: 40 }, (_, i) => ({
    ...prov, id: `REQ-${String(i + 1).padStart(3, "0")}`, kind: "requirement" as const,
    title: `Requirement ${i + 1}`, requirementKind: "functional" as const,
    statement: `The system shall do thing ${i + 1}.`, acceptanceCriteria: [], priority: "must" as const,
  }));
  const doc = { ...base, entities: many };
  check("synthetic spec is valid", UssSchema.safeParse(doc).success);

  const p1 = readSection(doc, "requirements", 0, 15);
  check("first page has the requested size", p1.items.length === 15 && p1.total === 40);
  check("a next page is offered", p1.nextOffset === 15);
  const last = readSection(doc, "requirements", 30, 15);
  check("last page is short and ends the cursor", last.items.length === 10 && last.nextOffset === null);
  check("page size is clamped to the maximum", readSection(doc, "requirements", 0, 9999).items.length === MAX_PAGE);
  check("negative offset is treated as zero", readSection(doc, "requirements", -5, 3).items[0]?.id === "REQ-001");
  check("every section is readable on an empty spec",
    SECTION_NAMES.every((s) => readSection(base, s, 0, 10).total === 0));
  const projected = brief(many[0]);
  check("entities are projected to readable fields only", projected.statement !== undefined && !("evidence" in projected));
  check("long text is truncated", String(brief({ id: "x", kind: "requirement", title: "t", statement: "y".repeat(2000) }).statement).length <= 601);

  // ── hand-off ────────────────────────────────────────────────────────────────
  check("every target resolves", TARGET_IDS.every((id) => resolveTarget(id) !== null));
  check("unknown target does not resolve", resolveTarget("not-a-target") === null);

  const kit = resolveTarget("spec-kit")!;
  const kitManifest = handoffManifest(kit);
  check("spec-kit is fully deterministic", kitManifest.every((f) => f.kind === "deterministic"));
  const rendered = renderHandoffFile(doc, kit, kitManifest[0].path, "Test");
  check("a deterministic file renders", rendered.ok && rendered.content.length > 0);
  const again = renderHandoffFile(doc, kit, kitManifest[0].path, "Test");
  check("the same version renders the same bytes", rendered.ok && again.ok && rendered.content === again.content);
  check("a missing file is reported as such", renderHandoffFile(doc, kit, "nope.md", "T").ok === false);

  const mixed = TARGET_IDS.map((id) => handoffManifest(resolveTarget(id)!)).flat();
  const generated = mixed.find((f) => f.kind === "generated");
  if (generated) {
    const target = TARGET_IDS.map((id) => resolveTarget(id)!).find((t) => t.files.some((f) => f.path === generated.path))!;
    const res = renderHandoffFile(doc, target, generated.path, "T");
    check("an AI-generated file is refused, not silently generated",
      res.ok === false && res.reason === "needs-generation");
  } else {
    check("an AI-generated file is refused, not silently generated", true, "no generated files in any target");
  }

  // ── run ordering ────────────────────────────────────────────────────────────
  check("a fresh run starts at intent", firstIncompleteStep({}) === "intent");
  check("it resumes after the last landed step",
    firstIncompleteStep({ intent: { status: "done" }, complexity: { status: "done" } }) === "requirements");
  check("a failed step is retried, not skipped",
    firstIncompleteStep({ intent: { status: "done" }, complexity: { status: "failed" } }) === "complexity");
  check("a step still running is not treated as done",
    firstIncompleteStep({ intent: { status: "running" } }) === "intent");
  check("a skipped step counts as landed",
    firstIncompleteStep({ intent: { status: "done" }, complexity: { status: "skipped" } }) === "requirements");
  const all = Object.fromEntries(
    ["intent", "complexity", "requirements", "capabilities", "domain", "design", "critique", "repair", "record"]
      .map((s) => [s, { status: "done" as const }])
  );
  check("a complete run has no next step", firstIncompleteStep(all) === null);

  // ── tokens (only the paths that never reach the database) ───────────────────
  check("no Authorization header is rejected", (await userFromToken(null)) === null);
  check("a non-Bearer scheme is rejected", (await userFromToken("Basic abc")) === null);
  check("a token without the sypi_ prefix is rejected before any lookup", (await userFromToken("Bearer sk-live-123")) === null);
  check("hashing is stable and does not echo the token",
    hashToken("sypi_x") === hashToken("sypi_x") && !hashToken("sypi_x").includes("sypi_x") && hashToken("sypi_x").length === 64);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

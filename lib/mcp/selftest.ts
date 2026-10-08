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
  process.env.ENCRYPTION_SECRET = "selftest-secret";
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

  // ── OAuth ───────────────────────────────────────────────────────────────────
  const oauth = await import("@/lib/mcp/oauth");
  const { createHash } = await import("node:crypto");

  const signed = oauth.sign("code", { u: "user_1" }, 60);
  check("a signed value verifies", oauth.verify("code", signed)?.u === "user_1");
  check("a value of another kind is refused", oauth.verify("ticket", signed) === null);
  const [body, sig] = signed.split(".");
  const forged = Buffer.from(JSON.stringify({ k: "code", e: 9999999999, d: { u: "attacker" } })).toString("base64url");
  check("a tampered payload is refused", oauth.verify("code", `${forged}.${sig}`) === null);
  check("a tampered signature is refused", oauth.verify("code", `${body}.${sig.slice(0, -2)}xx`) === null);
  check("an expired value is refused", oauth.verify("code", oauth.sign("code", { u: "x" }, -5)) === null);
  check("garbage and empty values are refused",
    oauth.verify("code", "nope") === null && oauth.verify("code", "") === null && oauth.verify("code", null) === null);
  check("extra segments are refused", oauth.verify("code", `${signed}.extra`) === null);

  process.env.ENCRYPTION_SECRET = "a-different-secret";
  check("a value signed under another secret is refused", oauth.verify("code", signed) === null);
  process.env.ENCRYPTION_SECRET = "selftest-secret";

  const saved = process.env.ENCRYPTION_SECRET;
  delete process.env.ENCRYPTION_SECRET;
  let threw = false;
  try { oauth.sign("code", {}, 5); } catch (err) { threw = err instanceof oauth.OAuthConfigError; }
  check("signing without a secret fails loudly, not silently", threw);
  process.env.ENCRYPTION_SECRET = saved;

  // Redirect validation is the whole defence against sending a code to an attacker.
  const cid = oauth.registerClient("My App", ["https://app.example.com/cb"]);
  check("a registered client may use its exact redirect", oauth.resolveClient(cid, "https://app.example.com/cb")?.registered === true);
  const spoof = oauth.registerClient("ChatGPT", ["https://evil.example.com/cb"]);
  check("a registered client cannot borrow a trusted name for an untrusted host",
    oauth.resolveClient(spoof, "https://evil.example.com/cb")?.name === "evil.example.com");
  const real = oauth.registerClient("ChatGPT", ["https://chatgpt.com/connector/oauth/zz"]);
  check("a registered client on a trusted host keeps its name",
    oauth.resolveClient(real, "https://chatgpt.com/connector/oauth/zz")?.name === "ChatGPT");
  check("a registered client may NOT use another redirect", oauth.resolveClient(cid, "https://app.example.com/other") === null);
  check("a registered client may NOT use another host", oauth.resolveClient(cid, "https://evil.example.com/cb") === null);
  check("ChatGPT's connector callback is accepted",
    oauth.resolveClient("any-id", "https://chatgpt.com/connector/oauth/Bf_1l1t1CeVP")?.name === "ChatGPT");
  check("Claude's callback is accepted", oauth.resolveClient("any-id", "https://claude.ai/api/mcp/auth_callback")?.name === "Claude");
  check("an unknown host is refused for an unregistered client", oauth.resolveClient("any-id", "https://evil.example.com/cb") === null);
  check("a look-alike host is refused", oauth.resolveClient("any-id", "https://chatgpt.com.evil.com/cb") === null);
  check("a suffix trick is refused", oauth.resolveClient("any-id", "https://notchatgpt.com/cb") === null);
  check("plain http is refused off loopback", oauth.resolveClient("any-id", "http://chatgpt.com/cb") === null);
  check("loopback http is allowed (Claude Code)", oauth.resolveClient("any-id", "http://localhost:53682/callback") !== null);
  check("a fragment is refused", oauth.resolveClient("any-id", "https://chatgpt.com/cb#x") === null);
  check("javascript: and data: URIs are refused",
    oauth.resolveClient("any-id", "javascript:alert(1)") === null && oauth.resolveClient("any-id", "data:text/html,x") === null);
  check("a forged client id is not trusted as registered",
    oauth.resolveClient(`${cid.slice(0, -3)}abc`, "https://app.example.com/cb") === null);
  check("registration refuses unusable redirect URIs",
    oauth.isAcceptableRedirect("https://a.example.com/cb") && !oauth.isAcceptableRedirect("http://a.example.com/cb") && !oauth.isAcceptableRedirect("ftp://a/b"));

  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  check("PKCE matches the right verifier", oauth.pkceMatches(verifier, challenge));
  check("PKCE rejects a wrong verifier", !oauth.pkceMatches(`${verifier.slice(0, -1)}X`, challenge));
  check("PKCE rejects a too-short verifier even if it hashes to the challenge",
    !oauth.pkceMatches("short", createHash("sha256").update("short").digest("base64url")));
  check("PKCE matches the RFC 7636 appendix B vector",
    oauth.pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") === "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");

  const origin = "https://sypi.example.com";
  const prm = oauth.protectedResourceMetadata(origin);
  const asm = oauth.authorizationServerMetadata(origin);
  check("resource metadata names the MCP endpoint and this issuer",
    prm.resource === `${origin}/api/mcp` && prm.authorization_servers[0] === origin);
  check("server metadata requires PKCE S256 and a public client",
    asm.code_challenge_methods_supported[0] === "S256" && asm.token_endpoint_auth_methods_supported[0] === "none");
  check("server metadata advertises registration, authorize and token endpoints",
    asm.registration_endpoint.endsWith("/api/oauth/register") && asm.authorization_endpoint.endsWith("/oauth/authorize") && asm.token_endpoint.endsWith("/api/oauth/token"));
  check("the 401 hint points at the path-suffixed metadata", oauth.resourceMetadataUrl(origin) === `${origin}/.well-known/oauth-protected-resource/api/mcp`);
  check("a foreign resource indicator is refused", !oauth.resourceIsOurs("https://other.example.com/api/mcp", origin));
  check("our resource indicator, or none, is accepted",
    oauth.resourceIsOurs(`${origin}/api/mcp`, origin) && oauth.resourceIsOurs(null, origin));

  // The real route handlers, called with real Requests. Everything asserted here
  // returns before any database call.
  const reg = await import("@/app/api/oauth/register/route");
  const tok = await import("@/app/api/oauth/token/route");
  const prmRoute = await import("@/app/.well-known/oauth-protected-resource/[[...path]]/route");
  const asmRoute = await import("@/app/.well-known/oauth-authorization-server/[[...path]]/route");
  const mcpRoute = await import("@/app/api/mcp/route");
  const H = "https://sypi.example.com";
  const post = (path: string, body: string, type: string) =>
    new Request(`${H}${path}`, { method: "POST", headers: { "content-type": type }, body });

  const metaRes = await prmRoute.GET(new Request(`${H}/.well-known/oauth-protected-resource/api/mcp`));
  const metaJson = await metaRes.json();
  check("resource metadata route serves JSON for the request's own origin", metaRes.status === 200 && metaJson.resource === `${H}/api/mcp`);
  const asRes = await asmRoute.GET(new Request(`${H}/.well-known/oauth-authorization-server`));
  check("server metadata route serves JSON", (await asRes.json()).issuer === H);

  const unauth = await mcpRoute.POST(new Request(`${H}/api/mcp`, { method: "POST", body: "{}" }));
  const hint = unauth.headers.get("www-authenticate") ?? "";
  check("an unauthenticated MCP call is 401", unauth.status === 401);
  check("…and tells the client where to discover OAuth",
    hint.includes(`resource_metadata="${H}/.well-known/oauth-protected-resource/api/mcp"`), hint);

  const regRes = await reg.POST(post("/api/oauth/register", JSON.stringify({ client_name: "ChatGPT", redirect_uris: ["https://chatgpt.com/connector/oauth/abc"] }), "application/json"));
  const regJson = await regRes.json();
  check("registration returns a client id", regRes.status === 201 && typeof regJson.client_id === "string");
  check("the registered client id resolves to its own redirect",
    oauth.resolveClient(regJson.client_id, "https://chatgpt.com/connector/oauth/abc")?.registered === true);
  const badReg = await reg.POST(post("/api/oauth/register", JSON.stringify({ redirect_uris: ["http://evil.example.com/cb"] }), "application/json"));
  check("registration refuses an insecure redirect", badReg.status === 400 && (await badReg.json()).error === "invalid_redirect_uri");
  const noReg = await reg.POST(post("/api/oauth/register", "{}", "application/json"));
  check("registration requires redirect URIs", noReg.status === 400);

  const goodCode = oauth.sign("code", { u: "user_1", cid: "c", ru: "https://chatgpt.com/cb", cc: challenge, n: "ChatGPT" }, 60);
  const form = (o: Record<string, string>) => post("/api/oauth/token", new URLSearchParams(o).toString(), "application/x-www-form-urlencoded");
  const t1 = await tok.POST(form({ grant_type: "refresh_token", refresh_token: "x" }));
  check("token endpoint refuses grants it does not support", t1.status === 400 && (await t1.json()).error === "unsupported_grant_type");
  const t2 = await tok.POST(form({ grant_type: "authorization_code", code: "garbage", redirect_uri: "https://chatgpt.com/cb", code_verifier: verifier }));
  check("token endpoint refuses a forged code", t2.status === 400 && (await t2.json()).error === "invalid_grant");
  const t3 = await tok.POST(form({ grant_type: "authorization_code", code: goodCode, redirect_uri: "https://evil.example.com/cb", code_verifier: verifier }));
  check("token endpoint refuses a different redirect_uri", t3.status === 400 && (await t3.json()).error === "invalid_grant");
  const t4 = await tok.POST(form({ grant_type: "authorization_code", code: goodCode, redirect_uri: "https://chatgpt.com/cb", code_verifier: `${verifier.slice(0, -1)}X` }));
  check("token endpoint refuses a wrong PKCE verifier", t4.status === 400 && (await t4.json()).error === "invalid_grant");
  const t5 = await tok.POST(form({ grant_type: "authorization_code", code: goodCode, redirect_uri: "https://chatgpt.com/cb" }));
  check("token endpoint requires a verifier", t5.status === 400);
  const t6 = await tok.POST(form({ grant_type: "authorization_code", code: goodCode, redirect_uri: "https://chatgpt.com/cb", client_id: "someone-else", code_verifier: verifier }));
  check("token endpoint refuses a different client_id", t6.status === 400 && (await t6.json()).error === "invalid_grant");
  const t7 = await tok.POST(form({ grant_type: "authorization_code", code: oauth.sign("code", { u: "u", cid: "c", ru: "https://chatgpt.com/cb", cc: challenge }, -5), redirect_uri: "https://chatgpt.com/cb", code_verifier: verifier }));
  check("token endpoint refuses an expired code", t7.status === 400);
  check("token responses are never cacheable", t1.headers.get("cache-control") === "no-store");

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

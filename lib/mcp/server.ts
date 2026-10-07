import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getProjectAccessForUser } from "@/lib/project-access";
import { enforceAiQuota } from "@/lib/ai/limits";
import { commitWithRetry, getSpec } from "@/lib/uss/store";
import { applyAnswer } from "@/lib/uss/answer";
import { computeSpecHealth } from "@/lib/uss/gaps";
import { renderTasksMarkdown } from "@/lib/uss/tasks";
import { materialOpenDecisions, product, requirements, specCoverage } from "@/lib/uss/views";

type McpUser = { id: string; email: string };

const text = (body: unknown) => ({
  content: [
    { type: "text" as const, text: typeof body === "string" ? body : JSON.stringify(body, null, 2) },
  ],
});
const fail = (message: string) => ({ ...text(message), isError: true });

/**
 * The MCP surface: what an agent outside the browser may do to a SYPI spec.
 *
 * Every tool re-checks project access for the token's user — a token is an identity,
 * not a grant. Reading needs any role; answering needs owner or editor.
 */
export function createMcpServer(user: McpUser) {
  const server = new McpServer({ name: "sypi", version: "1.0.0" });

  server.registerTool(
    "list_projects",
    { description: "List the SYPI projects you own or collaborate on." },
    async () => {
      const rows = await prisma.project.findMany({
        where: {
          OR: [
            { userId: user.id },
            { collaborators: { some: { OR: [{ userId: user.id }, { email: user.email.toLowerCase() }] } } },
          ],
        },
        select: { id: true, name: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });
      return text(rows);
    }
  );

  server.registerTool(
    "get_spec",
    {
      description:
        "Summary of a project's system specification: product, tier, coverage, health, and counts.",
      inputSchema: { projectId: z.string() },
    },
    async ({ projectId }) => {
      const access = await getProjectAccessForUser(projectId, user);
      if (!access.project) return fail(`No access to that project (${access.reason}).`);
      const record = await getSpec(projectId);
      if (!record) return fail("This project has no specification yet. Generate one in SYPI first.");
      const { doc, version } = record;
      return text({
        version,
        product: product(doc)?.title ?? null,
        tier: doc.complexity.label,
        coverage: specCoverage(doc),
        health: computeSpecHealth(doc),
        requirements: requirements(doc).length,
        components: doc.entities.filter((e) => e.kind === "component").length,
        openMaterialDecisions: materialOpenDecisions(doc).length,
      });
    }
  );

  server.registerTool(
    "list_open_decisions",
    {
      description:
        "The open questions that would change the architecture or block it. Answer them with answer_decision.",
      inputSchema: { projectId: z.string() },
    },
    async ({ projectId }) => {
      const access = await getProjectAccessForUser(projectId, user);
      if (!access.project) return fail(`No access to that project (${access.reason}).`);
      const record = await getSpec(projectId);
      if (!record) return fail("This project has no specification yet.");
      return text(
        materialOpenDecisions(record.doc).map((d) => ({
          id: d.id,
          question: d.question,
          why: d.why,
          category: d.category,
          severity: d.impact.severity,
          options: d.options,
        }))
      );
    }
  );

  server.registerTool(
    "answer_decision",
    {
      description:
        "Record the user's answer to one open decision. Only call this with an answer the user actually gave you — it is stored as the user's stated constraint.",
      inputSchema: {
        projectId: z.string(),
        decisionId: z.string(),
        answer: z.string().min(1).max(2000),
      },
    },
    async ({ projectId, decisionId, answer }) => {
      const access = await getProjectAccessForUser(projectId, user);
      if (!access.project) return fail(`No access to that project (${access.reason}).`);
      if (access.role === "viewer") return fail("Viewers can read a spec but not change it.");

      const quota = await enforceAiQuota(user.id, "intent");
      if (quota) return fail("Rate limit reached. Try again shortly.");

      try {
        const result = await commitWithRetry({
          projectId,
          source: "answer",
          changeSummary: `Answered ${decisionId} (via MCP)`,
          authorUserId: user.id,
          apply: (current) => applyAnswer(current, decisionId, answer).doc,
        });
        return text({ ok: true, version: result.version, coverage: specCoverage(result.doc) });
      } catch (err) {
        return fail(err instanceof Error ? err.message : "Could not record the answer.");
      }
    }
  );

  server.registerTool(
    "get_tasks",
    {
      description: "The ordered build plan for a project, as tasks.md (GitHub Spec Kit shape).",
      inputSchema: { projectId: z.string() },
    },
    async ({ projectId }) => {
      const access = await getProjectAccessForUser(projectId, user);
      if (!access.project) return fail(`No access to that project (${access.reason}).`);
      const record = await getSpec(projectId);
      if (!record) return fail("This project has no specification yet.");
      return text(renderTasksMarkdown(record.doc));
    }
  );

  return server;
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canEditProject, getProjectAccessForUser } from "@/lib/project-access";
import { createProjectForUser } from "@/lib/project-create";
import { checkAiQuota } from "@/lib/ai/limits";
import { checkRateLimit } from "@/lib/rate-limit";
import { commitWithRetry, getSpec } from "@/lib/uss/store";
import { applyAnswer } from "@/lib/uss/answer";
import { computeSpecHealth } from "@/lib/uss/gaps";
import { renderTasksMarkdown } from "@/lib/uss/tasks";
import { UssSchema, type Uss } from "@/lib/uss/schema";
import { materialOpenDecisions, product, requirements, specCoverage } from "@/lib/uss/views";
import { accessError, toolError } from "@/lib/mcp/errors";
import { handoffManifest, renderHandoffFile, resolveTarget, TARGET_IDS } from "@/lib/mcp/handoff";
import { continuePlan, getRunResult, startPlanResult } from "@/lib/mcp/plan-service";
import { DEFAULT_PAGE, MAX_PAGE, readSection, SECTION_NAMES } from "@/lib/mcp/sections";

type McpUser = { id: string; email: string };

/**
 * A result a model can read and a host can parse: JSON as text, and the same
 * object as structuredContent. `projectId` and `version` ride on every response
 * so the conversation always knows which plan, at which revision, it is holding.
 */
function ok(data: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

/** Service results are either a ready tool error or plain data. */
function isToolError(x: unknown): x is ReturnType<typeof toolError> {
  return typeof x === "object" && x !== null && "isError" in x;
}

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE_IDEMPOTENT = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const projectId = z.string().min(1).max(64).describe("A project id from list_projects or create_project");

/**
 * The MCP surface: what an agent outside the browser may do to a SYPI spec.
 *
 * Annotations tell a host what is safe to auto-approve; they are hints, not
 * enforcement. Every tool re-checks project access for the token's user — a
 * token is an identity, not a grant. Reading needs any role; changing anything
 * needs owner or editor.
 */
export function createMcpServer(user: McpUser) {
  const server = new McpServer({ name: "sypi", version: "1.1.0" });

  async function readable(id: string) {
    const access = await getProjectAccessForUser(id, user);
    return access.project ? { project: access.project, role: access.role } : { error: accessError(access.reason) };
  }

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List the SYPI projects you own or collaborate on, newest first.",
      inputSchema: { offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(50).optional() },
      annotations: READ,
    },
    async ({ offset = 0, limit = 25 }) => {
      const where = {
        OR: [
          { userId: user.id },
          { collaborators: { some: { OR: [{ userId: user.id }, { email: user.email.toLowerCase() }] } } },
        ],
      };
      const [rows, total] = await Promise.all([
        prisma.project.findMany({
          where,
          select: { id: true, name: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          skip: offset,
          take: limit,
        }),
        prisma.project.count({ where }),
      ]);
      return ok({
        total,
        projects: rows,
        nextOffset: offset + rows.length < total ? offset + rows.length : null,
      });
    }
  );

  server.registerTool(
    "create_project",
    {
      title: "Create a project",
      description:
        "Create a new SYPI project. Follow with start_plan to turn a brief into a plan. Calling this twice with the same name and description returns the same project.",
      inputSchema: {
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    async ({ name, description }) => {
      const limit = checkRateLimit(`mcp:create:${user.id}`, 10, 60_000);
      if (!limit.ok) return toolError("QUOTA_EXCEEDED", "Creating projects too quickly.", limit.retryAfter);

      const { project, reused } = await createProjectForUser(user.id, { name, description }, { reuseRecent: true });
      return ok({
        projectId: project.id,
        name: project.name,
        reused,
        version: null,
        nextAction: { tool: "start_plan", args: { projectId: project.id } },
      });
    }
  );

  server.registerTool(
    "get_spec",
    {
      title: "Get spec summary",
      description:
        "Summary of a project's system specification: product, tier, coverage, health and counts. Use get_spec_section for the content.",
      inputSchema: { projectId },
      annotations: READ,
    },
    async ({ projectId: id }) => {
      const r = await readable(id);
      if (r.error) return r.error;
      const record = await getSpec(id);
      if (!record) {
        return toolError("NOT_FOUND", "This project has no specification yet. Call start_plan first.");
      }
      const { doc, version } = record;
      return ok({
        projectId: id,
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
    "get_spec_section",
    {
      title: "Read a spec section",
      description:
        "Read one section of the specification, paged: requirements, architecture (components), decisions (open questions), risks (integrity findings, most severe first) or domain (business entities and rules that must hold).",
      inputSchema: {
        projectId,
        section: z.enum(SECTION_NAMES),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(MAX_PAGE).optional().describe(`Default ${DEFAULT_PAGE}`),
      },
      annotations: READ,
    },
    async ({ projectId: id, section, offset = 0, limit = DEFAULT_PAGE }) => {
      const r = await readable(id);
      if (r.error) return r.error;
      const record = await getSpec(id);
      if (!record) return toolError("NOT_FOUND", "This project has no specification yet.");
      const page = readSection(record.doc, section, offset, limit);
      return ok({ projectId: id, version: record.version, section, ...page });
    }
  );

  server.registerTool(
    "list_open_decisions",
    {
      title: "List open decisions",
      description:
        "The open questions that would change the architecture or block it. Ask the user each one, then record their answer with answer_decision.",
      inputSchema: { projectId },
      annotations: READ,
    },
    async ({ projectId: id }) => {
      const r = await readable(id);
      if (r.error) return r.error;
      const record = await getSpec(id);
      if (!record) return toolError("NOT_FOUND", "This project has no specification yet.");
      return ok({
        projectId: id,
        version: record.version,
        decisions: materialOpenDecisions(record.doc).map((d) => ({
          id: d.id,
          question: d.question,
          why: d.why,
          category: d.category,
          severity: d.impact.severity,
          options: d.options,
        })),
      });
    }
  );

  server.registerTool(
    "answer_decision",
    {
      title: "Answer a decision",
      description:
        "Record the user's answer to one open decision. Only call this with an answer the user actually gave you — it is stored as the user's stated constraint.",
      inputSchema: {
        projectId,
        decisionId: z.string().min(1).max(64),
        answer: z.string().min(1).max(2000),
      },
      annotations: WRITE,
    },
    async ({ projectId: id, decisionId, answer }) => {
      const r = await readable(id);
      if (r.error) return r.error;
      if (!canEditProject(r.role)) {
        return toolError("FORBIDDEN", "Viewers can read a spec but not change it.");
      }

      const quota = await checkAiQuota(user.id, "intent");
      if (!quota.ok) return toolError("QUOTA_EXCEEDED", quota.error, quota.retryAfter || undefined);

      try {
        const result = await commitWithRetry({
          projectId: id,
          source: "answer",
          changeSummary: `Answered ${decisionId} (via MCP)`,
          authorUserId: user.id,
          apply: (current) => applyAnswer(current, decisionId, answer).doc,
        });
        return ok({ projectId: id, version: result.version, coverage: specCoverage(result.doc) });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not record the answer.";
        if (/no longer open/i.test(message)) return toolError("NOT_FOUND", message);
        if (/changed since you read/i.test(message)) return toolError("VERSION_CONFLICT", message, 2);
        return toolError("INTERNAL", message);
      }
    }
  );

  server.registerTool(
    "get_tasks",
    {
      title: "Get the build plan",
      description: "The ordered build plan for a project, as tasks.md (GitHub Spec Kit shape).",
      inputSchema: { projectId },
      annotations: READ,
    },
    async ({ projectId: id }) => {
      const r = await readable(id);
      if (r.error) return r.error;
      const record = await getSpec(id);
      if (!record) return toolError("NOT_FOUND", "This project has no specification yet.");
      return ok({ projectId: id, version: record.version, tasksMarkdown: renderTasksMarkdown(record.doc) });
    }
  );

  server.registerTool(
    "start_plan",
    {
      title: "Start planning",
      description:
        "Begin turning a brief into a full specification. Charges one planning run. Then call continue_plan repeatedly — each call does ONE step — until it reports done. Retrying with the same brief resumes the run instead of charging again.",
      inputSchema: { projectId, brief: z.string().min(1).max(6000) },
      annotations: WRITE_IDEMPOTENT,
    },
    async ({ projectId: id, brief }) => {
      const result = await startPlanResult(user, id, brief);
      return isToolError(result) ? result : ok(result);
    }
  );

  server.registerTool(
    "continue_plan",
    {
      title: "Continue planning",
      description:
        "Run the next planning step (about 30–80 seconds). Returns what was done and whether more remain. If it reports STEP_IN_PROGRESS, wait and call it again; if a step fails, calling it again retries that step.",
      inputSchema: { projectId, runId: z.string().min(1).max(64) },
      annotations: WRITE,
    },
    async ({ projectId: id, runId }) => {
      const result = await continuePlan(user, id, runId);
      if (isToolError(result)) return result;
      const { run, ...rest } = result;
      return ok({
        projectId: id,
        runId,
        ...rest,
        nextAction: rest.done ? { tool: "list_open_decisions", args: { projectId: id } } : { tool: "continue_plan", args: { projectId: id, runId } },
        steps: Object.entries(run.steps).map(([step, s]) => ({ step, status: s.status, detail: s.detail })),
      });
    }
  );

  server.registerTool(
    "get_run",
    {
      title: "Check a planning run",
      description: "Progress of a planning run: each step's status and the next action. Observing a run does not advance it.",
      inputSchema: { projectId, runId: z.string().min(1).max(64) },
      annotations: READ,
    },
    async ({ projectId: id, runId }) => {
      const result = await getRunResult(user, id, runId);
      return isToolError(result) ? result : ok(result);
    }
  );

  server.registerTool(
    "get_handoff",
    {
      title: "Get hand-off files",
      description: `Hand-off files for a build target (${TARGET_IDS.join(", ")}), rendered from a pinned spec version so the receiving agent can detect drift. Without a path it returns the file manifest; with a path it returns that file. Files that need AI generation are marked "generated" and are produced in the SYPI app, not here.`,
      inputSchema: {
        projectId,
        target: z.enum(TARGET_IDS as [string, ...string[]]),
        path: z.string().max(200).optional(),
        version: z.number().int().min(1).optional().describe("Spec version to pin; defaults to the latest"),
      },
      annotations: READ,
    },
    async ({ projectId: id, target, path, version }) => {
      const r = await readable(id);
      if (r.error) return r.error;

      let doc: Uss | null = null;
      let pinned: number | null = null;
      const head = await getSpec(id);
      if (!head) return toolError("NOT_FOUND", "This project has no specification yet.");

      if (version === undefined || version === head.version) {
        doc = head.doc;
        pinned = head.version;
      } else {
        const row = await prisma.systemSpecVersion.findFirst({
          where: { version, spec: { projectId: id } },
          select: { doc: true, version: true },
        });
        const parsed = row ? UssSchema.safeParse(row.doc) : null;
        if (!row || !parsed?.success) return toolError("NOT_FOUND", `No readable version ${version} of this spec.`);
        doc = parsed.data;
        pinned = row.version;
      }

      const t = resolveTarget(target);
      if (!t) return toolError("BAD_REQUEST", `Unknown target. Options: ${TARGET_IDS.join(", ")}`);

      if (!path) {
        return ok({
          projectId: id,
          version: pinned,
          latestVersion: head.version,
          target: t.id,
          files: handoffManifest(t),
        });
      }

      const file = renderHandoffFile(doc, t, path, r.project.name);
      if (!file.ok) {
        return file.reason === "no-such-file"
          ? toolError("NOT_FOUND", `"${path}" is not a file in the ${t.id} hand-off.`)
          : toolError("BAD_REQUEST", `"${path}" is AI-generated; generate it in the SYPI app's Handoff tab.`);
      }
      return ok({
        projectId: id,
        version: pinned,
        latestVersion: head.version,
        target: t.id,
        path: file.path,
        title: file.title,
        content: file.content,
      });
    }
  );

  return server;
}

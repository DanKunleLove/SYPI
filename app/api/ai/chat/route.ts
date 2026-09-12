import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  applyUserInstructions,
  getUserInstructions,
  resolveModelForProject,
} from "@/lib/ai/index";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { createAgentTools, type AgentContext } from "@/lib/ai/agent-tools";
import { extractUrls, fetchSiteEvidence } from "@/lib/ai/url-research";
import { enforceAiQuota } from "@/lib/ai/limits";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { getSpec } from "@/lib/uss/store";
import { renderUssForPrompt, renderUssSummary } from "@/lib/uss/render";

// Agent turns can chain research → generation → review; give them room.
export const maxDuration = 300;

/** Concatenate the text parts of the latest user message (UIMessage shape). */
function lastUserText(messages: UIMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");
}

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { messages?: unknown; canvasContext?: unknown; projectId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { messages, canvasContext, projectId } = body;

  if (!messages || !projectId || typeof projectId !== "string") {
    return Response.json(
      { error: "messages and projectId are required" },
      { status: 400 }
    );
  }

  // Verify the user can access this project before spending AI calls on it.
  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const limited = await enforceAiQuota(user.id, "chat");
  if (limited) return limited;

  // Build system prompt with canvas context
  const context =
    typeof canvasContext === "string" ? canvasContext.slice(0, 24_000) : undefined;
  let systemPrompt = context
    ? `${CHAT_SYSTEM_PROMPT}\n\n${context}`
    : CHAT_SYSTEM_PROMPT;

  // Ground URL mentions in the live site instead of letting the model guess.
  const uiMessages = messages as UIMessage[];
  if (Array.isArray(uiMessages) && uiMessages.length > 60) {
    return Response.json({ error: "Conversation too long" }, { status: 400 });
  }
  const urls = extractUrls(lastUserText(uiMessages), 2);
  if (urls.length > 0) {
    const evidence = await Promise.all(urls.map((u) => fetchSiteEvidence(u)));
    systemPrompt += `\n\nThe user referenced URL(s). Live evidence fetched just now:\n\n${evidence.join(
      "\n\n"
    )}\n\nAnswer based on this evidence; mark anything beyond it as an assumption.`;
  }

  const userInstructions = await getUserInstructions(user.id);

  // Give the agent what the spec already establishes, plus the questions that are
  // still open, so it stops re-asking what it has been told and can call
  // resolveOpenDecision when the user settles one.
  let ussSummary: string | undefined;
  try {
    const spec = await getSpec(projectId);
    if (spec) {
      ussSummary = renderUssSummary(spec.doc);
      const specBlock = renderUssForPrompt(spec.doc, {
        sections: ["product", "actors", "constraints", "complexity", "openDecisions"],
        maxChars: 6_000,
      });
      if (specBlock) systemPrompt += `\n\nWHAT IS ESTABLISHED SO FAR:\n${specBlock}`;
    }
  } catch {
    // The spec is an enhancement to chat, never a prerequisite.
  }

  systemPrompt = applyUserInstructions(systemPrompt, userInstructions);

  // Shared mutable context: generation updates it so later tools in the same
  // turn (e.g. review right after generate) see the new architecture.
  const agentCtx: AgentContext = {
    projectId,
    userId: user.id,
    canvasContext: context,
    ussSummary,
    userInstructions,
  };

  const result = streamText({
    model: await resolveModelForProject(projectId, "flash"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages as UIMessage[]),
    tools: {
      ...createAgentTools(agentCtx),
      addNode: tool({
        description:
          "Add a new component to the architecture canvas. Returns the node data for the client to place.",
        inputSchema: z.object({
          category: z.enum([
            "service", "database", "queue", "gateway",
            "client", "cache", "storage", "compute", "custom",
          ]).describe("The type of component to add"),
          label: z.string().describe("Name for the component, e.g. 'Redis Cache'"),
          description: z.string().optional().describe("Brief description"),
        }),
        execute: async ({ category, label, description }) => {
          return { action: "addNode", category, label, description };
        },
      }),
      removeNode: tool({
        description: "Remove a component from the canvas by its ID",
        inputSchema: z.object({
          nodeId: z.string().describe("The ID of the node to remove (from canvas context)"),
        }),
        execute: async ({ nodeId }) => {
          return { action: "removeNode", nodeId };
        },
      }),
      addEdge: tool({
        description: "Add a connection between two components",
        inputSchema: z.object({
          sourceId: z.string().describe("ID of the source node"),
          targetId: z.string().describe("ID of the target node"),
          label: z.string().optional().describe("Connection label, e.g. 'HTTP/REST'"),
        }),
        execute: async ({ sourceId, targetId, label }) => {
          return { action: "addEdge", sourceId, targetId, label };
        },
      }),
      updateNode: tool({
        description: "Update a component's properties",
        inputSchema: z.object({
          nodeId: z.string().describe("ID of the node to update"),
          label: z.string().optional(),
          description: z.string().optional(),
          category: z.enum([
            "service", "database", "queue", "gateway",
            "client", "cache", "storage", "compute", "custom",
          ]).optional(),
        }),
        execute: async ({ nodeId, ...changes }) => {
          return { action: "updateNode", nodeId, changes };
        },
      }),
    },
    stopWhen: stepCountIs(8),
  });

  return result.toUIMessageStreamResponse();
}

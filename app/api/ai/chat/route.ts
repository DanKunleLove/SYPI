import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { resolveModelForProject } from "@/lib/ai/index";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";

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

  // Build system prompt with canvas context
  const context = typeof canvasContext === "string" ? canvasContext : undefined;
  const systemPrompt = context
    ? `${CHAT_SYSTEM_PROMPT}\n\n${context}`
    : CHAT_SYSTEM_PROMPT;

  const result = streamText({
    model: await resolveModelForProject(projectId, "flash"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages as UIMessage[]),
    tools: {
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
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}

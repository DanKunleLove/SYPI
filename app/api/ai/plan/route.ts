import { streamText } from "ai";
import { getModel } from "@/lib/ai/index";
import { PLANNING_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { getDbUser } from "@/lib/project-access";

/**
 * Plan-then-execute: stream a short, human-readable architecture plan that the
 * user approves (or refines) before the full generation runs.
 */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: unknown; canvasContext?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, canvasContext } = body;

  if (!prompt || typeof prompt !== "string") {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const context =
    typeof canvasContext === "string" ? canvasContext : undefined;
  const userPrompt = context
    ? `${prompt}\n\nThe canvas already contains:\n${context}`
    : prompt;

  const result = streamText({
    model: getModel("flash"),
    system: PLANNING_SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.toTextStreamResponse();
}

import { streamText, type ModelMessage } from "ai";
import {
  applyUserInstructions,
  getModel,
  getUserInstructions,
  resolveModelForUser,
} from "@/lib/ai/index";
import { PLANNING_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { extractUrls, fetchSiteEvidence } from "@/lib/ai/url-research";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getDbUser } from "@/lib/project-access";

const MAX_TURNS = 40;
const MAX_TURN_CHARS = 8_000;

type PlanTurn = { role: "user" | "assistant"; content: string };

function isPlanTurns(value: unknown): value is PlanTurn[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m as PlanTurn).role !== undefined &&
        ((m as PlanTurn).role === "user" || (m as PlanTurn).role === "assistant") &&
        typeof (m as PlanTurn).content === "string"
    )
  );
}

/**
 * Plan-then-execute: stream a short, human-readable architecture plan as a
 * conversation the user discusses and refines before generating the diagram.
 */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const burst = checkRateLimit(`plan:${user.id}`, 15, 60_000);
  if (!burst.ok) return rateLimitResponse(burst.retryAfter);

  let body: { messages?: unknown; prompt?: unknown; canvasContext?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Accept a conversation (preferred) or a single prompt (back-compat).
  let turns: PlanTurn[];
  if (isPlanTurns(body.messages)) {
    turns = body.messages;
  } else if (typeof body.prompt === "string" && body.prompt) {
    turns = [{ role: "user", content: body.prompt }];
  } else {
    return Response.json(
      { error: "messages or prompt is required" },
      { status: 400 }
    );
  }

  if (turns.length > MAX_TURNS || turns.some((t) => t.content.length > MAX_TURN_CHARS)) {
    return Response.json(
      { error: "Conversation too long — start a new plan" },
      { status: 400 }
    );
  }

  const context =
    typeof body.canvasContext === "string"
      ? body.canvasContext.slice(0, 24_000)
      : undefined;
  let system = context
    ? `${PLANNING_SYSTEM_PROMPT}\n\nThe canvas already contains:\n${context}`
    : PLANNING_SYSTEM_PROMPT;

  // If the latest user turn references a URL, fetch the live site (fast path,
  // no web search) so the plan is grounded in the real product — not a guess.
  const lastUserTurn = [...turns].reverse().find((t) => t.role === "user");
  const urls = lastUserTurn ? extractUrls(lastUserTurn.content, 2) : [];
  if (urls.length > 0) {
    const evidence = await Promise.all(urls.map((u) => fetchSiteEvidence(u)));
    system += `\n\nThe user referenced URL(s). Live evidence fetched from them just now:\n\n${evidence.join(
      "\n\n"
    )}\n\nBase the plan on this evidence — the components must reflect this product's real features and observed technologies. Mark anything not in the evidence as an assumption.`;
  }

  system = applyUserInstructions(system, await getUserInstructions(user.id));

  const result = streamText({
    model: (await resolveModelForUser(user.id, "flash")) ?? getModel("flash"),
    system,
    messages: turns as ModelMessage[],
  });

  return result.toTextStreamResponse();
}

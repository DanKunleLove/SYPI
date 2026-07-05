import { generateObject } from "ai";
import {
  applyUserInstructions,
  getUserInstructions,
  resolveModelForProject,
} from "@/lib/ai/index";
import {
  CRITIQUE_SYSTEM_PROMPT,
  GENERATION_SYSTEM_PROMPT,
  URL_ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import {
  ArchitectureOutputSchema,
  CritiqueOutputSchema,
  type ArchitectureOutput,
} from "@/lib/ai/schemas";
import { extractUrls, researchSite } from "@/lib/ai/url-research";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";

// Generation runs inline (a single structured LLM call, ~10-30s) rather than
// offloading to a Trigger.dev worker. Give it room for the URL-research step.
export const maxDuration = 120;

const MAX_PROMPT_CHARS = 6_000;
const MAX_CONTEXT_CHARS = 24_000;
const BURST_LIMIT = 6; // per user per minute (per warm instance)
const DAILY_LIMIT = 100; // per user per 24h, durable (counted in the DB)

/** NDJSON line helper for the streamed response. */
function line(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

/** Compact text form of a generated architecture for the critique pass. */
function describeArchitecture(arch: ArchitectureOutput): string {
  const nodes = arch.nodes
    .map((n) => `- ${n.label} (${n.category})${n.description ? `: ${n.description}` : ""}`)
    .join("\n");
  const edges = arch.edges
    .map((e) => `- ${e.sourceLabel} → ${e.targetLabel}${e.label ? ` [${e.label}]` : ""}`)
    .join("\n");
  return `NODES:\n${nodes}\n\nCONNECTIONS:\n${edges}`;
}

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const burst = checkRateLimit(`gen:${user.id}`, BURST_LIMIT, 60_000);
  if (!burst.ok) return rateLimitResponse(burst.retryAfter);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = body.projectId as string | undefined;
  const prompt = body.prompt as string | undefined;
  const mode = ((body.mode as string) || "generate") as "generate" | "url-analyze";
  const url = body.url as string | undefined;
  const canvasContext =
    typeof body.canvasContext === "string"
      ? body.canvasContext.slice(0, MAX_CONTEXT_CHARS)
      : undefined;

  if (!projectId || !prompt) {
    return Response.json(
      { error: "projectId and prompt are required" },
      { status: 400 }
    );
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return Response.json(
      { error: `Prompt too long (max ${MAX_PROMPT_CHARS} characters)` },
      { status: 400 }
    );
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  // Durable daily cap — survives cold starts, protects the platform AI quota.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dailyCount = await prisma.aIGeneration.count({
    where: { project: { userId: user.id }, createdAt: { gte: dayAgo } },
  });
  if (dailyCount >= DAILY_LIMIT) {
    return Response.json(
      { error: `Daily generation limit reached (${DAILY_LIMIT}/24h). Try again later.` },
      { status: 429 }
    );
  }

  // A URL pasted into a normal prompt gets the same real research as URL mode —
  // users shouldn't have to know about a separate mode for links to work.
  const detectedUrls =
    mode === "url-analyze" && url ? [url] : extractUrls(prompt, 2);

  // Record the generation for history/audit.
  const generation = await prisma.aIGeneration.create({
    data: {
      projectId,
      prompt,
      type: detectedUrls.length > 0 ? "url-analysis" : "generation",
      status: "running",
    },
  });

  // Stream NDJSON status events so the client shows live stages instead of a
  // silent 10-30s wait: {type:"status"}* then {type:"result"} | {type:"error"}.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let systemPrompt: string;
        let userPrompt: string;

        if (detectedUrls.length > 0) {
          controller.enqueue(
            line({
              type: "status",
              stage: "researching",
              message: `Reading ${detectedUrls[0]} and researching the stack…`,
            })
          );

          // Live-fetch + search research per URL (sequential; max 2).
          const briefs: string[] = [];
          for (const target of detectedUrls) {
            briefs.push(await researchSite(target));
          }

          systemPrompt = URL_ANALYSIS_SYSTEM_PROMPT;
          userPrompt = `RESEARCH BRIEF:\n\n${briefs.join("\n\n---\n\n")}\n\nUser's request: ${prompt}${
            canvasContext ? `\n\n${canvasContext}` : ""
          }`;
        } else {
          systemPrompt = GENERATION_SYSTEM_PROMPT;
          userPrompt = canvasContext ? `${prompt}\n\n${canvasContext}` : prompt;
        }

        controller.enqueue(
          line({
            type: "status",
            stage: "generating",
            message: "Designing the architecture…",
          })
        );

        // User layer: appended, never replaces the schema contract.
        const instructions = await getUserInstructions(user.id);
        systemPrompt = applyUserInstructions(systemPrompt, instructions);

        const model = await resolveModelForProject(projectId, "pro");
        const result = await generateObject({
          model,
          schema: ArchitectureOutputSchema,
          system: systemPrompt,
          prompt: userPrompt,
        });

        let architecture = result.object;

        // Self-critique loop: review the draft, auto-fix critical issues once
        // before anything reaches the canvas. Best-effort — a critique failure
        // never blocks the generation itself.
        try {
          controller.enqueue(
            line({
              type: "status",
              stage: "reviewing",
              message: "Reviewing the design for weaknesses…",
            })
          );
          const critiqueModel = await resolveModelForProject(projectId, "flash");
          const critique = await generateObject({
            model: critiqueModel,
            schema: CritiqueOutputSchema,
            system: CRITIQUE_SYSTEM_PROMPT,
            prompt: `Review this freshly generated architecture for the request: "${prompt.slice(0, 500)}"\n\n${describeArchitecture(architecture)}`,
          });

          const critical = critique.object.issues.filter(
            (i) => i.severity === "critical"
          );
          if (critical.length > 0) {
            controller.enqueue(
              line({
                type: "status",
                stage: "refining",
                message: `Fixing ${critical.length} critical issue${critical.length > 1 ? "s" : ""} before placing…`,
              })
            );
            const issueList = critical
              .map((i) => `- ${i.title}: ${i.description} FIX: ${i.suggestion}`)
              .join("\n");
            const repaired = await generateObject({
              model,
              schema: ArchitectureOutputSchema,
              system: systemPrompt,
              prompt: `${userPrompt}\n\nYou already produced this draft:\n${describeArchitecture(architecture)}\n\nA design review found these CRITICAL issues:\n${issueList}\n\nReturn the FULL corrected architecture (all nodes and edges, not a diff), fixing only these issues while keeping everything else intact.`,
            });
            architecture = repaired.object;
          }
        } catch {
          // Keep the original draft — self-critique is an enhancement, not a gate.
        }

        await prisma.aIGeneration.update({
          where: { id: generation.id },
          data: {
            status: "completed",
            result: architecture as unknown as Prisma.InputJsonValue,
          },
        });

        controller.enqueue(
          line({ type: "result", generationId: generation.id, architecture })
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Generation failed";
        await prisma.aIGeneration
          .update({
            where: { id: generation.id },
            data: { status: "failed", error: message },
          })
          .catch(() => {});
        controller.enqueue(line({ type: "error", error: message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

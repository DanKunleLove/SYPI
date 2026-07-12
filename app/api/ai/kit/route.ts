import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import {
  applyUserInstructions,
  getUserInstructions,
  resolveModelForProject,
} from "@/lib/ai/index";
import { KIT_DOMAINS, getKitDomain, kitSystemPrompt } from "@/lib/ai/kit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";

// Up to 7 sequential doc generations — give the kit room to finish.
export const maxDuration = 300;

function line(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

/**
 * System Kit generation: streams the six-file "proper system" (NDJSON,
 * one event per file) built from the project's actual canvas.
 */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Kits are expensive (6 LLM calls) — tight limit.
  const burst = checkRateLimit(`kit:${user.id}`, 3, 10 * 60_000);
  if (!burst.ok) return rateLimitResponse(burst.retryAfter);

  let body: {
    projectId?: unknown;
    canvasContext?: unknown;
    projectName?: unknown;
    domain?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.domain !== undefined && !KIT_DOMAINS.some((d) => d.id === body.domain)) {
    return Response.json({ error: "Unknown kit domain" }, { status: 400 });
  }
  const domain = getKitDomain(body.domain);

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const canvasContext =
    typeof body.canvasContext === "string" ? body.canvasContext.slice(0, 24_000) : null;
  const projectName =
    typeof body.projectName === "string" && body.projectName.trim()
      ? body.projectName.trim().slice(0, 120)
      : "Untitled Project";

  if (!projectId || !canvasContext) {
    return Response.json(
      { error: "projectId and canvasContext are required — build the canvas first" },
      { status: 400 }
    );
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const [model, instructions] = await Promise.all([
    resolveModelForProject(projectId, "flash"),
    getUserInstructions(user.id),
  ]);
  const system = applyUserInstructions(kitSystemPrompt(domain), instructions);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const file of domain.files) {
          controller.enqueue(line({ type: "start", name: file.name, title: file.title }));

          const result = await generateText({
            model,
            system,
            prompt: `PROJECT: ${projectName}\n\nARCHITECTURE (from the canvas):\n${canvasContext}\n\nYOUR FILE:\n${file.guidance}`,
          });

          controller.enqueue(
            line({ type: "file", name: file.name, title: file.title, content: result.text })
          );
        }
        controller.enqueue(line({ type: "done" }));
        // Deep-value activation event — best-effort, never fails the kit.
        await prisma.usageEvent
          .create({
            data: {
              userId: user.id,
              type: "kit_generated",
              meta: { domain: domain.id, project: projectId },
            },
          })
          .catch(() => {});
      } catch (error) {
        controller.enqueue(
          line({
            type: "error",
            error: error instanceof Error ? error.message : "Kit generation failed",
          })
        );
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

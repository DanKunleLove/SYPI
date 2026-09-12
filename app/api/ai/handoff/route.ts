import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import {
  applyUserInstructions,
  getUserInstructions,
  resolveModelForProject,
} from "@/lib/ai/index";
import { enforceAiQuota } from "@/lib/ai/limits";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { getSpec } from "@/lib/uss/store";
import { renderUssForPrompt } from "@/lib/uss/render";
import {
  EXECUTION_TARGETS,
  getTarget,
  isTargetId,
  targetSystemPrompt,
} from "@/lib/uss/targets";

/**
 * POST /api/ai/handoff — render the specification for whoever is going to build.
 *
 * One USS, many renderers. Each file receives only the sections it needs, with
 * empty sections filtered out, so no generator is ever handed a document full of
 * blank headings to fill in.
 *
 * Requires a spec: this is a rendering of established reasoning, not a substitute
 * for it. A canvas alone is explicitly not enough here — that was the old System
 * Kit's ceiling.
 */
export const maxDuration = 300;

function line(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: unknown; target?: unknown; projectName?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }
  if (body.target !== undefined && !isTargetId(body.target)) {
    return Response.json(
      { error: `Unknown target. Options: ${EXECUTION_TARGETS.map((t) => t.id).join(", ")}` },
      { status: 400 }
    );
  }

  const projectName =
    typeof body.projectName === "string" && body.projectName.trim()
      ? body.projectName.trim().slice(0, 120)
      : "Untitled Project";

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const target = getTarget(body.target);

  // Same cost shape as the Kit — several sequential generations.
  const limited = await enforceAiQuota(user.id, "kit");
  if (limited) return limited;

  const record = await getSpec(projectId);
  if (!record) {
    return Response.json(
      {
        error:
          "This project has no specification yet. Describe what you are building first — the hand-off renders the reasoning, it does not replace it.",
      },
      { status: 400 }
    );
  }

  const [model, instructions] = await Promise.all([
    resolveModelForProject(projectId, "flash"),
    getUserInstructions(user.id),
  ]);
  const system = applyUserInstructions(targetSystemPrompt(target), instructions);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          line({
            type: "target",
            id: target.id,
            label: target.label,
            files: target.files.map((f) => ({ path: f.path, title: f.title })),
          })
        );

        for (const file of target.files) {
          controller.enqueue(line({ type: "start", path: file.path, title: file.title }));

          const context = renderUssForPrompt(record.doc, {
            sections: file.sections,
            maxChars: 18_000,
          });

          const result = await generateText({
            model,
            system,
            prompt: `PROJECT: ${projectName}\n\nSPECIFICATION (status markers show how well each fact is established):\n${context}\n\nYOUR FILE — ${file.title} (${file.path}):\n${file.guidance}`,
          });

          controller.enqueue(
            line({ type: "file", path: file.path, title: file.title, content: result.text })
          );
        }

        controller.enqueue(line({ type: "done" }));

        await prisma.usageEvent
          .create({
            data: {
              userId: user.id,
              type: "handoff_generated",
              meta: { target: target.id, project: projectId },
            },
          })
          .catch(() => {});
      } catch (error) {
        controller.enqueue(
          line({
            type: "error",
            error: error instanceof Error ? error.message : "Hand-off generation failed",
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

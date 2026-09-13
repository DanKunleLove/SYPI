import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { enforceAiQuota } from "@/lib/ai/limits";
import { getUserInstructions, resolveModelForProject } from "@/lib/ai/index";
import { runCouncil } from "@/lib/ai/council";
import { selectCouncil } from "@/lib/uss/council";
import { commitSpec, getSpec } from "@/lib/uss/store";
import { finalise } from "@/lib/ai/uss";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { specCoverage } from "@/lib/uss/views";

/**
 * POST /api/ai/review — the Engineering Council.
 *
 * Replaces the Trigger.dev critique worker. That worker was the last real
 * consumer of Trigger.dev, and it was also the historical source of "stuck on
 * analyzing" reports: a queued run with no worker running never completed. This
 * runs inline and streams, so a failure is visible instead of silent.
 *
 * Reviewers run sequentially and the response streams per discipline, so a slow
 * six-reviewer run shows progress rather than a spinner.
 */
export const maxDuration = 300;

function line(obj: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const limited = await enforceAiQuota(user.id, "critique");
  if (limited) return limited;

  const record = await getSpec(projectId);
  if (!record) {
    return Response.json(
      {
        error:
          "There is no specification for this project yet. Generate an architecture first.",
      },
      { status: 400 }
    );
  }

  const [model, instructions] = await Promise.all([
    resolveModelForProject(projectId, "flash"),
    getUserInstructions(user.id),
  ]);

  const generation = await prisma.aIGeneration.create({
    data: { projectId, prompt: "Engineering council review", type: "critique", status: "running" },
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const selection = selectCouncil(record.doc);
        controller.enqueue(
          line({
            type: "council",
            disciplines: selection.disciplines.map((d) => ({
              id: d.id,
              label: d.label,
              reason: selection.reasons[d.id],
            })),
          })
        );

        const result = await runCouncil({
          model,
          doc: record.doc,
          userInstructions: instructions,
          version: record.doc.complexity.firstSeenVersion + 1,
          onProgress: (discipline, i, total) => {
            controller.enqueue(
              line({
                type: "status",
                stage: discipline.id,
                message: `${discipline.label} reviewing… (${i + 1}/${total})`,
              })
            );
          },
        });

        // Persist findings so they can be dismissed with memory rather than
        // raised again from scratch on the next review.
        const saved = await commitSpec({
          projectId,
          doc: finalise(result.doc),
          source: "extract",
          changeSummary: `Council review: ${result.findings.length} finding(s)`,
          authorUserId: user.id,
          ifVersion: record.version,
        });

        await prisma.aIGeneration.update({
          where: { id: generation.id },
          data: {
            status: "completed",
            result: { findings: result.findings } as unknown as Prisma.InputJsonValue,
          },
        });

        controller.enqueue(
          line({
            type: "result",
            generationId: generation.id,
            findings: result.findings,
            disciplines: result.disciplines,
            calls: result.calls,
            coverage: specCoverage(saved.doc),
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Review failed";
        await prisma.aIGeneration
          .update({ where: { id: generation.id }, data: { status: "failed", error: message } })
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

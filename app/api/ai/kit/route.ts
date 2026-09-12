import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import {
  applyUserInstructions,
  getUserInstructions,
  resolveModelForProject,
} from "@/lib/ai/index";
import { KIT_DOMAINS, getKitDomain, kitSystemPrompt } from "@/lib/ai/kit";
import { enforceAiQuota } from "@/lib/ai/limits";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { getSpec } from "@/lib/uss/store";
import { renderUssForPrompt } from "@/lib/uss/render";
import type { UssSection } from "@/lib/uss/views";

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

  // Kits are expensive (5-7 LLM calls each) — tight burst + low daily cap.
  const limited = await enforceAiQuota(user.id, "kit");
  if (limited) return limited;

  const [model, instructions] = await Promise.all([
    resolveModelForProject(projectId, "flash"),
    getUserInstructions(user.id),
  ]);
  const system = applyUserInstructions(kitSystemPrompt(domain), instructions);

  /**
   * Which slice of the spec each kit file needs.
   *
   * Keyed by FILE NAME rather than declared on every KitFileSpec, because the same
   * names recur across all eight domain packs — one map covers them all without
   * touching a single domain definition.
   */
  const SECTIONS_BY_FILE: Record<string, UssSection[]> = {
    "project-overview.md": ["product", "actors", "useCases", "requirements", "constraints"],
    "business-overview.md": ["product", "actors", "requirements", "constraints"],
    "architecture.md": ["architecture", "decisions", "constraints", "complexity", "capabilities", "domain", "invariants"],
    "content-architecture.md": ["product", "architecture", "requirements"],
    "campaign-architecture.md": ["product", "actors", "requirements", "constraints"],
    "workflow-architecture.md": ["architecture", "capabilities", "constraints", "complexity"],
    "operations-architecture.md": ["architecture", "actors", "constraints"],
    "production-pipeline.md": ["architecture", "capabilities", "constraints"],
    "generation-pipeline.md": ["architecture", "capabilities", "constraints"],
    "integration-standards.md": ["architecture", "capabilities", "constraints"],
    "code-standards.md": ["architecture", "constraints", "complexity", "invariants"],
    "ai-workflow-rules.md": ["complexity", "decisions", "openDecisions", "invariants"],
    "ui-context.md": ["actors", "useCases", "architecture"],
    "style-guide.md": ["product", "actors"],
    "brand-voice-guide.md": ["product", "actors"],
    "style-voice-guide.md": ["product", "actors"],
    "creative-direction.md": ["product", "actors", "requirements"],
    "sound-direction.md": ["product", "requirements"],
    "content-bible.md": ["product", "actors", "glossary", "requirements"],
    "asset-library.md": ["architecture", "constraints"],
    "sops-and-standards.md": ["actors", "useCases", "constraints"],
    "progress-tracker.md": ["requirements", "openDecisions", "decisions", "assumptions"],
    "tool-setup.md": ["architecture", "capabilities", "constraints"],
    "env.example": ["architecture", "capabilities", "constraints"],
  };

  /**
   * Prefer the spec over the client-supplied canvas dump.
   *
   * Before this, every file received the same flattened canvas, which is why the
   * prompt was forced to say "make ONE reasonable decision" and the progress
   * tracker had to INVENT its open questions. Falls back to body.canvasContext
   * when no spec exists, so old projects and platform-key users see no regression.
   */
  let specDoc: Awaited<ReturnType<typeof getSpec>> = null;
  try {
    specDoc = await getSpec(projectId);
  } catch {
    // A spec that will not load must never block a kit.
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const file of domain.files) {
          controller.enqueue(line({ type: "start", name: file.name, title: file.title }));

          // Each file gets the slice of the spec it actually needs, with empty
          // sections filtered out entirely.
          const sections = SECTIONS_BY_FILE[file.name];
          const specContext =
            specDoc && sections
              ? renderUssForPrompt(specDoc.doc, { sections, maxChars: 18_000 })
              : "";

          const context = specContext
            ? `SYSTEM SPECIFICATION (authoritative — status markers show how well each fact is established):\n${specContext}`
            : `ARCHITECTURE (from the canvas):\n${canvasContext}`;

          const result = await generateText({
            model,
            system,
            prompt: `PROJECT: ${projectName}\n\n${context}\n\nYOUR FILE:\n${file.guidance}`,
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

import { generateObject } from "ai";
import {
  getUserInstructions,
  resolveModelForProject,
} from "@/lib/ai/index";
import {
  CRITIQUE_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import {
  ArchitectureOutputSchema,
  CritiqueOutputSchema,
  type ArchitectureOutput,
} from "@/lib/ai/schemas";
import { extractUrls, researchSite } from "@/lib/ai/url-research";
import { enforceAiQuota } from "@/lib/ai/limits";
import {
  classifyComplexity,
  extractCapabilities,
  extractDomain,
  extractIntent,
  extractRequirements,
  finalise,
} from "@/lib/ai/uss";
import { applyImplications, deriveImplications, ruleCoverage } from "@/lib/uss/reasoning";
import { commitSpec, getOrCreateSpec } from "@/lib/uss/store";
import { materialOpenDecisions, specCoverage } from "@/lib/uss/views";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";
import { buildDesignPrompt } from "@/lib/ai/design-prompt";
import type { Uss } from "@/lib/uss/schema";
import { applyArchitectureToSpec } from "@/lib/uss/architecture";

// Generation runs inline (a single structured LLM call, ~10-30s) rather than
// offloading to a Trigger.dev worker. Give it room for the URL-research step.
// Raised from 120: the understanding pass adds one flash call before generation,
// and slower providers (NVIDIA Nemotron measured at 200-600s for a full design)
// can otherwise hit the ceiling mid-run.
export const maxDuration = 300;

const MAX_PROMPT_CHARS = 6_000;
const MAX_CONTEXT_CHARS = 24_000;

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

  const limited = await enforceAiQuota(user.id, "generate");
  if (limited) return limited;

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
        let researchBrief: string | null = null;

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

          researchBrief = briefs.join("\n\n---\n\n");
        }

        // ── Understanding: establish WHAT is being built before designing it ──
        // Cheap (one flash call) and available on every path, including the
        // platform key. This is where requirements-completeness comes from.
        const instructions = await getUserInstructions(user.id);
        let specDoc: Uss | null = null;

        try {
          controller.enqueue(
            line({
              type: "status",
              stage: "understanding",
              message: "Understanding what you're building…",
            })
          );

          const flash = await resolveModelForProject(projectId, "flash");
          const current = await getOrCreateSpec(projectId);
          const passCtx = {
            model: flash,
            brief: prompt,
            userInstructions: instructions,
            version: current.doc.complexity.firstSeenVersion + 1,
          };

          let doc = await extractIntent(current.doc, passCtx);
          doc = await classifyComplexity(doc, passCtx);

          // ── The reasoning chain ────────────────────────────────────────────
          // requirement → implication → capability → (architecture, next)
          // The implication rulebook is deterministic and free, so it runs on
          // every path. It is what stops a marketplace shipping without payment
          // idempotency: a model can forget, a rule cannot.
          doc = await extractRequirements(doc, passCtx);
          doc = await extractCapabilities(doc, passCtx);
          // The business itself: what things exist, how they change, and what must
          // never be true of them. finalise() then seeds the invariant catalogue.
          doc = await extractDomain(doc, passCtx);
          doc = applyImplications(
            doc,
            deriveImplications(doc).map((d) => ({ ...d, source: "rule" as const })),
            passCtx.version
          );

          doc = finalise(doc);

          const saved = await commitSpec({
            projectId,
            doc,
            source: "extract",
            changeSummary: "Understood the brief",
            authorUserId: user.id,
            ifVersion: current.version,
          });

          specDoc = saved.doc;

          const coverage = ruleCoverage(saved.doc);
          controller.enqueue(
            line({
              type: "spec",
              coverage: specCoverage(saved.doc),
              tier: saved.doc.complexity.tier,
              tierLabel: saved.doc.complexity.label,
              materialDecisions: materialOpenDecisions(saved.doc).length,
              implications: coverage.total,
              // Share derived by rule rather than by the model. If this drops,
              // the rulebook has stopped carrying its weight.
              ruleCoveragePct: coverage.pct,
            })
          );
        } catch (e) {
          // Understanding is an enhancement, never a gate. A failure here must
          // not cost the user their generation.
          console.error("[generate] understanding pass failed", e);
        }

        controller.enqueue(
          line({
            type: "status",
            stage: "generating",
            message: "Designing the architecture…",
          })
        );

        // The spec drives the SYSTEM prompt now, instead of riding along in the
        // user message beneath one that contradicts it. With no spec, this is
        // byte-for-byte the prompt that shipped before any of this existed.
        const { system: systemPrompt, user: userPrompt } = buildDesignPrompt({
          brief: prompt,
          canvasContext,
          researchBrief,
          doc: specDoc,
          userInstructions: instructions,
        });

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

        // Record the architecture in the spec. Until this existed, components only
        // ever entered the USS via a later canvas save, so scenarios, integrity
        // checks and the health bar were all evaluated against a document with
        // zero components -- every structural verdict was empty by construction.
        // Deterministic, no model call, and best-effort: a failure here must never
        // cost the user the design they just waited for.
        if (specDoc) {
          try {
            const current = await getOrCreateSpec(projectId);
            const applied = applyArchitectureToSpec(
              current.doc,
              architecture,
              current.doc.complexity.firstSeenVersion + 1,
              generation.id
            );
            const savedArch = await commitSpec({
              projectId,
              doc: finalise(applied.doc),
              source: "extract",
              changeSummary: `Recorded the generated architecture (${applied.added} components)`,
              authorUserId: user.id,
              ifVersion: current.version,
            });
            controller.enqueue(
              line({
                type: "spec",
                coverage: specCoverage(savedArch.doc),
                tier: savedArch.doc.complexity.tier,
                tierLabel: savedArch.doc.complexity.label,
                materialDecisions: materialOpenDecisions(savedArch.doc).length,
              })
            );
          } catch (e) {
            console.error("[generate] recording the architecture failed", e);
          }
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

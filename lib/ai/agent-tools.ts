import { tool, generateObject } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  applyUserInstructions,
  resolveModelForProject,
} from "@/lib/ai/index";
import {
  CRITIQUE_SYSTEM_PROMPT,
  REFINEMENT_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import {
  ArchitectureOutputSchema,
  CritiqueOutputSchema,
  RefinementOutputSchema,
  type ArchitectureOutput,
} from "@/lib/ai/schemas";
import { extractUrls, researchSite } from "@/lib/ai/url-research";
import { commitWithRetry, getSpec } from "@/lib/uss/store";
import { UssGraph } from "@/lib/uss/graph";
import { finalise } from "@/lib/ai/uss";
import { renderUssSummary } from "@/lib/uss/render";
import { materialOpenDecisions, specCoverage } from "@/lib/uss/views";
import { checkAiQuota } from "@/lib/ai/limits";
import { Prisma } from "@/app/generated/prisma/client";
import { buildDesignPrompt } from "@/lib/ai/design-prompt";

/** Mutable per-request context shared by the agent's tools. `canvasContext`
 * is updated after a generation so later tool calls in the same turn see
 * the new architecture, not the pre-generation canvas. */
export interface AgentContext {
  projectId: string;
  userId: string;
  canvasContext?: string;
  userInstructions?: string | null;
  /** One-line spec summary, refreshed after a resolve so later tools see it. */
  ussSummary?: string;
}

function summarizeArchitecture(arch: ArchitectureOutput): string {
  const nodes = arch.nodes
    .map((n) => `- ${n.label} (${n.category})${n.description ? `: ${n.description}` : ""}`)
    .join("\n");
  const edges = arch.edges
    .map((e) => `- ${e.sourceLabel} → ${e.targetLabel}${e.label ? ` [${e.label}]` : ""}`)
    .join("\n");
  return `NODES:\n${nodes}\n\nCONNECTIONS:\n${edges}`;
}

/**
 * Heavy agent tools — each wraps one of SYPI's schema-enforced pipelines so
 * the conversational agent narrates while the disciplined pipelines do the
 * structured work (agent front-door, specialized back-end).
 */
export function createAgentTools(ctx: AgentContext) {
  return {
    generateArchitecture: tool({
      description:
        "Design a complete architecture and place it on the canvas. Call this ONLY after the user has approved your proposed plan, or explicitly asked you to build without discussion. Pass the full agreed plan as the description.",
      inputSchema: z.object({
        description: z
          .string()
          .describe("The complete agreed plan or system description to build from"),
        url: z
          .string()
          .optional()
          .describe("A URL the user referenced, to ground the design in the real site"),
      }),
      execute: async ({ description, url }) => {
        // Same quota pool as the direct generate route.
        const quota = await checkAiQuota(ctx.userId, "generate");
        if (!quota.ok) return { error: quota.error };

        const urls = url ? [url] : extractUrls(description, 1);
        const researchBrief = urls.length > 0 ? await researchSite(urls[0]) : null;

        // The same builder the generate route uses. This tool used to be entirely
        // spec-blind: it designed from the description alone while a specification
        // for the project sat unread in the database.
        const spec = await getSpec(ctx.projectId);
        const { system, user: prompt } = buildDesignPrompt({
          brief: description,
          canvasContext: ctx.canvasContext,
          researchBrief,
          doc: spec?.doc ?? null,
          userInstructions: ctx.userInstructions,
        });

        const generation = await prisma.aIGeneration.create({
          data: {
            projectId: ctx.projectId,
            prompt: description.slice(0, 4000),
            type: urls.length > 0 ? "url-analysis" : "generation",
            status: "running",
          },
        });

        try {
          const result = await generateObject({
            model: await resolveModelForProject(ctx.projectId, "pro"),
            schema: ArchitectureOutputSchema,
            system,
            prompt,
          });
          const architecture = result.object;

          await prisma.aIGeneration.update({
            where: { id: generation.id },
            data: {
              status: "completed",
              result: architecture as unknown as Prisma.InputJsonValue,
            },
          });

          // Later tools in this turn (e.g. runDesignReview) must see the new state.
          ctx.canvasContext = `CURRENT CANVAS (just generated):\n${summarizeArchitecture(architecture)}`;

          return {
            action: "placeArchitecture",
            generationId: generation.id,
            architecture,
            componentCount: architecture.nodes.length,
            reasoning: architecture.reasoning,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generation failed";
          await prisma.aIGeneration
            .update({ where: { id: generation.id }, data: { status: "failed", error: message } })
            .catch(() => {});
          return { error: message };
        }
      },
    }),

    runDesignReview: tool({
      description:
        "Review the current architecture for reliability, scalability, security, and completeness issues. Requires components on the canvas (or just generated this turn).",
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.canvasContext) {
          return { error: "The canvas is empty — there is nothing to review yet." };
        }
        const quota = await checkAiQuota(ctx.userId, "critique");
        if (!quota.ok) return { error: quota.error };
        const result = await generateObject({
          model: await resolveModelForProject(ctx.projectId, "flash"),
          schema: CritiqueOutputSchema,
          system: CRITIQUE_SYSTEM_PROMPT,
          prompt: ctx.canvasContext,
        });
        return {
          action: "review",
          summary: result.object.summary,
          issues: result.object.issues,
        };
      },
    }),

    refineArchitecture: tool({
      description:
        "Modify the EXISTING canvas — add, remove, or update components and connections per an instruction. Use for changes to an architecture that already exists (never for building from scratch).",
      inputSchema: z.object({
        instruction: z
          .string()
          .describe("What to change, e.g. 'Add a Redis cache between the gateway and the services'"),
      }),
      execute: async ({ instruction }) => {
        if (!ctx.canvasContext) {
          return { error: "The canvas is empty — use generateArchitecture instead." };
        }
        const quota = await checkAiQuota(ctx.userId, "refine");
        if (!quota.ok) return { error: quota.error };
        try {
          const result = await generateObject({
            model: await resolveModelForProject(ctx.projectId, "pro"),
            schema: RefinementOutputSchema,
            system: applyUserInstructions(REFINEMENT_SYSTEM_PROMPT, ctx.userInstructions),
            prompt: `${instruction}\n\n${ctx.canvasContext}`,
          });
          return {
            action: "applyDiff",
            reasoning: result.object.reasoning,
            operations: result.object.operations,
            changeCount: result.object.operations.length,
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : "Refinement failed" };
        }
      },
    }),

    resolveOpenDecision: tool({
      description:
        "Record the user's answer to one of the open decisions about this system. Call this whenever they answer a question you raised, or state a requirement that settles one. The answer becomes an established constraint and may change the architecture.",
      inputSchema: z.object({
        decisionId: z.string().describe("The decision id, e.g. OPN-003"),
        answer: z.string().describe("What the user decided, in their own words"),
      }),
      execute: async ({ decisionId, answer }) => {
        try {
          const result = await commitWithRetry({
            projectId: ctx.projectId,
            source: "answer",
            changeSummary: `Answered ${decisionId}`,
            authorUserId: ctx.userId,
            apply: (current) => {
              const g = new UssGraph(current);
              const decision = g.get(decisionId);
              if (!decision || decision.kind !== "openDecision") {
                throw new Error(`No open question with id ${decisionId}`);
              }
              const version = current.complexity.firstSeenVersion + 1;
              g.update(decisionId, {
                resolvedAt: new Date().toISOString(),
                resolution: answer,
                status: "KNOWN",
                confidence: 1,
                evidence: [{ kind: "answer", ref: decisionId, quote: answer.slice(0, 400) }],
              });
              g.add("constraint", {
                title: decision.title,
                category: "other",
                statement: `${decision.question} — ${answer}`,
                status: "KNOWN",
                confidence: 1,
                evidence: [{ kind: "answer", ref: decisionId, quote: answer.slice(0, 400) }],
                firstSeenVersion: version,
              });
              return finalise(g.snapshot());
            },
          });

          // Later tools in this turn must see the updated spec.
          ctx.ussSummary = renderUssSummary(result.doc);

          return {
            action: "decisionResolved",
            decisionId,
            coverage: specCoverage(result.doc),
            remaining: materialOpenDecisions(result.doc).length,
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : "Could not record that" };
        }
      },
    }),

    researchUrl: tool({
      description:
        "Fetch a live public URL and research its tech stack — page content, framework fingerprints, headers, plus web research. Use whenever the user references a site you should understand before answering or designing.",
      inputSchema: z.object({
        url: z.string().describe("The full http(s) URL to research"),
      }),
      execute: async ({ url }) => {
        const brief = await researchSite(url);
        return { action: "research", url, brief };
      },
    }),
  };
}

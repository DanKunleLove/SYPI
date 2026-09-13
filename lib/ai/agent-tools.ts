import { tool, generateObject } from "ai";
import { z } from "zod";
import {
  applyUserInstructions,
  resolveModelForProject,
} from "@/lib/ai/index";
import {
  CRITIQUE_SYSTEM_PROMPT,
  REFINEMENT_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { CritiqueOutputSchema, RefinementOutputSchema } from "@/lib/ai/schemas";
import { researchSite } from "@/lib/ai/url-research";
import { commitWithRetry } from "@/lib/uss/store";
import { UssGraph } from "@/lib/uss/graph";
import { finalise } from "@/lib/ai/uss";
import { renderUssSummary } from "@/lib/uss/render";
import { materialOpenDecisions, specCoverage } from "@/lib/uss/views";
import { checkAiQuota } from "@/lib/ai/limits";

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

export function createAgentTools(ctx: AgentContext) {
  return {
    generateArchitecture: tool({
      description:
        "Start the design pipeline: understand the brief, size it, write the requirements, model the domain, then design and review the architecture. Call this ONLY after the user has approved your plan, or explicitly asked you to build without discussion. It starts a multi-minute run the user watches step by step — do not start it to explore an idea. Pass the full agreed plan as the description.",
      inputSchema: z.object({
        description: z
          .string()
          .describe("The complete agreed plan or system description to build from"),
        url: z
          .string()
          .optional()
          .describe("A URL the user referenced, to ground the design in the real site"),
      }),
      // Returns immediately and hands off to the client, which runs the pipeline
      // one request per step.
      //
      // This tool used to do the whole design itself: one generateObject against
      // a spec it read but never wrote back. That is why a canvas built through
      // chat — the only reachable path — left no specification behind, and why
      // every USS surface in the product was empty. It is also why the budget
      // never bound: the understanding pass that decides the tier never ran.
      //
      // It cannot run the pipeline here. Every tool call is a model step inside
      // ONE HTTP request, and nine model calls cannot fit in a 60-second
      // function. The client loop is what makes the work both possible and
      // visible.
      execute: async ({ description, url }) => ({
        action: "runPipeline",
        brief: description,
        url,
      }),
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

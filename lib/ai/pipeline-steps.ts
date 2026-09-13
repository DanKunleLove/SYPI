import { generateObject } from "ai";
import { getUserInstructions, resolveModelForProject } from "@/lib/ai/index";
import { CRITIQUE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  ArchitectureOutputSchema,
  CritiqueOutputSchema,
  type ArchitectureOutput,
} from "@/lib/ai/schemas";
import { buildDesignPrompt } from "@/lib/ai/design-prompt";
import { renderBudgetForPrompt } from "@/lib/uss/complexity";
import type { PipelineStepId } from "@/lib/ai/pipeline";
import type { RunRecord } from "@/lib/ai/run";
import {
  classifyComplexity,
  extractCapabilities,
  extractDomain,
  extractIntent,
  extractRequirements,
  finalise,
} from "@/lib/ai/uss";
import { applyArchitectureToSpec } from "@/lib/uss/architecture";
import { diffUssToCanvas } from "@/lib/uss/project";
import { applyImplications, deriveImplications } from "@/lib/uss/reasoning";
import { commitWithRetry, getOrCreateSpec, getSpec } from "@/lib/uss/store";
import { materialOpenDecisions, specCoverage } from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";
import type { CanvasEdge, CanvasNode } from "@/types/canvas";

/**
 * The body of each pipeline step.
 *
 * Separate from the route so it can be exercised — and TIMED — without an HTTP
 * session. Every step has to fit inside 60 seconds on Vercel Hobby, and the only
 * responsible way to know that is to measure it rather than assume it. See
 * `scripts/time-pipeline.ts`.
 */

export interface StepOutcome {
  detail?: string;
  skipped?: boolean;
  architecture?: ArchitectureOutput;
  operations?: unknown[];
  meta?: Record<string, unknown>;
}

/** Compact text form of an architecture, for the critique pass. */
function describeArchitecture(arch: ArchitectureOutput): string {
  const nodes = arch.nodes
    .map((n) => `- ${n.label} (${n.category})${n.description ? `: ${n.description}` : ""}`)
    .join("\n");
  const edges = arch.edges
    .map((e) => `- ${e.sourceLabel} → ${e.targetLabel}${e.label ? ` [${e.label}]` : ""}`)
    .join("\n");
  return `NODES:\n${nodes}\n\nCONNECTIONS:\n${edges}`;
}


/** The spec numbers the health bar reads, so it updates live as steps land. */
export function specSummary(doc: Uss) {
  return {
    coverage: specCoverage(doc),
    tier: doc.complexity.tier,
    tierLabel: doc.complexity.label,
    materialDecisions: materialOpenDecisions(doc).length,
    components: doc.entities.filter((e) => e.kind === "component").length,
  };
}


export async function runStep(params: {
  step: Exclude<PipelineStepId, "start">;
  projectId: string;
  userId: string;
  run: RunRecord;
  canvasNodes: CanvasNode[];
  canvasEdges: CanvasEdge[];
  canvasContext?: string;
}): Promise<StepOutcome> {
  const { step, projectId, userId, run } = params;

  const [instructions, current] = await Promise.all([
    getUserInstructions(userId),
    getOrCreateSpec(projectId),
  ]);

  /**
   * Provenance is stamped from the SPEC's version, not from
   * `complexity.firstSeenVersion + 1` as the old route did. Nothing ever
   * incremented that field, so every entity in every spec was stamped version 2
   * forever and "when did we first believe this" was unanswerable — which is
   * one of the questions the provenance layer exists to answer.
   */
  const version = current.version + 1;

  const passCtx = async () => ({
    model: await resolveModelForProject(projectId, "flash"),
    brief: run.brief,
    userInstructions: instructions,
    version,
  });

  switch (step) {
    case "intent": {
      const ctx = await passCtx();
      const saved = await commitWithRetry({
        projectId,
        source: "extract",
        changeSummary: "Understood the brief",
        authorUserId: userId,
        apply: (doc) => extractIntent(doc, ctx),
      });
      const product = saved.doc.entities.find((e) => e.kind === "product");
      const actors = saved.doc.entities.filter((e) => e.kind === "actor").length;
      return {
        detail: product
          ? `${product.title} — ${actors} kind${actors === 1 ? "" : "s"} of user`
          : "brief understood",
      };
    }

    case "complexity": {
      const ctx = await passCtx();
      const saved = await commitWithRetry({
        projectId,
        source: "extract",
        changeSummary: "Sized the project",
        authorUserId: userId,
        apply: (doc) => classifyComplexity(doc, ctx),
      });
      const c = saved.doc.complexity;
      return {
        detail: `tier ${c.tier} (${c.label}) — at most ${c.budget.maxComponents} components`,
      };
    }

    case "requirements": {
      const ctx = await passCtx();
      const saved = await commitWithRetry({
        projectId,
        source: "extract",
        changeSummary: "Extracted requirements",
        authorUserId: userId,
        apply: (doc) => extractRequirements(doc, ctx),
      });
      const n = saved.doc.entities.filter((e) => e.kind === "requirement").length;
      return { detail: `${n} requirement${n === 1 ? "" : "s"}` };
    }

    case "capabilities": {
      const ctx = await passCtx();
      const saved = await commitWithRetry({
        projectId,
        source: "extract",
        changeSummary: "Established the capabilities needed",
        authorUserId: userId,
        apply: (doc) => extractCapabilities(doc, ctx),
      });
      const n = saved.doc.entities.filter((e) => e.kind === "capability").length;
      return { detail: `${n} capabilit${n === 1 ? "y" : "ies"}` };
    }

    case "domain": {
      const ctx = await passCtx();
      // The domain pass, then the deterministic rulebook, then finalise — all
      // one request because the last two make no model calls at all. The
      // rulebook is what stops a marketplace shipping without payment
      // idempotency: a model can forget, a rule cannot.
      const saved = await commitWithRetry({
        projectId,
        source: "extract",
        changeSummary: "Modelled the domain and derived implications",
        authorUserId: userId,
        apply: async (doc) => {
          let next = await extractDomain(doc, ctx);
          next = applyImplications(
            next,
            deriveImplications(next).map((d) => ({ ...d, source: "rule" as const })),
            version
          );
          return finalise(next);
        },
      });
      const implications = saved.doc.entities.filter((e) => e.kind === "implication").length;
      const invariants = saved.doc.entities.filter((e) => e.kind === "invariant").length;
      return { detail: `${implications} implications, ${invariants} rules that must hold` };
    }

    case "design": {
      const record = await getSpec(projectId);
      const design = buildDesignPrompt({
        brief: run.brief,
        canvasContext: params.canvasContext,
        researchBrief: (run.meta.research as string | undefined) ?? null,
        doc: record?.doc ?? null,
        userInstructions: instructions,
      });
      const model = await resolveModelForProject(projectId, "pro");
      const result = await generateObject({
        model,
        schema: ArchitectureOutputSchema,
        system: design.system,
        prompt: design.user,
      });
      return {
        detail: `${result.object.nodes.length} components, ${result.object.edges.length} connections`,
        architecture: result.object,
        meta: { architecture: result.object, ussApplied: design.ussApplied },
      };
    }

    case "critique": {
      const arch = run.meta.architecture as ArchitectureOutput | undefined;
      if (!arch) return { skipped: true, detail: "nothing to check" };

      // The critique MUST know the budget.
      //
      // Measured: for "a portfolio site", the design step produced 5 components
      // inside a tier-1 budget of 6 — then the review called it critically
      // unscalable, and the repair dutifully added a Redis cache and a load
      // balancer. Seven components, at a tier whose budget forbids caching
      // outright. A budget-blind reviewer does not merely fail to help; it
      // actively undoes the one mechanism that stops over-engineering.
      const record = await getSpec(projectId);
      const budget = record ? renderBudgetForPrompt(record.doc.complexity) : "";

      const model = await resolveModelForProject(projectId, "flash");
      const critique = await generateObject({
        model,
        schema: CritiqueOutputSchema,
        system: budget
          ? `${CRITIQUE_SYSTEM_PROMPT}\n\nTHIS DESIGN IS BUDGETED. Judge it against the budget below, not against what a large system would need. Do NOT raise missing caches, load balancers, replicas, queues or extra services as issues when the budget excludes them — at this tier their absence is correct. An issue is only critical if it breaks a stated requirement.\n\n${budget}`
          : CRITIQUE_SYSTEM_PROMPT,
        prompt: `Review this freshly generated architecture for the request: "${run.brief.slice(0, 500)}"\n\n${describeArchitecture(arch)}`,
      });

      const critical = critique.object.issues.filter((i) => i.severity === "critical");
      return {
        detail:
          critical.length === 0
            ? "no critical issues"
            : `${critical.length} critical issue${critical.length === 1 ? "" : "s"} to fix`,
        meta: { critical },
      };
    }

    case "repair": {
      const arch = run.meta.architecture as ArchitectureOutput | undefined;
      const critical = (run.meta.critical ?? []) as { title: string; description: string; suggestion: string }[];
      if (!arch || critical.length === 0) {
        return { skipped: true, detail: "nothing to fix" };
      }

      // The SAME system prompt as the design call, so the budget and the
      // derivation rules still bind while it repairs. A repair under the old
      // generic prompt was free to re-add everything the budget had just removed.
      const specRecord = await getSpec(projectId);
      const design = buildDesignPrompt({
        brief: run.brief,
        canvasContext: params.canvasContext,
        researchBrief: (run.meta.research as string | undefined) ?? null,
        doc: specRecord?.doc ?? null,
        userInstructions: instructions,
      });
      const issueList = critical
        .map((i) => `- ${i.title}: ${i.description} FIX: ${i.suggestion}`)
        .join("\n");
      const repaired = await generateObject({
        model: await resolveModelForProject(projectId, "pro"),
        schema: ArchitectureOutputSchema,
        system: design.system,
        prompt: `${design.user}\n\nYou already produced this draft:\n${describeArchitecture(arch)}\n\nA design review found these CRITICAL issues:\n${issueList}\n\nReturn the FULL corrected architecture (all nodes and edges, not a diff), fixing only these issues while keeping everything else intact.`,
      });

      return {
        detail: `fixed ${critical.length} critical issue${critical.length === 1 ? "" : "s"}`,
        architecture: repaired.object,
        meta: { architecture: repaired.object },
      };
    }

    case "record": {
      const arch = run.meta.architecture as ArchitectureOutput | undefined;
      if (!arch) return { skipped: true, detail: "nothing to record" };

      const saved = await commitWithRetry({
        projectId,
        source: "extract",
        changeSummary: "Recorded the generated architecture",
        authorUserId: userId,
        apply: (doc) => finalise(applyArchitectureToSpec(doc, arch, version, run.id).doc),
      });

      // Canvas operations, so a second generation MERGES with what is already
      // there instead of appending a duplicate of every node.
      const operations = diffUssToCanvas(saved.doc, params.canvasNodes, params.canvasEdges);
      const blocking = saved.doc.integrity.filter((f) => f.severity === "blocking").length;

      return {
        detail: blocking > 0 ? `${blocking} blocking issue(s) to resolve` : "recorded",
        architecture: arch,
        operations,
      };
    }
  }
}

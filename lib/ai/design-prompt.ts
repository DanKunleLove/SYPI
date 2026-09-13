import {
  GENERATION_SYSTEM_PROMPT,
  NODE_CATEGORIES_CONTEXT,
  URL_ANALYSIS_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { applyUserInstructions } from "@/lib/ai/index";
import { renderBudgetForPrompt } from "@/lib/uss/complexity";
import { renderUssForPrompt } from "@/lib/uss/render";
import { product, requirements } from "@/lib/uss/views";
import type { Uss } from "@/lib/uss/schema";

/**
 * One builder for every architecture-generation prompt, so the route, the agent
 * tool and the benchmark cannot drift apart.
 *
 * ── The bug this fixes ───────────────────────────────────────────────────────
 * The USS was injected as USER-message text while the SYSTEM prompt stayed
 * `GENERATION_SYSTEM_PROMPT`, which says "Add appropriate middleware (gateways,
 * load balancers, caches) where needed" and "Typically 5-15 nodes". At tier 0 the
 * injected budget says "at most 3 components" and "DO NOT include a dedicated
 * cache tier". Two instructions, in direct contradiction, and the one with more
 * authority was the one that had never heard of the spec.
 *
 * A benchmark run showed exactly what that produces: 19 components against a
 * budget of 5-12, and 20 against 8-18. The spec was not driving the design. It was
 * being argued with, and losing.
 *
 * The fix is not more emphasis. It is removing the contradiction: when a spec
 * exists, the budget moves INTO the system prompt and the hardcoded node-count and
 * middleware advice comes out.
 *
 * ── What deliberately does not change ────────────────────────────────────────
 * `GENERATION_SYSTEM_PROMPT` is untouched, byte for byte. It is the control arm of
 * the A/B that decides whether any of this reasoning layer earns its cost, and
 * editing a control mid-experiment destroys the experiment. With no spec, this
 * builder returns it verbatim — a self-test asserts that by string equality.
 */

export interface DesignPromptInput {
  brief: string;
  /** Existing canvas, when refining rather than designing from scratch. */
  canvasContext?: string | null;
  /** Research on a live site, when reverse-engineering one. */
  researchBrief?: string | null;
  /** The specification, when one exists. */
  doc?: Uss | null;
  userInstructions?: string | null;
}

export interface DesignPrompt {
  system: string;
  user: string;
  /** True when the spec drove the system prompt, rather than riding along in the user message. */
  ussApplied: boolean;
}

/** Sections the design needs. `complexity` is excluded — it goes in the system prompt. */
const DESIGN_SECTIONS = [
  "product",
  "actors",
  "requirements",
  "constraints",
  "capabilities",
  "providers",
  "domain",
  "invariants",
  "implications",
] as const;

/** A doc with no product and no requirements has nothing to drive a design with. */
function isSubstantive(doc: Uss | null | undefined): doc is Uss {
  if (!doc) return false;
  return Boolean(product(doc)) || requirements(doc).length > 0;
}

function specDrivenSystemPrompt(doc: Uss): string {
  return `
${NODE_CATEGORIES_CONTEXT}

You are an expert system architect. The system below has ALREADY been specified.
The specification is authoritative: your job is to REALISE it, not to re-imagine it
and not to design the system you would have designed instead.

DERIVATION RULES:
- Every component must exist because a stated requirement, implication or capability
  demands it. If you cannot name which one, do not add the component.
- Do NOT add gateways, caches, queues, replicas, load balancers or additional
  services unless a listed capability or implication demands one AND the budget
  below permits it. Standard practice is not a reason. A requirement is.
- Each listed capability is realised by exactly one component. Do not realise the
  same capability twice.
- For each INVARIANT listed, one component must visibly enforce it, and that
  component's description must NAME THE MECHANISM — "deduplicates by provider event
  id", "verifies the provider signature", "scopes every query by organisation id".
  A component that merely sounds responsible for a rule does not enforce it.
- Technology marked (inferred) may be used, but say so in the description rather
  than presenting it as decided.
- Every node has at least one connection.

${renderBudgetForPrompt(doc.complexity)}
`.trim();
}

export function buildDesignPrompt(input: DesignPromptInput): DesignPrompt {
  const { brief, canvasContext, researchBrief, doc, userInstructions } = input;

  // Reverse-engineering a live site: the budget must NOT apply. The site has what
  // it has, and telling the model "at most 6 components" would make it describe a
  // system that does not exist. The spec still travels in the user message.
  if (researchBrief) {
    const specBlock = isSubstantive(doc)
      ? renderUssForPrompt(doc, { sections: [...DESIGN_SECTIONS], maxChars: 8_000 })
      : "";
    return {
      system: applyUserInstructions(URL_ANALYSIS_SYSTEM_PROMPT, userInstructions),
      user: [
        `RESEARCH BRIEF:\n\n${researchBrief}`,
        `User's request: ${brief}`,
        canvasContext ?? "",
        specBlock,
      ]
        .filter(Boolean)
        .join("\n\n"),
      ussApplied: false,
    };
  }

  // No spec worth the name: byte-identical to the behaviour that shipped before
  // any of this existed.
  if (!isSubstantive(doc)) {
    return {
      system: applyUserInstructions(GENERATION_SYSTEM_PROMPT, userInstructions),
      user: canvasContext ? `${brief}\n\n${canvasContext}` : brief,
      ussApplied: false,
    };
  }

  const specBlock = renderUssForPrompt(doc, {
    sections: [...DESIGN_SECTIONS],
    maxChars: 12_000,
  });

  return {
    system: applyUserInstructions(specDrivenSystemPrompt(doc), userInstructions),
    user: [`THE SPECIFICATION:\n\n${specBlock}`, `The client's own words: ${brief}`, canvasContext ?? ""]
      .filter(Boolean)
      .join("\n\n"),
    ussApplied: true,
  };
}

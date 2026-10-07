import { finalise } from "@/lib/ai/uss";
import { UssGraph } from "@/lib/uss/graph";
import type { Uss } from "@/lib/uss/schema";

/**
 * Answer one open decision.
 *
 * The answer becomes a recorded constraint with `evidence.kind: "answer"`, which
 * is what turns an UNKNOWN into a KNOWN legitimately. Shared by the web UI's
 * resolve route and the MCP tool, so an answer given by an agent on the user's
 * behalf is recorded exactly like one typed into the app.
 */
export function applyAnswer(
  current: Uss,
  decisionId: string,
  answer: string
): { doc: Uss; affectsComponents: boolean } {
  const g = new UssGraph(current);
  const decision = g.get(decisionId);
  if (!decision || decision.kind !== "openDecision") {
    throw new Error("That question is no longer open");
  }

  g.update(decisionId, {
    resolvedAt: new Date().toISOString(),
    resolution: answer,
    status: "KNOWN",
    confidence: 1,
    evidence: [{ kind: "answer", ref: decisionId, quote: answer.slice(0, 400) }],
  });

  // The answer is now an established constraint, traceable to who said it.
  const constraint = g.add("constraint", {
    title: decision.title,
    category:
      decision.category === "compliance"
        ? "regulatory"
        : decision.category === "budget"
          ? "budget"
          : decision.category === "stack"
            ? "stack"
            : "other",
    statement: `${decision.question} — ${answer}`,
    status: "KNOWN",
    confidence: 1,
    evidence: [{ kind: "answer", ref: decisionId, quote: answer.slice(0, 400) }],
    firstSeenVersion: current.complexity.firstSeenVersion + 1,
  });

  for (const componentId of decision.impact.affectsComponents) {
    g.link("constrains", constraint.id, componentId, {
      status: "KNOWN",
      confidence: 1,
      evidence: [{ kind: "answer", ref: decisionId }],
      firstSeenVersion: current.complexity.firstSeenVersion + 1,
    });
  }

  return { doc: finalise(g.snapshot()), affectsComponents: decision.impact.affectsComponents.length > 0 };
}

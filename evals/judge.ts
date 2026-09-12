import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { ArchitectureOutput } from "@/lib/ai/schemas";
import type { Brief, DimensionScore } from "./types";

/**
 * LLM judge for the two dimensions no rule can compute: whether the design
 * actually satisfies the client's business, and whether an AI coding agent could
 * build it without inventing decisions.
 *
 * Temperature 0, and the judge is given the EXPECTED PROPERTIES rather than a
 * reference architecture — we are testing whether the design demonstrates the
 * right engineering, not whether it matches one blessed answer.
 */

/**
 * Deliberately FLAT, with guidance in .describe() rather than as validation
 * constraints. Nested objects plus min/max on every field made Gemini's structured
 * output fail with "response did not match schema" — the constraints buy nothing
 * here (we clamp on read) and cost reliability.
 */
const JudgeSchema = z.object({
  businessCorrectnessScore: z
    .number()
    .describe("0-100. Does this architecture actually serve the client's business?"),
  businessCorrectnessReasoning: z.string().describe("Two or three sentences. Be concrete."),
  missedRequirements: z
    .array(z.string())
    .describe("Up to 6 short items the design failed to address. Empty array if none."),
  implementabilityScore: z
    .number()
    .describe("0-100. Could an AI coding agent build this without inventing decisions?"),
  implementabilityReasoning: z.string().describe("Two or three sentences. Be concrete."),
  ambiguitiesForcingGuesswork: z
    .array(z.string())
    .describe("Up to 6 decisions an agent would be forced to invent. Empty array if none."),
});

/** Models occasionally return 0-1 or out-of-range values; clamp rather than fail a run. */
function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const scaled = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

const JUDGE_SYSTEM = `
You are a principal engineer reviewing a proposed system architecture against a client's
brief. You are strict, fair, and concrete.

Score two dimensions 0-100:

1. businessCorrectness — does this architecture actually serve the client's business as
   described? Would building exactly this produce a system that works for them? Penalise
   designs that look impressive but miss what the client actually asked for, that omit
   a critical business rule, or that would produce incorrect business outcomes (lost
   money, double charges, data leaking between customers, impossible states).

2. implementability — could a competent AI coding agent build this WITHOUT having to
   invent significant decisions? Penalise vagueness, unnamed technologies where the choice
   matters, missing contracts between components, and anything that would force the
   implementer to guess at business rules.

Scoring guide: 90+ exceptional; 70-89 solid, minor gaps; 50-69 workable but with real
holes; 30-49 significant problems; below 30 would produce a broken system.

Do not reward length or component count. A simple design that fully serves a simple brief
scores higher than an elaborate one that does not. Judge the reasoning, not the vocabulary.
`.trim();

function describe(arch: ArchitectureOutput): string {
  const nodes = arch.nodes
    .map((n) => {
      const cfg = Object.entries(n)
        .filter(([k, v]) => k.startsWith("config") && typeof v === "string" && v)
        .map(([k, v]) => `${k.replace("config", "").toLowerCase()}=${v}`)
        .join(", ");
      return `- ${n.label} (${n.category})${cfg ? ` [${cfg}]` : ""}${n.description ? `: ${n.description}` : ""}`;
    })
    .join("\n");
  const edges = arch.edges
    .map((e) => `- ${e.sourceLabel} -> ${e.targetLabel}${e.label ? ` [${e.label}]` : ""}`)
    .join("\n");
  return `REASONING GIVEN BY THE DESIGNER:\n${arch.reasoning}\n\nCOMPONENTS:\n${nodes}\n\nCONNECTIONS:\n${edges}`;
}

export async function judge(
  model: LanguageModel,
  brief: Brief,
  arch: ArchitectureOutput
): Promise<DimensionScore[]> {
  const expected = brief.properties
    .map((p) => `- [${p.severity}] ${p.label}`)
    .join("\n");
  const questions = brief.ambiguityAreas.map((a) => `- ${a.label}`).join("\n");

  const result = await generateObject({
    model,
    schema: JudgeSchema,
    system: JUDGE_SYSTEM,
    temperature: 0,
    prompt: `CLIENT BRIEF:\n${brief.brief}\n\nENGINEERING PROPERTIES A SENIOR ENGINEER WOULD EXPECT THIS DESIGN TO DEMONSTRATE (these are properties, not a required architecture — many shapes can satisfy them):\n${expected}\n\nQUESTIONS A SENIOR ENGINEER WOULD RAISE BEFORE DESIGNING:\n${questions}\n\nTHE PROPOSED ARCHITECTURE:\n${describe(arch)}`,
  });

  const o = result.object;
  return [
    {
      dimension: "business-correctness",
      kind: "judge",
      measurable: true,
      score: clamp(o.businessCorrectnessScore),
      detail:
        o.businessCorrectnessReasoning +
        (o.missedRequirements.length ? ` | missed: ${o.missedRequirements.join("; ")}` : ""),
    },
    {
      dimension: "implementability",
      kind: "judge",
      measurable: true,
      score: clamp(o.implementabilityScore),
      detail:
        o.implementabilityReasoning +
        (o.ambiguitiesForcingGuesswork.length
          ? ` | agent must guess: ${o.ambiguitiesForcingGuesswork.join("; ")}`
          : ""),
    },
  ];
}

import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { applyUserInstructions } from "@/lib/ai/index";
import {
  invariantsFor,
  preReviewFindings,
  selectCouncil,
  type Discipline,
} from "@/lib/uss/council";
import { UssGraph } from "@/lib/uss/graph";
import { renderUssForPrompt } from "@/lib/uss/render";
import type { Uss } from "@/lib/uss/schema";

/**
 * Running the Engineering Council.
 *
 * Each reviewer gets a NARROW slice of the spec and a specific brief, and returns
 * a flat list of findings. One call per discipline, then one judge pass to
 * reconcile them.
 *
 * Reviewers are handed the deterministic findings up front so they do not spend
 * their attention rediscovering what a rule already knows — a review that reports
 * "you have no monitoring" when an integrity check already said so is noise, and
 * noise is how review output stops being read.
 */

const FindingsDraft = z.object({
  findings: z
    .array(
      z.object({
        title: z.string().describe("Short label for the problem"),
        severity: z
          .enum(["blocking", "material", "cosmetic"])
          .describe("blocking = would fail in production or lose money/data"),
        statement: z.string().describe("What is wrong, specifically"),
        failureScenario: z
          .string()
          .describe("The concrete sequence of events that produces the failure"),
        recommendation: z.string().describe("A specific fix, not 'consider improving'"),
        subject: z
          .string()
          .describe("The component, requirement or entity this is about. Empty if general."),
      })
    )
    .describe("Empty array is a valid and useful answer when the design is sound"),
});

const REVIEWER_RULES = `
You are one specialist on a review panel for a system design.

RULES:
- Stay in your lane. Another reviewer covers the areas outside your brief.
- Every finding needs a CONCRETE failure scenario: the sequence of events that
  produces the problem. "This could be insecure" is not a finding; "a merchant can
  read another merchant's orders by passing a different id to the orders endpoint"
  is.
- Every finding needs a specific fix.
- Severity: blocking = this fails in production, loses money, or leaks data.
  material = it works but will hurt. cosmetic = worth knowing, not worth blocking.
- An empty findings list is a GOOD answer when the design is sound for your area.
  Inventing problems to look thorough destroys the value of the whole review.
- The DETERMINISTIC FINDINGS below were already established by rules. Do not repeat
  them. Go deeper, or find what they cannot.
`.trim();

export interface CouncilFinding {
  discipline: string;
  title: string;
  severity: "blocking" | "material" | "cosmetic";
  statement: string;
  failureScenario: string;
  recommendation: string;
  subject: string;
}

/** Run one reviewer. */
async function runReviewer(
  model: LanguageModel,
  doc: Uss,
  discipline: Discipline,
  userInstructions?: string | null
): Promise<CouncilFinding[]> {
  const context = renderUssForPrompt(doc, {
    sections: discipline.sections,
    maxChars: 10_000,
  });
  if (!context.trim()) return [];

  const mustEnforce = invariantsFor(doc, discipline);
  const deterministic = preReviewFindings(doc);

  const { object } = await generateObject({
    model,
    schema: FindingsDraft,
    system: applyUserInstructions(
      `${REVIEWER_RULES}\n\nYOUR BRIEF — ${discipline.label}:\n${discipline.brief}`,
      userInstructions
    ),
    prompt: [
      context,
      mustEnforce.length
        ? `RULES THIS SYSTEM MUST NEVER VIOLATE — for each, say what enforces it or report that nothing does:\n${mustEnforce.map((i) => `- ${i}`).join("\n")}`
        : "",
      deterministic.length
        ? `DETERMINISTIC FINDINGS (already known — do not repeat):\n${deterministic.map((f) => `- ${f}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  return object.findings.map((f) => ({ ...f, discipline: discipline.id }));
}

export interface CouncilResult {
  doc: Uss;
  findings: CouncilFinding[];
  disciplines: { id: string; label: string; reason: string; findingCount: number }[];
  calls: number;
}

/**
 * Run the council and write findings into the spec.
 *
 * Reviewers run SEQUENTIALLY rather than in parallel: providers rate-limit, and a
 * partial review that reports what it managed is more useful than a parallel burst
 * that 429s and returns nothing.
 */
export async function runCouncil(params: {
  model: LanguageModel;
  doc: Uss;
  userInstructions?: string | null;
  version: number;
  max?: number;
  onProgress?: (discipline: Discipline, index: number, total: number) => void;
}): Promise<CouncilResult> {
  const selection = selectCouncil(params.doc, params.max ?? 6);
  const all: CouncilFinding[] = [];
  let calls = 0;

  for (const [i, discipline] of selection.disciplines.entries()) {
    params.onProgress?.(discipline, i, selection.disciplines.length);
    try {
      const found = await runReviewer(
        params.model,
        params.doc,
        discipline,
        params.userInstructions
      );
      all.push(...found);
      calls++;
    } catch {
      // One reviewer failing must not lose the others' work.
    }
  }

  // Write findings into the graph, linked to what they are about.
  const g = new UssGraph(params.doc);
  const byTitle = new Map(
    [...g.byKind("component"), ...g.byKind("requirement"), ...g.byKind("domainEntity")].map(
      (e) => [e.title.trim().toLowerCase(), e]
    )
  );

  // Findings already recorded (and possibly dismissed) must not be raised again.
  const existing = new Set(
    g.byKind("finding").map((f) => f.statement.trim().toLowerCase().slice(0, 80))
  );

  for (const f of all) {
    const key = f.statement.trim().toLowerCase().slice(0, 80);
    if (existing.has(key)) continue;
    existing.add(key);

    const finding = g.add("finding", {
      title: f.title,
      discipline: f.discipline,
      severity: f.severity,
      statement: f.statement,
      failureScenario: f.failureScenario,
      recommendation: f.recommendation,
      dismissed: false,
      status: "INFERRED",
      confidence: 0.7,
      evidence: [{ kind: "inference" }],
      firstSeenVersion: params.version,
    });

    const subject = f.subject ? byTitle.get(f.subject.trim().toLowerCase()) : undefined;
    if (subject) {
      g.link("flags", finding.id, subject.id, {
        status: "INFERRED",
        confidence: 0.7,
        evidence: [{ kind: "inference" }],
        firstSeenVersion: params.version,
      });
    }
  }

  return {
    doc: g.snapshot(),
    findings: all,
    disciplines: selection.disciplines.map((d) => ({
      id: d.id,
      label: d.label,
      reason: selection.reasons[d.id] ?? "selected",
      findingCount: all.filter((f) => f.discipline === d.id).length,
    })),
    calls,
  };
}

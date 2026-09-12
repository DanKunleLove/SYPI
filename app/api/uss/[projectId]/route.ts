import { getProjectWithAccess } from "@/lib/project-access";
import { getSpec } from "@/lib/uss/store";
import { materialOpenDecisions, product } from "@/lib/uss/views";

/**
 * GET /api/uss/[projectId] — spec head for the UI.
 *
 * Returns only what the panel renders. The full document is never shipped to the
 * client: it is large, and nothing in the UI needs it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const record = await getSpec(projectId);
  if (!record) {
    // No spec yet is a normal state, not an error — the panel hides itself.
    return Response.json({ exists: false });
  }

  const { doc, version } = record;
  const material = materialOpenDecisions(doc);

  return Response.json({
    exists: true,
    version,
    completeness: doc.meta.completeness,
    tier: doc.complexity.tier,
    tierLabel: doc.complexity.label,
    tierRationale: doc.complexity.rationale,
    productTitle: product(doc)?.title ?? null,
    counts: {
      requirements: doc.entities.filter(
        (e) => e.kind === "requirement" && e.requirementKind === "functional"
      ).length,
      components: doc.entities.filter((e) => e.kind === "component").length,
      openDecisions: doc.entities.filter((e) => e.kind === "openDecision" && !e.resolvedAt).length,
      material: material.length,
    },
    decisions: material.slice(0, 8).map((d) => ({
      id: d.id,
      question: d.question,
      why: d.why,
      category: d.category,
      severity: d.impact.severity,
      options: d.options,
    })),
    integrity: doc.integrity.filter((f) => f.severity !== "cosmetic").slice(0, 6),
  });
}

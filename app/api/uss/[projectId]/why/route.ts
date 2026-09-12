import { getProjectWithAccess } from "@/lib/project-access";
import { getSpec } from "@/lib/uss/store";
import { UssGraph } from "@/lib/uss/graph";

/**
 * GET /api/uss/[projectId]/why?label=Equipment%20DB
 *
 * Walks the reasoning chain backwards for one component:
 *
 *   component --satisfies--> requirement <--implies-- (trigger)
 *             --realizes---> capability  <--requires-- implication
 *             <--decides---- decision
 *
 * This is the query the entity graph exists to make possible, and the answer to
 * "why is this here?" being a traversal rather than a model's recollection.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const label = new URL(request.url).searchParams.get("label")?.trim();
  if (!label) {
    return Response.json({ error: "label is required" }, { status: 400 });
  }

  const record = await getSpec(projectId);
  if (!record) return Response.json({ found: false });

  const g = new UssGraph(record.doc);
  const component = g
    .byKind("component")
    .find((c) => c.title.trim().toLowerCase() === label.toLowerCase());

  if (!component) return Response.json({ found: false });

  const requirements = g.neighbours(component.id, "satisfies");
  const capabilities = g.neighbours(component.id, "realizes");
  const decisions = g.sources(component.id, "decides");

  // Implications reach a component through the capabilities it realizes.
  const implications = capabilities.flatMap((cap) =>
    g.sources(cap.id, "requires").filter((e) => e.kind === "implication")
  );

  return Response.json({
    found: true,
    component: {
      id: component.id,
      title: component.title,
      responsibility: component.responsibility,
      status: component.status,
      orphaned: component.orphaned,
    },
    // An empty requirements array is the honest answer for an unjustified
    // component, and the UI says so rather than inventing a reason.
    requirements: requirements.map((r) => ({
      id: r.id,
      title: r.title,
      statement: r.kind === "requirement" ? r.statement : "",
    })),
    implications: [
      ...new Map(
        implications.map((i) => [
          i.id,
          {
            id: i.id,
            statement: i.kind === "implication" ? i.statement : "",
            trigger: i.kind === "implication" ? i.trigger : "",
            source: i.kind === "implication" ? i.source : "model",
          },
        ])
      ).values(),
    ],
    capabilities: capabilities.map((c) => ({
      id: c.id,
      title: c.title,
      why: c.kind === "capability" ? c.why : "",
    })),
    decisions: decisions.map((d) => ({
      id: d.id,
      choice: d.kind === "decision" ? d.choice : "",
      rationale: d.kind === "decision" ? d.rationale : "",
      alternatives: d.kind === "decision" ? d.alternatives : [],
    })),
  });
}

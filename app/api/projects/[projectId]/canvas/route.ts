import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getProjectWithAccess } from "@/lib/project-access";

/**
 * PUT /api/projects/[projectId]/canvas
 * Save canvas state (nodes + edges) to Vercel Blob.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    const { project } = await getProjectWithAccess(projectId);
    if (!project) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { nodes, edges } = body;

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return Response.json({ error: "Invalid canvas data" }, { status: 400 });
    }

    const canvasJson = JSON.stringify({ nodes, edges });

    // Upload to Vercel Blob (overwrite if exists)
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error("[canvas/save] BLOB_READ_WRITE_TOKEN is not set");
      return Response.json({ error: "Blob storage not configured" }, { status: 500 });
    }

    const blob = await put(
      `canvas/${projectId}.json`,
      canvasJson,
      {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        token,
      }
    );

    // Store blob URL on project record
    await prisma.project.update({
      where: { id: projectId },
      data: { canvasJsonPath: blob.url },
    });

    return Response.json({ success: true, url: blob.url });
  } catch (error) {
    console.error("[canvas/save] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[projectId]/canvas
 * Load saved canvas state from Vercel Blob.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    const { project } = await getProjectWithAccess(projectId);
    if (!project) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!project.canvasJsonPath) {
      return Response.json({ nodes: [], edges: [] });
    }

    // Fetch canvas JSON from Vercel Blob
    const response = await fetch(project.canvasJsonPath);
    if (!response.ok) {
      console.error("[canvas/load] Blob fetch failed:", response.status);
      return Response.json({ nodes: [], edges: [] });
    }

    const data = await response.json();
    return Response.json({
      nodes: data.nodes ?? [],
      edges: data.edges ?? [],
    });
  } catch (error) {
    console.error("[canvas/load] Error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Load failed" },
      { status: 500 }
    );
  }
}

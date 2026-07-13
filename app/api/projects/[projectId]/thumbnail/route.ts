import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getProjectWithAccess } from "@/lib/project-access";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// Thumbnails are 800×450 PNG captures — ~4MB of base64 is far above any
// legitimate capture; anything bigger is abuse of the Blob store.
const MAX_DATA_URL_CHARS = 4_000_000;

/**
 * PUT /api/projects/[projectId]/thumbnail
 * Receives a base64 PNG data URL, uploads to Vercel Blob, saves URL on project.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const { project } = await getProjectWithAccess(projectId);
  if (!project) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return Response.json({ error: "Blob storage not configured" }, { status: 500 });
  }

  const burst = checkRateLimit(`thumb:${projectId}`, 10, 60_000);
  if (!burst.ok) return rateLimitResponse(burst.retryAfter);

  try {
    const body = await request.json();
    const dataUrl: string = body.dataUrl;
    if (!dataUrl?.startsWith("data:image/png;base64,")) {
      return Response.json({ error: "Invalid data URL" }, { status: 400 });
    }
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      return Response.json({ error: "Thumbnail too large" }, { status: 400 });
    }

    const base64 = dataUrl.replace("data:image/png;base64,", "");
    const buffer = Buffer.from(base64, "base64");

    const blob = await put(`thumbnails/${projectId}.png`, buffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { thumbnailUrl: blob.url },
    });

    return Response.json({ url: blob.url });
  } catch (error) {
    console.error("[thumbnail] Error:", error);
    return Response.json({ error: "Failed to save thumbnail" }, { status: 500 });
  }
}

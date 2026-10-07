import { del, put } from "@vercel/blob";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { canEditProject, getProjectWithAccess } from "@/lib/project-access";
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

  const { project, role } = await getProjectWithAccess(projectId);
  if (!project) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canEditProject(role)) {
    return Response.json(
      { error: "Read-only collaborators cannot update project thumbnails" },
      { status: 403 }
    );
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

    // Unguessable per-save path, like the canvas: a fixed public URL would expose a
    // picture of the architecture to anyone who knew the project id.
    const blob = await put(
      `thumbnails/${projectId}/${randomBytes(16).toString("hex")}.png`,
      buffer,
      {
        access: "public",
        contentType: "image/png",
        addRandomSuffix: false,
        allowOverwrite: false,
        token,
      }
    );

    const previous = await prisma.project.findUnique({
      where: { id: projectId },
      select: { thumbnailUrl: true },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { thumbnailUrl: blob.url },
    });

    // Drop the replaced thumbnail and the legacy fixed-path one. Best effort.
    const stale = [
      previous?.thumbnailUrl,
      `${new URL(blob.url).origin}/thumbnails/${projectId}.png`,
    ].filter((u): u is string => !!u && u !== blob.url);
    await del(stale, { token }).catch((err) =>
      console.warn("[thumbnail] Could not delete replaced blob:", err)
    );

    return Response.json({ url: blob.url });
  } catch (error) {
    console.error("[thumbnail] Error:", error);
    return Response.json({ error: "Failed to save thumbnail" }, { status: 500 });
  }
}

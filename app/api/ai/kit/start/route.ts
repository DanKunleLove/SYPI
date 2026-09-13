import { getKitDomain, KIT_DOMAINS } from "@/lib/ai/kit";
import { startRun } from "@/lib/ai/run";
import { getDbUser, getProjectWithAccess } from "@/lib/project-access";

/**
 * Begin a System Kit run. Charges quota ONCE; the files are free.
 *
 * The Kit used to be seven sequential model calls inside one request. On Vercel
 * Hobby a function dies at 60 seconds, so it has never once completed — and the
 * client, which decided success by COUNTING the files it received, could only
 * report "Kit generation ended early". Every distinct cause collapsed into that
 * one unhelpful sentence, and a failure on file seven destroyed six finished
 * files.
 *
 * Now: this route validates and charges, then the client requests one file at a
 * time from /api/ai/kit/file. Each file appears as it lands, a failure names
 * itself, and a retry re-runs only what failed.
 */

export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { projectId?: unknown; canvasContext?: unknown; projectName?: unknown; domain?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.domain !== undefined && !KIT_DOMAINS.some((d) => d.id === body.domain)) {
    return Response.json({ error: "Unknown kit domain" }, { status: 400 });
  }
  const domain = getKitDomain(body.domain);

  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  if (!projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const access = await getProjectWithAccess(projectId);
  if (!access.project) {
    return Response.json({ error: access.reason ?? "Forbidden" }, { status: 403 });
  }

  const projectName =
    typeof body.projectName === "string" && body.projectName.trim()
      ? body.projectName.trim().slice(0, 120)
      : "Untitled Project";
  const canvasContext =
    typeof body.canvasContext === "string" ? body.canvasContext.slice(0, 24_000) : "";

  const started = await startRun({
    projectId,
    userId: user.id,
    kind: "kit",
    brief: projectName,
    meta: { domain: domain.id, projectName, canvasContext },
  });
  if (!started.ok) return Response.json({ error: started.error }, { status: 429 });

  return Response.json({
    runId: started.run.id,
    domain: domain.id,
    files: domain.files.map((f) => ({ name: f.name, title: f.title })),
  });
}

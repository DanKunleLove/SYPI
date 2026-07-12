import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

/** Client-recordable event types. Server-side events (kit_generated) are written directly. */
const CLIENT_TYPES = new Set([
  "spec_exported",
  "png_exported",
  "mermaid_exported",
  "bundle_exported",
  "share_invited",
  "onboarding_done",
  "checklist_step",
  "palette_used",
  "domain_selected",
]);

/** Fire-and-forget usage events for the activation/retention metrics. */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const burst = checkRateLimit(`events:${user.id}`, 60, 60_000);
  if (!burst.ok) return rateLimitResponse(burst.retryAfter);

  let body: { type?: unknown; meta?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type =
    typeof body.type === "string" && CLIENT_TYPES.has(body.type) ? body.type : null;
  if (!type) {
    return Response.json({ error: "Unknown event type" }, { status: 400 });
  }

  let meta: Record<string, string> | undefined;
  if (body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)) {
    meta = {};
    for (const [k, v] of Object.entries(body.meta as Record<string, unknown>).slice(0, 8)) {
      if (typeof v === "string") meta[k.slice(0, 40)] = v.slice(0, 120);
    }
  }

  await prisma.usageEvent.create({
    data: { userId: user.id, type, meta },
  });

  return Response.json({ ok: true }, { status: 201 });
}

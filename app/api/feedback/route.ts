import { prisma } from "@/lib/prisma";
import { getDbUser } from "@/lib/project-access";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

const TYPES = new Set(["bug", "complaint", "idea", "other"]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** User feedback: bug reports, complaints, ideas. Lands on /admin + emails the admins. */
export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const burst = checkRateLimit(`feedback:${user.id}`, 5, 10 * 60_000);
  if (!burst.ok) return rateLimitResponse(burst.retryAfter);

  let body: { type?: unknown; message?: unknown; path?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = typeof body.type === "string" && TYPES.has(body.type) ? body.type : null;
  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim().slice(0, 2000)
      : null;
  const path = typeof body.path === "string" ? body.path.slice(0, 200) : null;

  if (!type || !message) {
    return Response.json(
      { error: "type (bug|complaint|idea|other) and message are required" },
      { status: 400 }
    );
  }

  const feedback = await prisma.feedback.create({
    data: { userId: user.id, type, message, path },
  });

  // Notify the admins — best-effort, never blocks the response.
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (admins.length > 0) {
    void sendEmail({
      to: admins[0],
      subject: `SYPI feedback (${type}) from ${user.email}`,
      html: `<p><strong>${type.toUpperCase()}</strong> from ${escapeHtml(
        user.name ?? user.email
      )} (${user.email})${path ? ` on <code>${escapeHtml(path)}</code>` : ""}:</p>
<blockquote>${escapeHtml(message).replace(/\n/g, "<br/>")}</blockquote>
<p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://sypi-ai-dev.vercel.app"}/admin">Open the admin board</a></p>`,
    }).catch(() => {});
  }

  return Response.json({ id: feedback.id }, { status: 201 });
}

import { WebhookHandler, isThreadNotificationEvent } from "@liveblocks/node";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

/**
 * Liveblocks notification webhook → email. Fires when a user is mentioned in,
 * or participates in, a comment thread. The room id is the projectId.
 *
 * Configure in the Liveblocks dashboard (Webhooks): point a "notification" event
 * at /api/webhooks/liveblocks and set LIVEBLOCKS_WEBHOOK_SECRET_KEY.
 */
export async function POST(request: Request) {
  const secret = process.env.LIVEBLOCKS_WEBHOOK_SECRET_KEY;
  if (!secret) {
    console.error("[liveblocks-webhook] LIVEBLOCKS_WEBHOOK_SECRET_KEY not set");
    return new Response("Webhook not configured", { status: 500 });
  }

  const handler = new WebhookHandler(secret);
  const rawBody = await request.text();

  let event;
  try {
    event = handler.verifyRequest({ headers: request.headers, rawBody });
  } catch (err) {
    console.error("[liveblocks-webhook] verification failed", err);
    return new Response("Could not verify webhook", { status: 400 });
  }

  if (isThreadNotificationEvent(event)) {
    const { userId: recipientClerkId, roomId } = event.data;

    const [user, project] = await Promise.all([
      prisma.user.findUnique({
        where: { clerkId: recipientClerkId },
        select: { email: true, name: true },
      }),
      prisma.project.findUnique({
        where: { id: roomId },
        select: { id: true, name: true },
      }),
    ]);

    if (user?.email && project) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const link = `${appUrl}/${project.id}`;
      await sendEmail({
        to: user.email,
        subject: `New comment in ${project.name}`,
        html: `<p>Hi ${user.name ?? "there"},</p>
<p>You have a new comment or mention in <strong>${escapeHtml(project.name)}</strong>.</p>
<p><a href="${link}">Open the project</a> to view and reply.</p>
<p style="color:#888;font-size:12px">— spi AI</p>`,
      });
    }
  }

  return new Response(null, { status: 200 });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

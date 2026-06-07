import { Resend } from "resend";

/**
 * Thin email helper. No-ops gracefully when RESEND_API_KEY is unset so the app
 * (and CI build) work without email configured — it just logs and skips.
 */

const FROM = process.env.EMAIL_FROM ?? "SYPI <onboarding@resend.dev>";

let client: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to} ("${subject}")`);
    return { sent: false, reason: "not-configured" };
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false, reason: err instanceof Error ? err.message : "error" };
  }
}

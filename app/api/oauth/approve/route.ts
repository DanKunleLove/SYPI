import { getDbUser } from "@/lib/project-access";
import { OAuthConfigError, sign, verify } from "@/lib/mcp/oauth";

/**
 * The consent screen posts here. Requires a signed-in SYPI session (not public in
 * proxy.ts), and acts only on a TICKET — the authorize request as the consent
 * page already validated and signed it. So a crafted POST cannot name a redirect
 * URI of its own: it can only approve exactly what the user was shown.
 *
 * Cross-site forgery is covered by the session cookie's SameSite=Lax (not sent on
 * a cross-site POST) together with the ticket, which an attacker cannot mint.
 */

function back(redirectUri: string, params: Record<string, string>) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  return Response.redirect(url.toString(), 303);
}

export async function POST(request: Request) {
  const user = await getDbUser();
  if (!user) return new Response("Sign in to SYPI first.", { status: 401 });

  const form = await request.formData();
  const decision = form.get("decision");
  let ticket: Record<string, unknown> | null;
  try {
    ticket = verify("ticket", String(form.get("ticket") ?? ""));
  } catch (e) {
    if (e instanceof OAuthConfigError) return new Response(e.message, { status: 503 });
    throw e;
  }
  if (!ticket) {
    return new Response("This approval link has expired. Go back and connect again.", { status: 400 });
  }

  const redirectUri = String(ticket.ru);
  const state = typeof ticket.st === "string" ? ticket.st : "";

  if (decision !== "allow") {
    return back(redirectUri, { error: "access_denied", state });
  }

  const code = sign(
    "code",
    { u: user.id, cid: ticket.cid, ru: redirectUri, cc: ticket.cc, n: ticket.cn },
    300
  );
  return back(redirectUri, { code, state });
}

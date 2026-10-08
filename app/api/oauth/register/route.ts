import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { isAcceptableRedirect, OAuthConfigError, registerClient } from "@/lib/mcp/oauth";

/**
 * RFC 7591 dynamic client registration.
 *
 * Stateless: the client id IS the registration (a signed record of its redirect
 * URIs), so nothing is stored and there is nothing to clean up. Anyone may
 * register — that is what makes "connect in one click" possible — which is why
 * the consent screen, not this endpoint, is the control: it shows the user the
 * name and the exact host that will receive access.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function oauthError(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status, headers: CORS });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(`oauth:register:${ip}`, 20, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  let body: { client_name?: unknown; redirect_uris?: unknown };
  try {
    body = await request.json();
  } catch {
    return oauthError("invalid_client_metadata", "Body must be JSON.");
  }

  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > 5) {
    return oauthError("invalid_redirect_uri", "Provide between 1 and 5 redirect_uris.");
  }
  const redirectUris = uris.filter((u): u is string => typeof u === "string" && u.length <= 500);
  if (redirectUris.length !== uris.length || !redirectUris.every(isAcceptableRedirect)) {
    return oauthError(
      "invalid_redirect_uri",
      "Redirect URIs must be https (or http on localhost) and have no fragment."
    );
  }

  const name =
    typeof body.client_name === "string" && body.client_name.trim()
      ? body.client_name.trim().slice(0, 80)
      : "An MCP client";

  try {
    return Response.json(
      {
        client_id: registerClient(name, redirectUris),
        client_name: name,
        redirect_uris: redirectUris,
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      { status: 201, headers: CORS }
    );
  } catch (e) {
    if (e instanceof OAuthConfigError) return oauthError("server_error", e.message, 503);
    throw e;
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

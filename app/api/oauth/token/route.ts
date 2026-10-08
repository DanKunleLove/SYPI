import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { createToken, pruneTokensNamed } from "@/lib/mcp/tokens";
import { OAuthConfigError, pkceMatches, resourceIsOurs, SCOPE, verify } from "@/lib/mcp/oauth";

/**
 * OAuth token endpoint — authorization_code + PKCE only.
 *
 * What it returns is a normal SYPI personal access token, so the connection shows
 * up under Settings → Agent access and is revoked there. There is no refresh
 * grant: the token does not expire, it is revoked (see lib/mcp/oauth.ts for why
 * that is the honest first version).
 */

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Cache-Control": "no-store",
  Pragma: "no-cache",
};

function fail(error: string, description: string, status = 400) {
  return Response.json({ error, error_description: description }, { status, headers: HEADERS });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = checkRateLimit(`oauth:token:${ip}`, 30, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfter);

  // The spec says form-encoded; some clients send JSON. Accept both.
  const params = new URLSearchParams();
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(json)) if (typeof v === "string") params.set(k, v);
    } else {
      new URLSearchParams(await request.text()).forEach((v, k) => params.set(k, v));
    }
  } catch {
    return fail("invalid_request", "Could not read the request body.");
  }

  if (params.get("grant_type") !== "authorization_code") {
    return fail("unsupported_grant_type", "Only authorization_code is supported.");
  }

  const origin = new URL(request.url).origin;
  if (!resourceIsOurs(params.get("resource"), origin)) {
    return fail("invalid_target", "That resource is not served by this server.");
  }

  let grant: Record<string, unknown> | null;
  try {
    grant = verify("code", params.get("code"));
  } catch (e) {
    if (e instanceof OAuthConfigError) return fail("server_error", e.message, 503);
    throw e;
  }
  // One message for every way a code can be wrong, so this is not an oracle.
  if (!grant) return fail("invalid_grant", "The authorization code is invalid or has expired.");

  if (params.get("redirect_uri") !== grant.ru) {
    return fail("invalid_grant", "redirect_uri does not match the authorization request.");
  }
  const clientId = params.get("client_id");
  if (clientId && clientId !== grant.cid) {
    return fail("invalid_grant", "client_id does not match the authorization request.");
  }
  const verifier = params.get("code_verifier");
  if (!verifier || !pkceMatches(verifier, String(grant.cc))) {
    return fail("invalid_grant", "PKCE verification failed.");
  }

  const user = await prisma.user.findUnique({ where: { id: String(grant.u) } });
  if (!user || user.status === "suspended") {
    return fail("invalid_grant", "The account that approved this is no longer available.");
  }

  const name = `${String(grant.n ?? "MCP client").slice(0, 40)} (OAuth)`;
  const { token } = await createToken(user.id, name);
  await pruneTokensNamed(user.id, name, 3);

  return Response.json(
    { access_token: token, token_type: "Bearer", scope: SCOPE },
    { headers: HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}

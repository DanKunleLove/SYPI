import { protectedResourceMetadata } from "@/lib/mcp/oauth";

/**
 * RFC 9728 protected-resource metadata. Clients look for it at the path-suffixed
 * URL (/.well-known/oauth-protected-resource/api/mcp) first and the bare one
 * second, so the optional catch-all answers both.
 */
export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function GET(request: Request) {
  return Response.json(protectedResourceMetadata(new URL(request.url).origin), { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

import { authorizationServerMetadata } from "@/lib/mcp/oauth";

/** RFC 8414 authorization-server metadata (also answers the path-inserted form). */
export const dynamic = "force-dynamic";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function GET(request: Request) {
  return Response.json(authorizationServerMetadata(new URL(request.url).origin), { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

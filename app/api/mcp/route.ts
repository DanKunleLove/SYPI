import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { userFromToken } from "@/lib/mcp/tokens";
import { resourceMetadataUrl } from "@/lib/mcp/oauth";
import { createMcpServer } from "@/lib/mcp/server";

/**
 * POST /api/mcp — Model Context Protocol endpoint (stateless streamable HTTP).
 *
 * Auth is a personal access token (Authorization: Bearer sypi_…), not a Clerk
 * session — see proxy.ts, which lets this path through so the token check below
 * is the gate. Stateless: a fresh server per request, nothing held between calls.
 */
export const maxDuration = 60;

async function handle(request: Request) {
  const user = await userFromToken(request.headers.get("authorization"));
  if (!user) {
    // The resource_metadata pointer is what lets ChatGPT / Claude discover OAuth
    // on their own: without it a 401 is a dead end for a client that cannot send
    // a hand-made header.
    const origin = new URL(request.url).origin;
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Missing or invalid token" }, id: null },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl(origin)}"`,
        },
      }
    );
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await createMcpServer(user).connect(transport);
  return transport.handleRequest(request);
}

export { handle as POST, handle as GET, handle as DELETE };

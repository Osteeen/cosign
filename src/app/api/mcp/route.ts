import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateAgentKey, problem, rateLimit, tooMany } from "@/lib/api";
import { buildCosignMcpServer } from "@/lib/mcp/server";

// Remote MCP endpoint (streamable HTTP, stateless, JSON responses).
// Auth: "Authorization: Bearer <agent API key>" on every request.
export async function POST(request: Request) {
  const auth = await authenticateAgentKey(request);
  if (!auth) {
    return problem(401, "unauthorized", "Send this agent's Cosign API key as: Authorization: Bearer key_...:cs_...", { "WWW-Authenticate": "Bearer" });
  }
  const limited = rateLimit(`mcp:${auth.keyId}`, 60, 60_000);
  if (!limited.ok) return tooMany(limited.retryAfter);

  const server = buildCosignMcpServer(auth.agent);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Stateless: nothing outlives the request.
    void server.close();
  }
}

const notAllowed = () => problem(405, "method_not_allowed", "This MCP endpoint is stateless: send JSON-RPC requests with POST.", { Allow: "POST" });
export const GET = notAllowed;
export const DELETE = notAllowed;

import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { MCP_INSTRUCTIONS, registerMarkorganicTools } from "@/lib/mcp/server";
import { OAUTH_SCOPE, verifyAccessToken } from "@/lib/oauth/core";

/*
 * Public MCP endpoint: https://www.markorganic.com/api/mcp
 *
 * Every request needs a bearer token. Claude and ChatGPT discover the OAuth
 * server from the 401 challenge, the customer signs in once with a WhatsApp
 * code, and the verified phone number rides along with every tool call.
 */
const handler = createMcpHandler(registerMarkorganicTools, {
  serverInfo: { name: "markorganic", version: "1.1.0" },
  instructions: MCP_INSTRUCTIONS,
});

const authed = withMcpAuth(handler, (_req, token) => verifyAccessToken(token), {
  required: true,
  requiredScopes: [OAUTH_SCOPE],
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export { authed as GET, authed as POST, authed as DELETE };

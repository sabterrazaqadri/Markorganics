import { createMcpHandler } from "mcp-handler";
import { MCP_INSTRUCTIONS, registerMarkorganicTools } from "@/lib/mcp/server";

/*
 * Public MCP endpoint: https://markorganic.com/api/mcp
 * Add this URL as a custom connector in Claude or ChatGPT.
 */
const handler = createMcpHandler(registerMarkorganicTools, {
  serverInfo: { name: "markorganic", version: "1.0.0" },
  instructions: MCP_INSTRUCTIONS,
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export { handler as GET, handler as POST, handler as DELETE };

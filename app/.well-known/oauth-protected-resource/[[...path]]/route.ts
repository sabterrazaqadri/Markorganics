import { generateProtectedResourceMetadata } from "mcp-handler";
import { OAUTH_SCOPE, mcpResourceUrl, publicOrigin } from "@/lib/oauth/core";
import { corsPreflight, jsonResponse } from "@/lib/oauth/http";

/** RFC 9728, served at the root and path-suffixed (/.well-known/oauth-protected-resource/api/mcp). */
export function GET(req: Request) {
  const origin = publicOrigin(req);
  return jsonResponse(
    generateProtectedResourceMetadata({
      authServerUrls: [origin],
      resourceUrl: mcpResourceUrl(origin),
      additionalMetadata: { scopes_supported: [OAUTH_SCOPE], resource_name: "MARKORGANIC shop" },
    }),
  );
}

export const OPTIONS = corsPreflight;

import { authorizationServerMetadata, publicOrigin } from "@/lib/oauth/core";
import { corsPreflight, jsonResponse } from "@/lib/oauth/http";

/** RFC 8414 authorization server metadata. */
export function GET(req: Request) {
  return jsonResponse(authorizationServerMetadata(publicOrigin(req)));
}

export const OPTIONS = corsPreflight;

import { isAllowedRedirectUri, registerClient } from "@/lib/oauth/core";
import { corsPreflight, jsonResponse, oauthError } from "@/lib/oauth/http";
import { rateLimit } from "@/lib/rate-limit";

/** Dynamic client registration (RFC 7591) for public MCP clients. */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  if (!rateLimit(`oauth:register:${ip}`, 20, 60 * 60_000).ok) return oauthError("too_many_requests", "Slow down.", 429);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return oauthError("invalid_client_metadata", "Body must be JSON.");
  }
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (redirectUris.length === 0 || redirectUris.length > 10 || !redirectUris.every(isAllowedRedirectUri)) {
    return oauthError("invalid_redirect_uri", "Provide 1 to 10 https (or loopback) redirect_uris.");
  }
  const grantTypes = Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code", "refresh_token"];
  if (!grantTypes.every((g) => g === "authorization_code" || g === "refresh_token")) {
    return oauthError("invalid_client_metadata", "Only authorization_code and refresh_token grants are supported.");
  }
  const clientName = typeof body.client_name === "string" ? body.client_name : "";
  const client = await registerClient({ clientName, redirectUris });

  return jsonResponse(
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
}

export const OPTIONS = corsPreflight;

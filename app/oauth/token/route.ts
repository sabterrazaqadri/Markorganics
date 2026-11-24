import { exchangeAuthorizationCode, refreshAccessToken } from "@/lib/oauth/core";
import { clientIdFrom, corsPreflight, jsonResponse, oauthError, readBody } from "@/lib/oauth/http";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
  if (!rateLimit(`oauth:token:${ip}`, 120, 10 * 60_000).ok) return oauthError("too_many_requests", "Slow down.", 429);

  const body = await readBody(req);
  const clientId = clientIdFrom(req, body);
  if (!clientId) return oauthError("invalid_client", "client_id is required.", 401);

  if (body.grant_type === "authorization_code") {
    if (!body.code || !body.redirect_uri || !body.code_verifier) {
      return oauthError("invalid_request", "code, redirect_uri and code_verifier are required.");
    }
    const result = await exchangeAuthorizationCode({
      code: body.code,
      clientId,
      redirectUri: body.redirect_uri,
      codeVerifier: body.code_verifier,
      resource: body.resource,
    });
    return result.ok ? jsonResponse(result.body) : oauthError(result.error, result.description);
  }

  if (body.grant_type === "refresh_token") {
    if (!body.refresh_token) return oauthError("invalid_request", "refresh_token is required.");
    const result = await refreshAccessToken({ refreshToken: body.refresh_token, clientId });
    return result.ok ? jsonResponse(result.body) : oauthError(result.error, result.description);
  }

  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

export const OPTIONS = corsPreflight;

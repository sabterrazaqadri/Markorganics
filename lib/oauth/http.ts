import "server-only";

/** Browser-based MCP clients call the OAuth endpoints cross-origin. */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS, ...extra },
  });
}

export const oauthError = (error: string, description: string, status = 400) =>
  jsonResponse({ error, error_description: description }, status);

export const corsPreflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });

/** Token and revoke endpoints accept form bodies (the spec) and JSON (some clients). */
export async function readBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const data = (await req.json()) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === "string" ? v : String(v ?? "")]));
    }
    const form = new URLSearchParams(await req.text());
    return Object.fromEntries(form.entries());
  } catch {
    return {};
  }
}

/** client_id may also arrive in HTTP Basic auth even for public clients. */
export function clientIdFrom(req: Request, body: Record<string, string>): string {
  if (body.client_id) return body.client_id;
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Basic ")) {
    try {
      return decodeURIComponent(atob(auth.slice(6)).split(":")[0] ?? "");
    } catch {
      return "";
    }
  }
  return "";
}

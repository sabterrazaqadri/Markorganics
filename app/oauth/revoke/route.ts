import { revokeToken } from "@/lib/oauth/core";
import { corsPreflight, readBody } from "@/lib/oauth/http";

/** RFC 7009: always 200, whether or not the token existed. */
export async function POST(req: Request) {
  const body = await readBody(req);
  if (body.token) await revokeToken(body.token);
  return new Response(null, { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
}

export const OPTIONS = corsPreflight;

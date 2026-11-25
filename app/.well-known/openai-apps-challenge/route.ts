/** OpenAI app-directory domain verification: paste the token from the portal into OPENAI_APPS_CHALLENGE. */
export function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE?.trim();
  if (!token) return new Response("Not configured", { status: 404 });
  return new Response(token, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

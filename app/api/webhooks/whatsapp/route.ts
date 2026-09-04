import { NextResponse } from "next/server";
import { resolveCredentials } from "@/lib/integrations/config";
import { logCall } from "@/lib/integrations/http";
import { processWebhook, verifySignature } from "@/lib/whatsapp/inbound";

/**
 * Meta's Cloud API webhook.
 *
 * GET  — the one-time subscription handshake: echo hub.challenge when the
 *        verify token matches.
 * POST — messages and delivery receipts. The X-Hub-Signature-256 is checked
 *        against the raw body before anything is parsed, and a body that does
 *        not verify is dropped with a 401.
 *
 * Meta retries on any non-2xx, so genuine processing errors return 200 with
 * the problem logged rather than triggering a retry storm.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const creds = await resolveCredentials("whatsapp");
  const expected = creds.values.verifyToken;

  if (mode === "subscribe" && expected && token === expected) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Verification failed." }, { status: 403 });
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const creds = await resolveCredentials("whatsapp");
  const appSecret = creds.values.appSecret;

  if (!appSecret) {
    await logCall({
      provider: "whatsapp",
      direction: "inbound",
      operation: "webhook:rejected",
      method: "POST",
      endpoint: "/api/webhooks/whatsapp",
      responseStatus: 401,
      ok: false,
      dryRun: false,
      durationMs: 0,
      error: "No app secret is configured, so the signature cannot be verified.",
    });
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 401 });
  }

  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), appSecret)) {
    await logCall({
      provider: "whatsapp",
      direction: "inbound",
      operation: "webhook:rejected",
      method: "POST",
      endpoint: "/api/webhooks/whatsapp",
      responseStatus: 401,
      ok: false,
      dryRun: false,
      durationMs: 0,
      error: "X-Hub-Signature-256 did not verify.",
    });
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  try {
    const outcome = await processWebhook(JSON.parse(raw));
    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    console.error("whatsapp webhook failed", err);
    // 200 on purpose: Meta retries non-2xx, and a parse bug would retry forever.
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}

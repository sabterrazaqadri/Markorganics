import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveCredentials } from "@/lib/integrations/config";
import { isProvider } from "@/lib/integrations/registry";
import { logCall } from "@/lib/integrations/http";
import { getCourier } from "@/lib/courier";
import { getShipmentByTracking, syncShipment } from "@/lib/courier/shipments";

/**
 * Courier status webhooks.
 *
 * Where a courier offers them, a push beats a poll: the endpoint verifies the
 * payload, then asks the adapter to re-read the shipment rather than trusting
 * the webhook body's own status. That way one code path — the adapter's own
 * `track()` — is the only thing that ever interprets a courier's vocabulary,
 * and a forged webhook cannot move an order by itself.
 *
 * Verification is a shared secret: `webhookSecret` in the provider's config,
 * sent either as `x-mark-signature: sha256=<hmac of the raw body>` or, for
 * couriers that cannot sign, as `x-mark-secret: <secret>`.
 *
 * PostEx does not document a merchant webhook, so today this endpoint is
 * dormant and the 30-minute poll is what actually keeps statuses current.
 */

export const dynamic = "force-dynamic";

function verify(raw: string, headers: Headers, secret: string): boolean {
  const signature = headers.get("x-mark-signature");
  if (signature) {
    const [algorithm, provided] = signature.split("=");
    if (algorithm !== "sha256" || !provided) return false;
    const expected = createHmac("sha256", secret).update(raw, "utf8").digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const plain = headers.get("x-mark-secret");
  if (!plain) return false;
  const a = Buffer.from(plain, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Couriers disagree about what to call a tracking number; accept the usual names. */
function trackingFrom(payload: unknown): string {
  const body = (payload ?? {}) as Record<string, unknown>;
  for (const key of ["trackingNumber", "tracking_number", "cn", "cnNumber", "consignmentNumber", "awb"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
): Promise<Response> {
  const { provider } = await params;
  const raw = await request.text();

  if (!isProvider(provider) || !getCourier(provider)) {
    return NextResponse.json({ error: "Unknown courier." }, { status: 404 });
  }

  const creds = await resolveCredentials(provider);
  const secret = creds.values.webhookSecret;
  if (!secret) {
    return NextResponse.json({ error: "No webhook secret is configured for this courier." }, { status: 401 });
  }
  if (!verify(raw, request.headers, secret)) {
    await logCall({
      provider,
      direction: "inbound",
      operation: "webhook:rejected",
      method: "POST",
      endpoint: `/api/webhooks/courier/${provider}`,
      responseStatus: 401,
      ok: false,
      dryRun: false,
      durationMs: 0,
      error: "Signature or shared secret did not verify.",
    });
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }

  const trackingNumber = trackingFrom(payload);
  if (!trackingNumber) return NextResponse.json({ error: "No tracking number in the payload." }, { status: 400 });

  const shipment = await getShipmentByTracking(trackingNumber);
  if (!shipment) return NextResponse.json({ error: "Unknown tracking number." }, { status: 404 });

  await logCall({
    provider,
    direction: "inbound",
    operation: "webhook",
    method: "POST",
    endpoint: `/api/webhooks/courier/${provider}`,
    requestBody: payload,
    responseStatus: 200,
    ok: true,
    dryRun: false,
    durationMs: 0,
    error: null,
  });

  try {
    // Re-read from the courier rather than trusting the pushed status.
    const outcome = await syncShipment(shipment.id, "webhook");
    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message });
  }
}

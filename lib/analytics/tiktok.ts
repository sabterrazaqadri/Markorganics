import "server-only";
import { callProvider } from "@/lib/integrations/http";
import { resolveCredentials } from "@/lib/integrations/config";
import { hashMatchValue, type UserIdentity } from "./hash";
import { rupees, TIKTOK_EVENT_NAME, type CommerceEventPayload } from "./events";

/**
 * TikTok Events API (Business API v1.3).
 *
 * Same dual client/server pattern as Meta: the browser pixel and this call
 * carry the same `event_id`, and TikTok keeps one.
 *
 * TikTok Shop is deliberately not here. Its Partner API is seller-gated
 * behind an approved Partner Center app, the business region chosen at
 * registration cannot be changed afterwards, and availability for Pakistani
 * sellers is unconfirmed — so this build does pixel, events and feed only.
 * The seam is `sendTiktokEvent`: a Shop integration would sit beside it, not
 * inside it.
 */

const ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

export interface TiktokEventInput extends CommerceEventPayload {
  identity: UserIdentity;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  ttclid?: string | null;
}

export async function sendTiktokEvent(
  input: TiktokEventInput,
): Promise<{ ok: boolean; message: string; dryRun: boolean }> {
  const creds = await resolveCredentials("tiktok");
  if (!creds.isEnabled) return { ok: false, dryRun: creds.dryRun, message: "TikTok integration is switched off." };

  const pixelCode = creds.values.pixelCode;
  if (!pixelCode) return { ok: false, dryRun: creds.dryRun, message: "No TikTok pixel code is configured." };

  // TikTok wants the same SHA-256 of the same normalised values Meta does.
  const user: Record<string, string> = {};
  if (input.identity.phone) user.phone = hashMatchValue("ph", input.identity.phone);
  if (input.identity.email) user.email = hashMatchValue("em", input.identity.email);
  if (input.identity.externalId) user.external_id = hashMatchValue("external_id", input.identity.externalId);
  if (input.clientIpAddress) user.ip = input.clientIpAddress;
  if (input.clientUserAgent) user.user_agent = input.clientUserAgent;
  if (input.ttclid) user.ttclid = input.ttclid;

  const body = {
    event_source: "web",
    event_source_id: pixelCode,
    ...(creds.values.testEventCode ? { test_event_code: creds.values.testEventCode } : {}),
    data: [
      {
        event: TIKTOK_EVENT_NAME[input.event],
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        user,
        page: input.sourceUrl ? { url: input.sourceUrl } : undefined,
        properties: {
          currency: input.currency,
          value: rupees(input.valuePaisa),
          ...(input.orderNumber ? { order_id: input.orderNumber } : {}),
          contents: input.items.map((item) => ({
            content_id: item.sku,
            content_name: item.name,
            content_type: "product",
            quantity: item.quantity,
            price: rupees(item.pricePaisa),
          })),
        },
      },
    ],
  };

  const result = await callProvider<{ code?: number; message?: string }>({
    provider: "tiktok",
    operation: `events:${input.event}`,
    method: "POST",
    url: ENDPOINT,
    headers: { "Access-Token": creds.values.accessToken ?? "" },
    body,
    secrets: [creds.values.accessToken].filter(Boolean),
    dryRun: creds.dryRun,
    dryRunResponse: () => ({ code: 0, message: "OK" }),
    // TikTok answers HTTP 200 with a non-zero `code` on failure.
    failureMessage: (payload) => {
      const res = payload as { code?: number; message?: string } | null;
      if (!res) return "TikTok returned an empty response.";
      return res.code && res.code !== 0 ? `TikTok rejected the event: ${res.message ?? res.code}` : null;
    },
  });

  return result.ok
    ? { ok: true, dryRun: result.dryRun, message: "TikTok accepted the event." }
    : { ok: false, dryRun: result.dryRun, message: result.error };
}

export async function testConnection(): Promise<{ ok: boolean; message: string; dryRun: boolean }> {
  const creds = await resolveCredentials("tiktok");
  const pixelCode = creds.values.pixelCode;
  if (!pixelCode) return { ok: false, dryRun: creds.dryRun, message: "No TikTok pixel code is configured." };

  const result = await callProvider<{ code?: number; message?: string; data?: unknown }>({
    provider: "tiktok",
    operation: "testConnection",
    url: "https://business-api.tiktok.com/open_api/v1.3/pixel/list/",
    query: { advertiser_id: creds.values.advertiserId ?? "" },
    headers: { "Access-Token": creds.values.accessToken ?? "" },
    secrets: [creds.values.accessToken].filter(Boolean),
    dryRun: creds.dryRun,
    dryRunResponse: () => ({ code: 0, message: "OK", data: { pixels: [{ pixel_code: pixelCode }] } }),
    failureMessage: (payload) => {
      const res = payload as { code?: number; message?: string } | null;
      return res?.code && res.code !== 0 ? `TikTok answered ${res.code}: ${res.message ?? ""}` : null;
    },
  });

  return result.ok
    ? { ok: true, dryRun: result.dryRun, message: `TikTok answered: ${JSON.stringify(result.data).slice(0, 300)}` }
    : { ok: false, dryRun: result.dryRun, message: result.error };
}

import "server-only";
import { callProvider } from "@/lib/integrations/http";
import { resolveCredentials } from "@/lib/integrations/config";
import { buildUserData, type UserIdentity } from "./hash";
import { META_EVENT_NAME, rupees, type CommerceEventPayload } from "./events";

/**
 * Meta Conversions API.
 *
 * Sends the same four events the browser pixel sends, with the same
 * `event_id`, so Events Manager keeps exactly one of each pair. Personal data
 * is hashed in lib/analytics/hash.ts before it gets here — nothing in this
 * file ever sees a raw phone number leave the process unhashed.
 */

const GRAPH = "https://graph.facebook.com";
const DEFAULT_VERSION = "v21.0";

export interface CapiInput extends CommerceEventPayload {
  identity: UserIdentity;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  /** Meta's browser cookies, when the request has them. */
  fbp?: string | null;
  fbc?: string | null;
}

export async function sendMetaEvent(input: CapiInput): Promise<{ ok: boolean; message: string; dryRun: boolean }> {
  const creds = await resolveCredentials("meta");
  if (!creds.isEnabled) return { ok: false, dryRun: creds.dryRun, message: "Meta integration is switched off." };

  const version = creds.values.graphVersion || DEFAULT_VERSION;
  const pixelId = creds.values.pixelId;
  if (!pixelId) return { ok: false, dryRun: creds.dryRun, message: "No Meta pixel id is configured." };

  const userData = buildUserData(input.identity);
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;
  if (input.clientIpAddress) userData.client_ip_address = input.clientIpAddress;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;

  const body = {
    data: [
      {
        event_name: META_EVENT_NAME[input.event],
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.sourceUrl,
        user_data: userData,
        custom_data: {
          currency: input.currency,
          value: rupees(input.valuePaisa),
          order_id: input.orderNumber,
          num_items: input.items.reduce((n, i) => n + i.quantity, 0),
          content_type: "product",
          contents: input.items.map((i) => ({
            id: i.sku,
            quantity: i.quantity,
            item_price: rupees(i.pricePaisa),
          })),
          content_ids: input.items.map((i) => i.sku),
        },
      },
    ],
    ...(creds.values.testEventCode ? { test_event_code: creds.values.testEventCode } : {}),
  };

  const result = await callProvider<{ events_received?: number; messages?: unknown[] }>({
    provider: "meta",
    operation: `capi:${input.event}`,
    method: "POST",
    url: `${GRAPH}/${version}/${pixelId}/events`,
    query: { access_token: creds.values.accessToken },
    body,
    secrets: [creds.values.accessToken].filter(Boolean),
    dryRun: creds.dryRun,
    dryRunResponse: () => ({ events_received: 1, messages: [] }),
  });

  return result.ok
    ? { ok: true, dryRun: result.dryRun, message: `Meta received ${result.data.events_received ?? 1} event(s).` }
    : { ok: false, dryRun: result.dryRun, message: result.error };
}

/** One harmless call: read the pixel's own name. */
export async function testConnection(): Promise<{ ok: boolean; message: string; dryRun: boolean }> {
  const creds = await resolveCredentials("meta");
  const version = creds.values.graphVersion || DEFAULT_VERSION;
  const pixelId = creds.values.pixelId;
  if (!pixelId) return { ok: false, dryRun: creds.dryRun, message: "No Meta pixel id is configured." };

  const result = await callProvider<Record<string, unknown>>({
    provider: "meta",
    operation: "testConnection",
    url: `${GRAPH}/${version}/${pixelId}`,
    query: { fields: "name,id", access_token: creds.values.accessToken },
    secrets: [creds.values.accessToken].filter(Boolean),
    dryRun: creds.dryRun,
    dryRunResponse: () => ({ id: pixelId, name: "MARKORGANICS pixel (dry run)" }),
  });

  return result.ok
    ? { ok: true, dryRun: result.dryRun, message: `Meta answered: ${JSON.stringify(result.data).slice(0, 300)}` }
    : { ok: false, dryRun: result.dryRun, message: result.error };
}

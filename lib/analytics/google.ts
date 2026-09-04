import "server-only";
import { createHash } from "node:crypto";
import { callProvider } from "@/lib/integrations/http";
import { resolveCredentials } from "@/lib/integrations/config";
import { rupees, type CommerceEventPayload } from "./events";

/**
 * GA4 Measurement Protocol.
 *
 * Parameter names here are GA4's exact ecommerce names — `items`, `item_id`,
 * `item_name`, `value`, `currency`, `transaction_id`. GA4 silently ignores
 * anything it does not recognise, so a near-miss looks like it worked and
 * reports nothing.
 *
 * Deduplication against the browser tag is by `transaction_id`: GA4 drops a
 * second purchase with a transaction id it has already seen.
 */

const ENDPOINT = "https://www.google-analytics.com/mp/collect";

export interface MeasurementInput extends CommerceEventPayload {
  /** GA4's own client id when the browser supplied one, else a stable stand-in. */
  clientId?: string | null;
  userId?: string | null;
}

/**
 * GA4 requires a client_id. When the event is fired from the server after the
 * browser has gone, there is none, so a deterministic stand-in derived from
 * the order keeps the session attributable rather than random.
 */
export function fallbackClientId(seed: string): string {
  const digest = createHash("sha256").update(seed).digest("hex");
  return `${parseInt(digest.slice(0, 8), 16)}.${parseInt(digest.slice(8, 16), 16)}`;
}

export async function sendGa4Event(input: MeasurementInput): Promise<{ ok: boolean; message: string; dryRun: boolean }> {
  const creds = await resolveCredentials("google");
  if (!creds.isEnabled) return { ok: false, dryRun: creds.dryRun, message: "Google integration is switched off." };

  const measurementId = creds.values.measurementId;
  if (!measurementId) return { ok: false, dryRun: creds.dryRun, message: "No GA4 measurement id is configured." };

  const body = {
    client_id: input.clientId || fallbackClientId(input.eventId),
    ...(input.userId ? { user_id: input.userId } : {}),
    non_personalized_ads: false,
    events: [
      {
        name: input.event,
        params: {
          currency: input.currency,
          value: rupees(input.valuePaisa),
          ...(input.event === "purchase" && input.orderNumber ? { transaction_id: input.orderNumber } : {}),
          engagement_time_msec: 1,
          items: input.items.map((item, index) => ({
            item_id: item.sku,
            item_name: item.name,
            index,
            price: rupees(item.pricePaisa),
            quantity: item.quantity,
          })),
        },
      },
    ],
  };

  const result = await callProvider<Record<string, unknown>>({
    provider: "google",
    operation: `mp:${input.event}`,
    method: "POST",
    url: ENDPOINT,
    query: { measurement_id: measurementId, api_secret: creds.values.apiSecret },
    body,
    secrets: [creds.values.apiSecret].filter(Boolean),
    dryRun: creds.dryRun,
    // The real endpoint answers 204 with an empty body.
    dryRunResponse: () => ({ accepted: true }),
  });

  return result.ok
    ? { ok: true, dryRun: result.dryRun, message: "GA4 accepted the event." }
    : { ok: false, dryRun: result.dryRun, message: result.error };
}

/**
 * The debug endpoint validates without recording, which is exactly what a
 * "Test connection" button should do.
 */
export async function testConnection(): Promise<{ ok: boolean; message: string; dryRun: boolean }> {
  const creds = await resolveCredentials("google");
  const measurementId = creds.values.measurementId;
  if (!measurementId) return { ok: false, dryRun: creds.dryRun, message: "No GA4 measurement id is configured." };

  const result = await callProvider<{ validationMessages?: Array<{ description?: string }> }>({
    provider: "google",
    operation: "testConnection",
    method: "POST",
    url: "https://www.google-analytics.com/debug/mp/collect",
    query: { measurement_id: measurementId, api_secret: creds.values.apiSecret },
    body: {
      client_id: fallbackClientId("mark-test"),
      events: [{ name: "view_item", params: { currency: "PKR", value: 1, engagement_time_msec: 1 } }],
    },
    secrets: [creds.values.apiSecret].filter(Boolean),
    dryRun: creds.dryRun,
    dryRunResponse: () => ({ validationMessages: [] }),
  });

  if (!result.ok) return { ok: false, dryRun: result.dryRun, message: result.error };

  const problems = result.data.validationMessages ?? [];
  return problems.length === 0
    ? { ok: true, dryRun: result.dryRun, message: "GA4 validated the payload with no complaints." }
    : { ok: false, dryRun: result.dryRun, message: problems.map((p) => p.description ?? "").join(" · ") };
}

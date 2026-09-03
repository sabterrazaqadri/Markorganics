import "server-only";
import { callProvider } from "@/lib/integrations/http";
import { resolveCredentials } from "@/lib/integrations/config";
import { mapPostExStatus, type ShipmentStatus } from "./status";
import type {
  City,
  CourierAdapter,
  CourierCall,
  CreatedShipment,
  PickupAddress,
  ShipmentInput,
  TrackingEvent,
  TrackingResult,
} from "./types";

/**
 * PostEx Merchant API v4.1.9.
 *
 * Endpoints used (all under the merchant integration base, token in a `token`
 * header, JSON in and out):
 *
 *   GET  /services/integration/api/order/v2/get-operational-city
 *   GET  /services/integration/api/order/v1/get-merchant-address
 *   GET  /services/integration/api/order/v1/get-order-type
 *   POST /services/integration/api/order/v3/create-order
 *   GET  /services/integration/api/order/v1/track-order/{trackingNumber}
 *   PUT  /services/integration/api/order/v1/cancel-order
 *
 * Every response is wrapped as { statusCode, statusMessage, dist }, and a 200
 * with a non-"200" statusCode is a failure — which is why `failureMessage`
 * below inspects the body rather than trusting the HTTP status.
 */

const DEFAULT_BASE = "https://api.postex.pk";
const PATH = {
  cities: "/services/integration/api/order/v2/get-operational-city",
  pickup: "/services/integration/api/order/v1/get-merchant-address",
  orderTypes: "/services/integration/api/order/v1/get-order-type",
  create: "/services/integration/api/order/v3/create-order",
  track: "/services/integration/api/order/v1/track-order",
  cancel: "/services/integration/api/order/v1/cancel-order",
} as const;

interface PostExEnvelope<T> {
  statusCode?: string;
  statusMessage?: string;
  dist?: T;
}

function envelopeFailure(body: unknown): string | null {
  const env = body as PostExEnvelope<unknown> | null;
  if (!env || typeof env !== "object") return "PostEx returned an unreadable response.";
  if (env.statusCode && env.statusCode !== "200") {
    return `PostEx rejected the request: ${env.statusMessage ?? env.statusCode}`;
  }
  return null;
}

function rupees(paisa: number): number {
  return Math.round(paisa / 100);
}

async function ctx() {
  const creds = await resolveCredentials("postex");
  const base = (creds.values.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
  const token = creds.values.apiToken ?? "";
  return {
    creds,
    base,
    headers: { token, Accept: "application/json" },
    secrets: [token].filter(Boolean),
    dryRun: creds.dryRun,
  };
}

/* ------------------------------------------------------------ dry-run data */

const FAKE_CITIES: City[] = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Hyderabad",
  "Gujranwala",
  "Sialkot",
  "Abbottabad",
].map((name) => ({ id: name, name }));

const FAKE_PICKUPS: PickupAddress[] = [
  { code: "001", label: "MARK warehouse", address: "Plot 12, Korangi Industrial Area", city: "Karachi" },
  { code: "002", label: "MARK Lahore", address: "Shop 4, Ferozepur Road", city: "Lahore" },
];

/** Stable across retries: the same order always gets the same fake CN. */
function fakeTracking(orderNumber: string): string {
  let hash = 0;
  for (const ch of orderNumber) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `DRY${String(hash).padStart(10, "0").slice(0, 10)}`;
}

/* ------------------------------------------------------------ the adapter */

export const PostExAdapter: CourierAdapter = {
  id: "postex",
  name: "PostEx",
  verified: true,

  async getCities(): Promise<CourierCall<City[]>> {
    const c = await ctx();
    const result = await callProvider<PostExEnvelope<Array<Record<string, unknown>>>>({
      provider: "postex",
      operation: "getCities",
      url: `${c.base}${PATH.cities}`,
      headers: c.headers,
      secrets: c.secrets,
      dryRun: c.dryRun,
      failureMessage: envelopeFailure,
      dryRunResponse: () => ({
        statusCode: "200",
        dist: FAKE_CITIES.map((city) => ({ operationalCityName: city.name })),
      }),
    });
    if (!result.ok) return { ok: false, error: result.error, dryRun: result.dryRun };

    const rows = result.data.dist ?? [];
    const cities: City[] = rows
      .map((row) => {
        const name = String(row.operationalCityName ?? row.cityName ?? row.name ?? "").trim();
        // PostEx books against the operational city *name*, so it is the id.
        return { id: name, name };
      })
      .filter((city) => city.name.length > 0);
    return { ok: true, data: cities, dryRun: result.dryRun };
  },

  async getPickupAddresses(): Promise<CourierCall<PickupAddress[]>> {
    const c = await ctx();
    const result = await callProvider<PostExEnvelope<Array<Record<string, unknown>>>>({
      provider: "postex",
      operation: "getPickupAddresses",
      url: `${c.base}${PATH.pickup}`,
      headers: c.headers,
      secrets: c.secrets,
      dryRun: c.dryRun,
      failureMessage: envelopeFailure,
      dryRunResponse: () => ({
        statusCode: "200",
        dist: FAKE_PICKUPS.map((p) => ({
          addressCode: p.code,
          address: p.address,
          cityName: p.city,
          merchantName: p.label,
        })),
      }),
    });
    if (!result.ok) return { ok: false, error: result.error, dryRun: result.dryRun };

    const rows = result.data.dist ?? [];
    const addresses: PickupAddress[] = rows
      .map((row) => ({
        code: String(row.addressCode ?? row.pickupAddressCode ?? "").trim(),
        label: String(row.merchantName ?? row.addressName ?? row.address ?? "Pickup address").trim(),
        address: String(row.address ?? "").trim(),
        city: String(row.cityName ?? "").trim(),
      }))
      .filter((a) => a.code.length > 0);
    return { ok: true, data: addresses, dryRun: result.dryRun };
  },

  async createShipment(input: ShipmentInput): Promise<CourierCall<CreatedShipment>> {
    const c = await ctx();
    if (!input.courierCityId) {
      return {
        ok: false,
        dryRun: c.dryRun,
        permanent: true,
        error: `"${input.city}" is not mapped to a PostEx operational city. Map it under Integrations → City mapping first.`,
      };
    }
    if (!input.pickupAddressCode) {
      return { ok: false, dryRun: c.dryRun, permanent: true, error: "Pick a PostEx pickup address before booking." };
    }

    const body = {
      cityName: input.courierCityId,
      customerName: input.customerName,
      customerPhone: input.phone.replace(/^\+92/, "0"),
      deliveryAddress: input.address,
      invoiceDivision: 0,
      invoicePayment: rupees(input.codAmountPaisa),
      items: Math.max(1, input.itemCount),
      orderDetail: input.description.slice(0, 250),
      orderRefNumber: input.orderNumber,
      orderType: c.creds.values.orderType || "Normal",
      pickupAddressCode: input.pickupAddressCode,
      transactionNotes: input.altPhone ? `Alt: ${input.altPhone}` : "",
    };

    const result = await callProvider<PostExEnvelope<Record<string, unknown>>>({
      provider: "postex",
      operation: "createShipment",
      method: "POST",
      url: `${c.base}${PATH.create}`,
      headers: c.headers,
      body,
      secrets: c.secrets,
      dryRun: c.dryRun,
      failureMessage: envelopeFailure,
      dryRunResponse: () => ({
        statusCode: "200",
        statusMessage: "Order created (dry run)",
        dist: {
          orderRefNumber: input.orderNumber,
          trackingNumber: fakeTracking(input.orderNumber),
          orderStatus: "Unbooked",
        },
      }),
    });
    if (!result.ok) return { ok: false, error: result.error, dryRun: result.dryRun };

    const dist = result.data.dist ?? {};
    const trackingNumber = String(dist.trackingNumber ?? "").trim();
    if (!trackingNumber) {
      return { ok: false, error: "PostEx accepted the order but returned no tracking number.", dryRun: result.dryRun };
    }
    return {
      ok: true,
      dryRun: result.dryRun,
      data: {
        trackingNumber,
        labelUrl: typeof dist.orderLabelUrl === "string" ? dist.orderLabelUrl : undefined,
        raw: dist,
      },
    };
  },

  async cancelShipment(trackingNumber: string): Promise<CourierCall<void>> {
    const c = await ctx();
    const result = await callProvider<PostExEnvelope<unknown>>({
      provider: "postex",
      operation: "cancelShipment",
      method: "PUT",
      url: `${c.base}${PATH.cancel}`,
      headers: c.headers,
      body: { trackingNumber },
      secrets: c.secrets,
      dryRun: c.dryRun,
      failureMessage: envelopeFailure,
      dryRunResponse: () => ({ statusCode: "200", statusMessage: "Order cancelled (dry run)" }),
    });
    if (!result.ok) return { ok: false, error: result.error, dryRun: result.dryRun };
    return { ok: true, data: undefined, dryRun: result.dryRun };
  },

  async track(trackingNumber: string): Promise<CourierCall<TrackingResult>> {
    const c = await ctx();
    const result = await callProvider<PostExEnvelope<Record<string, unknown>>>({
      provider: "postex",
      operation: "track",
      url: `${c.base}${PATH.track}/${encodeURIComponent(trackingNumber)}`,
      headers: c.headers,
      secrets: c.secrets,
      dryRun: c.dryRun,
      failureMessage: envelopeFailure,
      dryRunResponse: () => ({
        statusCode: "200",
        dist: {
          trackingNumber,
          transactionStatus: "Out For Delivery",
          transactionStatusHistory: [
            { transactionStatusMessage: "Booked", updatedAt: isoDaysAgo(2) },
            { transactionStatusMessage: "Picked By PostEx", updatedAt: isoDaysAgo(2) },
            { transactionStatusMessage: "PostEx Warehouse", updatedAt: isoDaysAgo(1) },
            { transactionStatusMessage: "Out For Delivery", updatedAt: isoDaysAgo(0) },
          ],
        },
      }),
    });
    if (!result.ok) return { ok: false, error: result.error, dryRun: result.dryRun };

    const dist = result.data.dist ?? {};
    const history = Array.isArray(dist.transactionStatusHistory)
      ? (dist.transactionStatusHistory as Array<Record<string, unknown>>)
      : [];

    const events: TrackingEvent[] = history
      .map((row) => {
        const rawStatus = String(row.transactionStatusMessage ?? row.transactionStatus ?? "").trim();
        return {
          status: mapPostExStatus(rawStatus),
          rawStatus,
          message: String(row.transactionStatusMessageDetail ?? row.reason ?? "").trim(),
          location: String(row.modifiedBy ?? row.cityName ?? "").trim(),
          occurredAt: parseDate(row.updatedAt ?? row.transactionStatusMessageDate),
          raw: row,
        };
      })
      .filter((e) => e.rawStatus.length > 0)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    const latest = events[events.length - 1];
    const currentRaw = String(dist.transactionStatus ?? latest?.rawStatus ?? "").trim();
    const status: ShipmentStatus = currentRaw ? mapPostExStatus(currentRaw) : (latest?.status ?? "unknown");

    return { ok: true, dryRun: result.dryRun, data: { status, rawStatus: currentRaw, events } };
  },

  async testConnection(): Promise<CourierCall<string>> {
    const c = await ctx();
    const result = await callProvider<PostExEnvelope<unknown>>({
      provider: "postex",
      operation: "testConnection",
      url: `${c.base}${PATH.orderTypes}`,
      headers: c.headers,
      secrets: c.secrets,
      dryRun: c.dryRun,
      failureMessage: envelopeFailure,
      dryRunResponse: () => ({ statusCode: "200", statusMessage: "OK (dry run)", dist: ["Normal", "Reverse"] }),
    });
    if (!result.ok) return { ok: false, error: result.error, dryRun: result.dryRun };
    return {
      ok: true,
      dryRun: result.dryRun,
      data: `PostEx answered: ${result.data.statusMessage ?? "OK"} (${JSON.stringify(result.data.dist ?? null).slice(0, 200)})`,
    };
  },
};

function parseDate(value: unknown): Date {
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * A fixed point in the past, not "now minus n days".
 *
 * A real courier returns the same timestamp for the same scan every time it is
 * asked, and the shipment event table deduplicates on exactly that. A fake
 * that moved every second would look fine while inventing a fresh history on
 * every poll — which is not how the thing it stands in for behaves.
 */
function isoDaysAgo(days: number): string {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  return new Date(midnight.getTime() - days * 24 * 3600_000 + 9 * 3600_000).toISOString();
}

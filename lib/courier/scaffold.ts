import "server-only";
import { logCall } from "@/lib/integrations/http";
import { resolveCredentials } from "@/lib/integrations/config";
import type { ProviderId } from "@/lib/integrations/registry";
import type {
  City,
  CourierAdapter,
  CourierCall,
  CreatedShipment,
  PickupAddress,
  ShipmentInput,
  TrackingResult,
} from "./types";
import { unimplemented } from "./types";

/**
 * An adapter that satisfies the interface without inventing an API.
 *
 * In live mode every operation refuses with the list of things still needed.
 * In dry-run it returns the same fake shapes PostEx returns, so the queue,
 * the order timeline and the tracking page can all be exercised end to end
 * before a single real credential exists. Nothing here calls a network.
 */

export interface ScaffoldSpec {
  id: ProviderId;
  name: string;
  /** Exactly what has to arrive from the courier before this can be finished. */
  todo: string[];
}

function fakeTracking(prefix: string, seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  return `${prefix}${String(hash).padStart(9, "0").slice(0, 9)}`;
}

export function createScaffoldAdapter(spec: ScaffoldSpec): CourierAdapter {
  const prefix = spec.id.slice(0, 3).toUpperCase();

  async function dryRun(): Promise<boolean> {
    const creds = await resolveCredentials(spec.id);
    return creds.dryRun;
  }

  /** Dry-run calls are still logged, so the event log shows what would happen. */
  async function note(operation: string, request: unknown, response: unknown): Promise<void> {
    await logCall({
      provider: spec.id,
      operation: `UNVERIFIED:${operation}`,
      method: "POST",
      endpoint: `(no endpoint — ${spec.name} adapter is unverified)`,
      requestBody: request,
      responseBody: response,
      responseStatus: 200,
      ok: true,
      dryRun: true,
      durationMs: 0,
      error: null,
    });
  }

  return {
    id: spec.id,
    name: spec.name,
    verified: false,

    async getCities(): Promise<CourierCall<City[]>> {
      if (!(await dryRun())) return unimplemented(spec.name, "getCities");
      await note("getCities", null, []);
      return { ok: true, dryRun: true, data: [] };
    },

    async getPickupAddresses(): Promise<CourierCall<PickupAddress[]>> {
      if (!(await dryRun())) return unimplemented(spec.name, "getPickupAddresses");
      await note("getPickupAddresses", null, []);
      return { ok: true, dryRun: true, data: [] };
    },

    async createShipment(input: ShipmentInput): Promise<CourierCall<CreatedShipment>> {
      if (!(await dryRun())) return unimplemented(spec.name, "createShipment");
      const trackingNumber = fakeTracking(prefix, input.orderNumber);
      await note("createShipment", input, { trackingNumber });
      return { ok: true, dryRun: true, data: { trackingNumber, raw: { simulated: true } } };
    },

    async cancelShipment(trackingNumber: string): Promise<CourierCall<void>> {
      if (!(await dryRun())) return unimplemented(spec.name, "cancelShipment");
      await note("cancelShipment", { trackingNumber }, { cancelled: true });
      return { ok: true, dryRun: true, data: undefined };
    },

    async track(trackingNumber: string): Promise<CourierCall<TrackingResult>> {
      if (!(await dryRun())) return unimplemented(spec.name, "track");
      await note("track", { trackingNumber }, { status: "in_transit" });
      return {
        ok: true,
        dryRun: true,
        data: {
          status: "in_transit",
          rawStatus: "Simulated in transit",
          events: [
            {
              status: "booked",
              rawStatus: "Simulated booked",
              message: `${spec.name} adapter is unverified; this event is simulated.`,
              location: "",
              occurredAt: new Date(),
            },
          ],
        },
      };
    },

    async testConnection(): Promise<CourierCall<string>> {
      return {
        ok: false,
        dryRun: false,
        permanent: true,
        error: [
          `${spec.name} is UNVERIFIED — there is no endpoint to test yet.`,
          "Send the integration document and these gaps get filled in:",
          ...spec.todo.map((t) => `  • ${t}`),
        ].join("\n"),
      };
    },
  };
}

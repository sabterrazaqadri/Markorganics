import "server-only";
import type { Job } from "@/lib/db/schema";
import { bookShipment, cancelShipment, inTransitShipments, syncShipment } from "@/lib/courier/shipments";
import { fireAbandonedFollowUp, fireOrderTrigger } from "@/lib/whatsapp/triggers";
import { dispatchPurchase } from "@/lib/analytics/purchase";
import type { WhatsappTrigger } from "@/lib/settings";
import { enqueue } from "./queue";
import { JOB, PermanentJobError } from "./types";

/**
 * What each job type actually does.
 *
 * A handler returns the value stored on the job row, throws Error to retry,
 * or throws PermanentJobError when retrying could not possibly help.
 */
export type JobHandler = (job: Job) => Promise<unknown>;

function payloadOf(job: Job): Record<string, unknown> {
  return (job.payload ?? {}) as Record<string, unknown>;
}

function requireString(job: Job, key: string): string {
  const value = payloadOf(job)[key];
  if (typeof value !== "string" || !value) {
    throw new PermanentJobError(`Job ${job.type} is missing "${key}" in its payload.`);
  }
  return value;
}

export const HANDLERS: Record<string, JobHandler> = {
  [JOB.courierBook]: async (job) => {
    const p = payloadOf(job);
    return bookShipment({
      orderId: requireString(job, "orderId"),
      provider: requireString(job, "provider"),
      pickupAddressCode: typeof p.pickupAddressCode === "string" ? p.pickupAddressCode : undefined,
      userId: typeof p.userId === "string" ? p.userId : null,
    });
  },

  [JOB.courierCancel]: async (job) => {
    const p = payloadOf(job);
    await cancelShipment(requireString(job, "shipmentId"), typeof p.userId === "string" ? p.userId : null);
    return { cancelled: true };
  },

  [JOB.courierSync]: async (job) => syncShipment(requireString(job, "shipmentId"), "poll"),

  /** Fan-out: one job per in-transit shipment, so a slow courier cannot stall the rest. */
  [JOB.courierSyncAll]: async () => {
    const shipments = await inTransitShipments();
    let queued = 0;
    for (const shipment of shipments) {
      const id = await enqueue({
        type: JOB.courierSync,
        payload: { shipmentId: shipment.id },
        // One sync per shipment per half hour, however many times this fans out.
        idempotencyKey: `sync:${shipment.id}:${Math.floor(Date.now() / (30 * 60_000))}`,
      });
      if (id) queued += 1;
    }
    return { inTransit: shipments.length, queued };
  },

  [JOB.whatsappSend]: async (job) => {
    const p = payloadOf(job);
    const trigger = requireString(job, "trigger") as WhatsappTrigger;
    const result = await fireOrderTrigger(trigger, requireString(job, "orderId"), {
      shipmentId: typeof p.shipmentId === "string" ? p.shipmentId : undefined,
    });
    // A skip is a decision, not a failure: do not retry it.
    if (result.outcome === "failed") throw new Error(result.message);
    return result;
  },

  [JOB.whatsappAbandoned]: async (job) => {
    const result = await fireAbandonedFollowUp(requireString(job, "abandonedId"));
    if (result.outcome === "failed") throw new Error(result.message);
    return result;
  },

  [JOB.analyticsPurchase]: async (job) => {
    const result = await dispatchPurchase(requireString(job, "orderId"));
    // Retry only when every platform failed; one bad platform is not worth
    // re-sending to the two that already accepted the event.
    if (!result.meta.ok && !result.google.ok && !result.tiktok.ok) {
      throw new Error(
        `All three platforms refused: meta=${result.meta.message}; ga4=${result.google.message}; tiktok=${result.tiktok.message}`,
      );
    }
    return result;
  },
};

export function handlerFor(type: string): JobHandler | null {
  return HANDLERS[type] ?? null;
}

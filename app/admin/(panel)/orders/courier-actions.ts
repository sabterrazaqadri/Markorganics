"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { revalidateCatalog, revalidateReports } from "@/lib/admin/revalidate";
import { getCourier } from "@/lib/courier";
import { bookShipment, cancelShipment, syncShipment } from "@/lib/courier/shipments";
import { unmappedCities } from "@/lib/courier/cities";
import { enqueue } from "@/lib/jobs/queue";
import { JOB, PermanentJobError } from "@/lib/jobs/types";
import type { PickupAddress } from "@/lib/courier/types";

/**
 * Booking from the admin.
 *
 * A single booking runs inline so the operator sees the tracking number (or
 * the exact refusal) straight away. A bulk booking goes through the queue,
 * because forty synchronous courier calls in one request is how a page times
 * out halfway and nobody knows which orders got booked.
 */

function refresh(orderId?: string) {
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidateReports();
}

export async function bookOrderAction(input: {
  orderId: string;
  provider: string;
  pickupAddressCode?: string;
}): Promise<ActionResult<{ trackingNumber: string; dryRun: boolean }>> {
  return run(async () => {
    const ctx = await requirePermission("orders:write");
    const adapter = getCourier(input.provider);
    if (!adapter) throw new ActionError(`Unknown courier "${input.provider}".`);

    try {
      const result = await bookShipment({
        orderId: input.orderId,
        provider: input.provider,
        pickupAddressCode: input.pickupAddressCode,
        userId: ctx.user.id,
      });

      await audit(ctx, {
        action: "courier.book",
        entityType: "order",
        entityId: input.orderId,
        after: { provider: input.provider, trackingNumber: result.trackingNumber, dryRun: result.dryRun },
      });

      refresh(input.orderId);
      return { trackingNumber: result.trackingNumber, dryRun: result.dryRun };
    } catch (err) {
      // A permanent failure is an operator problem (unmapped city, no pickup
      // address), so surface it as a plain message rather than "try again".
      if (err instanceof PermanentJobError) throw new ActionError(err.message);
      throw err;
    }
  });
}

export async function bulkBookAction(input: {
  ids: string[];
  provider: string;
  pickupAddressCode?: string;
}): Promise<ActionResult<{ queued: number; skipped: number; unmappedCities: string[] }>> {
  return run(async () => {
    const ctx = await requirePermission("orders:write");
    if (!getCourier(input.provider)) throw new ActionError(`Unknown courier "${input.provider}".`);
    if (input.ids.length === 0) throw new ActionError("Select some orders first.");
    if (input.ids.length > 200) throw new ActionError("Book at most 200 orders at a time.");

    let queued = 0;
    for (const orderId of input.ids) {
      const id = await enqueue({
        type: JOB.courierBook,
        payload: {
          orderId,
          provider: input.provider,
          pickupAddressCode: input.pickupAddressCode ?? "",
          userId: ctx.user.id,
        },
        // One booking per order per courier, whatever anyone clicks.
        idempotencyKey: `book:${input.provider}:${orderId}`,
      });
      if (id) queued += 1;
    }

    await audit(ctx, {
      action: "courier.bulk_book",
      entityType: "order",
      entityLabel: `${input.ids.length} orders`,
      after: { provider: input.provider, queued },
    });

    refresh();
    return {
      queued,
      skipped: input.ids.length - queued,
      // Warn now rather than letting each job fail one at a time.
      unmappedCities: await unmappedCities(input.provider),
    };
  });
}

export async function cancelShipmentAction(shipmentId: string, orderId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("orders:write");
    try {
      await cancelShipment(shipmentId, ctx.user.id);
    } catch (err) {
      if (err instanceof PermanentJobError) throw new ActionError(err.message);
      throw err;
    }
    await audit(ctx, { action: "courier.cancel", entityType: "order", entityId: orderId, after: { shipmentId } });
    refresh(orderId);
    return null;
  });
}

export async function syncShipmentAction(shipmentId: string, orderId: string): Promise<ActionResult<{ status: string; changed: boolean }>> {
  return run(async () => {
    await requirePermission("orders:read");
    try {
      const result = await syncShipment(shipmentId, "manual");
      refresh(orderId);
      if (result.changed) revalidateCatalog();
      return result;
    } catch (err) {
      if (err instanceof PermanentJobError) throw new ActionError(err.message);
      throw new ActionError((err as Error).message);
    }
  });
}

/** Fills the pickup-address dropdown on the order page. */
export async function pickupAddressesAction(provider: string): Promise<ActionResult<PickupAddress[]>> {
  return run(async () => {
    await requirePermission("orders:write");
    const adapter = getCourier(provider);
    if (!adapter) throw new ActionError(`Unknown courier "${provider}".`);
    const result = await adapter.getPickupAddresses();
    if (!result.ok) throw new ActionError(result.error);
    return result.data;
  });
}

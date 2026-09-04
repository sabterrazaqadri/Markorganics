import "server-only";
import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orderEvents,
  orderItems,
  orders,
  shipmentEvents,
  shipments,
  type OrderStatus,
  type Shipment,
} from "@/lib/db/schema";
import { adjustStock } from "@/lib/admin/inventory";
import { refreshCustomerStats } from "@/lib/admin/customers";
import { getIntegrationSettings } from "@/lib/settings";
import { enqueue } from "@/lib/jobs/queue";
import { JOB, PermanentJobError } from "@/lib/jobs/types";
import { getCourier } from "./index";
import { resolveCourierCityId } from "./cities";
import { isTerminal, orderStatusFor, SHIPMENT_STATUS_LABEL, type ShipmentStatus } from "./status";
import type { TrackingResult } from "./types";

/**
 * Booking, cancelling and syncing shipments.
 *
 * Every function here is safe to run twice: booking refuses when the order
 * already has a live shipment, and status application is driven by the
 * shipment's own event stream, deduplicated on (shipment, status, timestamp).
 */

export interface BookInput {
  orderId: string;
  provider: string;
  pickupAddressCode?: string;
  userId?: string | null;
}

export interface BookResult {
  shipmentId: string;
  trackingNumber: string;
  dryRun: boolean;
}

export async function activeShipmentFor(orderId: string): Promise<Shipment | undefined> {
  const [row] = await db
    .select()
    .from(shipments)
    .where(and(eq(shipments.orderId, orderId), isNull(shipments.cancelledAt)))
    .orderBy(desc(shipments.bookedAt))
    .limit(1);
  return row;
}

export async function shipmentsForOrder(orderId: string): Promise<Shipment[]> {
  return db.select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(desc(shipments.bookedAt));
}

/**
 * Books one order with one courier.
 *
 * Nothing is written until the courier has answered with a tracking number,
 * so a failed booking leaves no trace beyond the call log and the job's error.
 */
export async function bookShipment(input: BookInput): Promise<BookResult> {
  const adapter = getCourier(input.provider);
  if (!adapter) throw new PermanentJobError(`Unknown courier "${input.provider}".`);

  const existing = await activeShipmentFor(input.orderId);
  if (existing) {
    // Idempotent: a retry after a timeout must not create a second parcel.
    return { shipmentId: existing.id, trackingNumber: existing.trackingNumber, dryRun: false };
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!order) throw new PermanentJobError("Order not found.");
  if (order.deletedAt) throw new PermanentJobError("That order has been deleted.");
  if (order.status === "cancelled" || order.status === "returned") {
    throw new PermanentJobError(`Order ${order.orderNumber} is ${order.status} and cannot be booked.`);
  }

  const items = await db
    .select({ name: orderItems.productName, label: orderItems.variantLabel, qty: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const courierCityId = (await resolveCourierCityId(input.provider, order.city)) ?? "";
  const settings = await getIntegrationSettings();
  const pickupAddressCode = input.pickupAddressCode || (await defaultPickup(input.provider));

  const result = await adapter.createShipment({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    phone: order.phone,
    altPhone: order.altPhone,
    address: order.address,
    city: order.city,
    courierCityId,
    pickupAddressCode,
    codAmountPaisa: order.totalPaisa,
    itemCount: order.itemCount,
    description: items.map((i) => `${i.qty}x ${i.name} ${i.label}`).join(", ").slice(0, 250),
    idempotencyKey: `${input.provider}:${order.id}`,
  });

  if (!result.ok) {
    if (result.permanent) throw new PermanentJobError(result.error);
    throw new Error(result.error);
  }

  const [shipment] = await db
    .insert(shipments)
    .values({
      orderId: order.id,
      provider: input.provider,
      trackingNumber: result.data.trackingNumber,
      status: "booked",
      rawStatus: "Booked",
      labelUrl: result.data.labelUrl ?? null,
      pickupAddressCode,
      courierCityId,
      codAmountPaisa: order.totalPaisa,
      bookedById: input.userId ?? null,
      meta: { raw: result.data.raw ?? null, dryRun: result.dryRun } as never,
    })
    .onConflictDoNothing({ target: [shipments.provider, shipments.trackingNumber] })
    .returning();

  // A conflict means a concurrent run already stored this exact tracking number.
  const row = shipment ?? (await byTracking(input.provider, result.data.trackingNumber));
  if (!row) throw new Error("Shipment was booked but could not be stored. Check the call log.");

  await db
    .insert(shipmentEvents)
    .values({
      shipmentId: row.id,
      status: "booked",
      rawStatus: "Booked",
      message: `Booked with ${adapter.name}${result.dryRun ? " (dry run)" : ""}`,
      source: "manual",
      occurredAt: new Date(),
    })
    .onConflictDoNothing();

  await db.insert(orderEvents).values({
    orderId: order.id,
    type: "note",
    message: `Booked with ${adapter.name}. Tracking ${result.data.trackingNumber}${result.dryRun ? " (dry run)" : ""}.`,
    meta: { provider: input.provider, trackingNumber: result.data.trackingNumber } as never,
    userId: input.userId ?? null,
    userName: input.userId ? null : "Courier",
  });

  if (order.status !== "shipped" && order.status !== "delivered") {
    await applySystemStatus(order.id, "shipped", `Booked with ${adapter.name}`, settings.restockOnReturn);
  }

  await enqueue({
    type: JOB.whatsappSend,
    payload: { trigger: "order_shipped", orderId: order.id, shipmentId: row.id },
    idempotencyKey: `wa:order_shipped:${order.id}`,
  });
  await enqueue({
    type: JOB.courierSync,
    payload: { shipmentId: row.id },
    idempotencyKey: `sync:first:${row.id}`,
    runAfter: new Date(Date.now() + 30 * 60_000),
  });

  return { shipmentId: row.id, trackingNumber: row.trackingNumber, dryRun: result.dryRun };
}

async function byTracking(provider: string, trackingNumber: string): Promise<Shipment | undefined> {
  const [row] = await db
    .select()
    .from(shipments)
    .where(and(eq(shipments.provider, provider), eq(shipments.trackingNumber, trackingNumber)))
    .limit(1);
  return row;
}

export async function getShipmentByTracking(trackingNumber: string): Promise<Shipment | undefined> {
  const [row] = await db
    .select()
    .from(shipments)
    .where(eq(shipments.trackingNumber, trackingNumber.trim()))
    .limit(1);
  return row;
}

async function defaultPickup(provider: string): Promise<string> {
  const { resolveCredentials } = await import("@/lib/integrations/config");
  const creds = await resolveCredentials(provider as never);
  return creds.values.defaultPickupCode ?? "";
}

/* --------------------------------------------------------------- cancel */

export async function cancelShipment(shipmentId: string, userId?: string | null): Promise<void> {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  if (!shipment) throw new PermanentJobError("Shipment not found.");
  if (shipment.cancelledAt) return;

  const adapter = getCourier(shipment.provider);
  if (!adapter) throw new PermanentJobError(`Unknown courier "${shipment.provider}".`);

  const result = await adapter.cancelShipment(shipment.trackingNumber);
  if (!result.ok) {
    if (result.permanent) throw new PermanentJobError(result.error);
    throw new Error(result.error);
  }

  await db
    .update(shipments)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(shipments.id, shipmentId));

  await db
    .insert(shipmentEvents)
    .values({
      shipmentId,
      status: "cancelled",
      rawStatus: "Cancelled",
      message: `Cancelled with ${adapter.name}`,
      source: "manual",
      occurredAt: new Date(),
    })
    .onConflictDoNothing();

  await db.insert(orderEvents).values({
    orderId: shipment.orderId,
    type: "note",
    message: `Shipment ${shipment.trackingNumber} cancelled with ${adapter.name}.`,
    userId: userId ?? null,
    userName: userId ? null : "Courier",
  });
}

/* ----------------------------------------------------------------- sync */

/** Shipments still worth polling: not terminal, not cancelled. */
export async function inTransitShipments(limit = 200): Promise<Shipment[]> {
  return db
    .select()
    .from(shipments)
    .where(
      and(
        isNull(shipments.cancelledAt),
        sql`${shipments.status} NOT IN ('delivered', 'returned', 'cancelled', 'expired')`,
      ),
    )
    .orderBy(asc(sql`coalesce(${shipments.lastSyncAt}, ${shipments.bookedAt})`))
    .limit(limit);
}

export async function syncShipment(shipmentId: string, source: "poll" | "webhook" | "manual" = "poll"): Promise<{
  status: ShipmentStatus;
  changed: boolean;
}> {
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, shipmentId)).limit(1);
  if (!shipment) throw new PermanentJobError("Shipment not found.");

  const adapter = getCourier(shipment.provider);
  if (!adapter) throw new PermanentJobError(`Unknown courier "${shipment.provider}".`);

  const result = await adapter.track(shipment.trackingNumber);
  if (!result.ok) {
    await db
      .update(shipments)
      .set({ lastSyncAt: new Date(), lastError: result.error.slice(0, 1000), updatedAt: new Date() })
      .where(eq(shipments.id, shipmentId));
    if (result.permanent) throw new PermanentJobError(result.error);
    throw new Error(result.error);
  }

  return applyTrackingResult(shipment, result.data, source);
}

/**
 * Folds a tracking response into the shipment.
 *
 * Shared by the poller and the webhook, so a courier that offers both can
 * never produce two different histories for the same parcel.
 */
function toMinute(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000);
}

export async function applyTrackingResult(
  shipment: Shipment,
  tracking: TrackingResult,
  source: "poll" | "webhook" | "manual",
): Promise<{ status: ShipmentStatus; changed: boolean }> {
  for (const event of tracking.events) {
    await db
      .insert(shipmentEvents)
      .values({
        shipmentId: shipment.id,
        status: event.status,
        rawStatus: event.rawStatus,
        message: event.message,
        location: event.location,
        source,
        // Truncated to the minute so the (shipment, status, time) unique index
        // still catches a courier that reports the same scan with a slightly
        // different second on each poll. Parcel scans are not meaningful below
        // the minute, and a duplicated history is worse than a rounded one.
        occurredAt: toMinute(event.occurredAt),
        raw: (event.raw ?? null) as never,
      })
      .onConflictDoNothing();
  }

  const status = tracking.status;
  const changed = status !== shipment.status;
  const now = new Date();

  await db
    .update(shipments)
    .set({
      status,
      rawStatus: tracking.rawStatus || shipment.rawStatus,
      lastSyncAt: now,
      lastError: null,
      deliveredAt: status === "delivered" ? (shipment.deliveredAt ?? now) : shipment.deliveredAt,
      returnedAt: status === "returned" ? (shipment.returnedAt ?? now) : shipment.returnedAt,
      updatedAt: now,
    })
    .where(eq(shipments.id, shipment.id));

  if (!changed) return { status, changed: false };

  const settings = await getIntegrationSettings();
  const nextOrderStatus = orderStatusFor(status);
  if (nextOrderStatus) {
    await applySystemStatus(
      shipment.orderId,
      nextOrderStatus,
      `${SHIPMENT_STATUS_LABEL[status]} — ${shipment.provider} ${shipment.trackingNumber}`,
      settings.restockOnReturn,
    );
  } else {
    await db.insert(orderEvents).values({
      orderId: shipment.orderId,
      type: "note",
      message: `Courier update: ${SHIPMENT_STATUS_LABEL[status]} (${tracking.rawStatus || status}).`,
      userName: "Courier",
    });
  }

  // The customer-facing notifications the shop actually promised.
  if (status === "out_for_delivery") {
    await enqueue({
      type: JOB.whatsappSend,
      payload: { trigger: "out_for_delivery", orderId: shipment.orderId, shipmentId: shipment.id },
      idempotencyKey: `wa:out_for_delivery:${shipment.orderId}`,
    });
  }
  if (status === "delivered") {
    await enqueue({
      type: JOB.whatsappSend,
      payload: { trigger: "order_delivered", orderId: shipment.orderId, shipmentId: shipment.id },
      idempotencyKey: `wa:order_delivered:${shipment.orderId}`,
    });
  }

  // Keep polling while there is still something to learn.
  if (!isTerminal(status)) {
    await enqueue({
      type: JOB.courierSync,
      payload: { shipmentId: shipment.id },
      idempotencyKey: `sync:${shipment.id}:${Math.floor(Date.now() / (30 * 60_000))}`,
      runAfter: new Date(Date.now() + 30 * 60_000),
    });
  }

  return { status, changed: true };
}

/**
 * A status change made by the system rather than a person.
 *
 * Mirrors changeOrderStatus's stock semantics, but restocking on a return is
 * behind the settings toggle: some shops want the parcel inspected first.
 */
export async function applySystemStatus(
  orderId: string,
  to: OrderStatus,
  reason: string,
  restockOnClose: boolean,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: orders.status, customerId: orders.customerId, orderNumber: orders.orderNumber })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");
    if (!current || current.status === to) return false;

    const closing = ["cancelled", "returned"].includes(to);
    const wasClosed = ["cancelled", "returned"].includes(current.status);

    if (closing && !wasClosed && restockOnClose) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      for (const item of items) {
        if (!item.variantId) continue;
        await adjustStock(tx, {
          variantId: item.variantId,
          delta: item.quantity,
          reason: "restock",
          note: `Order ${current.orderNumber} ${to} by courier`,
          orderId,
        });
      }
    }

    await tx
      .update(orders)
      .set({
        status: to,
        ...(to === "returned" ? { returnReason: reason.slice(0, 500) } : {}),
        ...(to === "cancelled" ? { cancelReason: reason.slice(0, 500) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    await tx.insert(orderEvents).values({
      orderId,
      type: "status",
      fromStatus: current.status,
      toStatus: to,
      message: reason,
      userName: "Courier",
    });

    // Recomputes returned/delivered counts, which is what the risk score reads.
    if (current.customerId) await refreshCustomerStats(tx, current.customerId);
    return true;
  });
}

/* -------------------------------------------------------------- reading */

export interface ShipmentWithOrder extends Shipment {
  orderNumber: string;
  customerName: string;
  city: string;
  orderTotalPaisa: number;
}

export async function listShipments(filter: {
  provider?: string;
  status?: string;
  limit?: number;
}): Promise<ShipmentWithOrder[]> {
  const conds = [];
  if (filter.provider) conds.push(eq(shipments.provider, filter.provider));
  if (filter.status) conds.push(eq(shipments.status, filter.status));

  const rows = await db
    .select({
      shipment: shipments,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      city: orders.city,
      orderTotalPaisa: orders.totalPaisa,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(shipments.bookedAt))
    .limit(filter.limit ?? 200);

  return rows.map((r) => ({ ...r.shipment, orderNumber: r.orderNumber, customerName: r.customerName, city: r.city, orderTotalPaisa: r.orderTotalPaisa }));
}

export async function shipmentTimeline(shipmentId: string) {
  return db
    .select()
    .from(shipmentEvents)
    .where(eq(shipmentEvents.shipmentId, shipmentId))
    .orderBy(asc(shipmentEvents.occurredAt));
}

/** Bookings for one day, for the loadsheet. */
export async function bookingsOn(provider: string, day: Date): Promise<ShipmentWithOrder[]> {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 3600_000);

  const rows = await db
    .select({
      shipment: shipments,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      city: orders.city,
      orderTotalPaisa: orders.totalPaisa,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(
      and(
        eq(shipments.provider, provider),
        isNull(shipments.cancelledAt),
        sql`${shipments.bookedAt} >= ${start.toISOString()}`,
        sql`${shipments.bookedAt} < ${end.toISOString()}`,
      ),
    )
    .orderBy(asc(shipments.bookedAt));

  return rows.map((r) => ({ ...r.shipment, orderNumber: r.orderNumber, customerName: r.customerName, city: r.city, orderTotalPaisa: r.orderTotalPaisa }));
}

/* --------------------------------------------------- COD reconciliation */

export interface CodOutstanding extends ShipmentWithOrder {
  daysSinceDelivery: number;
  shortfallPaisa: number;
}

/**
 * Delivered, but the courier has not paid (or has underpaid).
 *
 * This is where COD money goes missing, so the query is deliberately blunt:
 * anything delivered more than N days ago with less than the full amount
 * remitted appears here until someone explains it.
 */
export async function outstandingCod(provider: string | undefined, olderThanDays: number): Promise<CodOutstanding[]> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 3600_000);
  const conds = [
    eq(shipments.status, "delivered"),
    lt(shipments.deliveredAt, cutoff),
    sql`${shipments.remittedPaisa} < ${shipments.codAmountPaisa}`,
  ];
  if (provider) conds.push(eq(shipments.provider, provider));

  const rows = await db
    .select({
      shipment: shipments,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      city: orders.city,
      orderTotalPaisa: orders.totalPaisa,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(and(...conds))
    .orderBy(asc(shipments.deliveredAt))
    .limit(500);

  return rows.map((r) => ({
    ...r.shipment,
    orderNumber: r.orderNumber,
    customerName: r.customerName,
    city: r.city,
    orderTotalPaisa: r.orderTotalPaisa,
    daysSinceDelivery: r.shipment.deliveredAt
      ? Math.floor((Date.now() - r.shipment.deliveredAt.getTime()) / (24 * 3600_000))
      : 0,
    shortfallPaisa: Math.max(0, r.shipment.codAmountPaisa - r.shipment.remittedPaisa),
  }));
}

export async function findShipmentsByTracking(trackingNumbers: string[]): Promise<Shipment[]> {
  const clean = trackingNumbers.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  return db.select().from(shipments).where(inArray(shipments.trackingNumber, clean));
}

export { or };

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders } from "@/lib/db/schema";
import { SITE_URL } from "@/config/commerce";
import type { CommerceEventPayload } from "./events";
import { eventIdFor } from "./event-id";
import { sendMetaEvent } from "./meta";
import { sendGa4Event } from "./google";
import { sendTiktokEvent } from "./tiktok";

/**
 * The server-side purchase event, fired from the job runner after the order
 * has committed.
 *
 * The browser fires its own Purchase with the identical `event_id`, so
 * whichever arrives first wins and the other is dropped. Firing from here as
 * well is the point: a customer who closes the tab on the thank-you page
 * still counts, and ad platforms optimise on events they actually receive.
 *
 * This is transactional data about the customer's own purchase, so it goes
 * out regardless of the cookie banner — the banner gates browser tracking,
 * not the shop's record of its own sale.
 */

export interface PurchaseDispatchResult {
  meta: { ok: boolean; message: string };
  google: { ok: boolean; message: string };
  tiktok: { ok: boolean; message: string };
}

export async function buildPurchasePayload(orderId: string): Promise<{
  payload: CommerceEventPayload;
  identity: { phone: string; fullName: string; city: string; externalId: string };
} | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  return {
    payload: {
      event: "purchase",
      eventId: eventIdFor("purchase", order.id),
      valuePaisa: order.totalPaisa,
      currency: "PKR",
      orderNumber: order.orderNumber,
      sourceUrl: `${SITE_URL}/order/${order.orderNumber}`,
      items: items.map((i) => ({
        sku: i.sku,
        name: `${i.productName} ${i.variantLabel}`.trim(),
        quantity: i.quantity,
        pricePaisa: i.unitPricePaisa,
      })),
    },
    identity: {
      phone: order.phone,
      fullName: order.customerName,
      city: order.city,
      externalId: order.customerId ?? order.phone,
    },
  };
}

export async function dispatchPurchase(orderId: string): Promise<PurchaseDispatchResult> {
  const built = await buildPurchasePayload(orderId);
  if (!built) {
    const missing = { ok: false, message: "Order not found." };
    return { meta: missing, google: missing, tiktok: missing };
  }

  const { payload, identity } = built;

  // Independent: one platform being down must not stop the other two.
  const [meta, google, tiktok] = await Promise.all([
    sendMetaEvent({ ...payload, identity }).catch((err: Error) => ({ ok: false, message: err.message, dryRun: false })),
    sendGa4Event({ ...payload, clientId: null, userId: identity.externalId }).catch((err: Error) => ({
      ok: false,
      message: err.message,
      dryRun: false,
    })),
    sendTiktokEvent({ ...payload, identity }).catch((err: Error) => ({ ok: false, message: err.message, dryRun: false })),
  ]);

  return {
    meta: { ok: meta.ok, message: meta.message },
    google: { ok: google.ok, message: google.message },
    tiktok: { ok: tiktok.ok, message: tiktok.message },
  };
}

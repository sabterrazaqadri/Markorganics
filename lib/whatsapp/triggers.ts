import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { abandonedCheckouts, orders, shipments } from "@/lib/db/schema";
import { SITE_URL } from "@/config/commerce";
import { formatPKR } from "@/lib/money";
import { getIntegrationSettings, type WhatsappTrigger } from "@/lib/settings";
import { courierName } from "@/lib/courier";
import { sendTemplate, templateForTrigger, type SendResult } from "./client";

/**
 * Turns a lifecycle moment into a WhatsApp send.
 *
 * Three gates, in order: the trigger has to be switched on in settings, a
 * template has to be mapped to it, and the template has to be approved. Any
 * of them failing is a "skipped", not an error — a notification that cannot
 * go out is never a reason to fail the job that produced it.
 */

export interface TriggerResult extends SendResult {
  trigger: string;
}

function skipped(trigger: string, message: string): TriggerResult {
  return { trigger, ok: false, outcome: "skipped", message, dryRun: false };
}

export async function fireOrderTrigger(
  trigger: WhatsappTrigger,
  orderId: string,
  extra: { shipmentId?: string } = {},
): Promise<TriggerResult> {
  const settings = await getIntegrationSettings();
  if (!settings.whatsappTriggers[trigger]) {
    return skipped(trigger, `The "${trigger}" trigger is switched off in settings.`);
  }

  const template = await templateForTrigger(trigger);
  if (!template) return skipped(trigger, `No enabled template is mapped to "${trigger}".`);

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return skipped(trigger, "Order not found.");

  const shipment = extra.shipmentId
    ? (await db.select().from(shipments).where(eq(shipments.id, extra.shipmentId)).limit(1))[0]
    : (await db.select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(desc(shipments.bookedAt)).limit(1))[0];

  const values: Record<string, string> = {
    customer_name: order.customerName.split(" ")[0] || order.customerName,
    order_number: order.orderNumber,
    order_total: formatPKR(order.totalPaisa),
    courier_name: shipment ? courierName(shipment.provider) : "our courier",
    tracking_number: shipment?.trackingNumber ?? "",
    // Always MARK's own page: the customer never gets sent to the courier's site.
    tracking_url: shipment ? `${SITE_URL}/track/${shipment.trackingNumber}` : `${SITE_URL}/track`,
    city: order.city,
  };

  const variables = template.variables.map((name) => values[name] ?? "");
  const result = await sendTemplate(order.phone, template.name, variables, {
    orderId: order.id,
    customerId: order.customerId,
    trigger,
  });
  return { ...result, trigger };
}

export interface AbandonedCartLineLike {
  productName?: string;
  variantLabel?: string;
  quantity?: number;
}

/**
 * The follow-up scheduled N hours after a checkout is abandoned.
 *
 * Cancelled two ways: the queued job is deleted when the order actually lands,
 * and this checks the row's status again on the way out in case the customer
 * ordered through a different session.
 */
export async function fireAbandonedFollowUp(abandonedId: string): Promise<TriggerResult> {
  const trigger: WhatsappTrigger = "abandoned_checkout";
  const settings = await getIntegrationSettings();
  if (!settings.whatsappTriggers[trigger]) {
    return skipped(trigger, "The abandoned checkout trigger is switched off in settings.");
  }

  const [row] = await db.select().from(abandonedCheckouts).where(eq(abandonedCheckouts.id, abandonedId)).limit(1);
  if (!row) return skipped(trigger, "Abandoned checkout not found.");
  if (row.status !== "open") return skipped(trigger, `Checkout is ${row.status}; no follow-up sent.`);
  if (!row.phone) return skipped(trigger, "No phone number on the checkout.");

  const template = await templateForTrigger(trigger);
  if (!template) return skipped(trigger, `No enabled template is mapped to "${trigger}".`);

  const cart = Array.isArray(row.cart) ? (row.cart as AbandonedCartLineLike[]) : [];
  const summary =
    cart
      .slice(0, 3)
      .map((line) => `${line.quantity ?? 1}x ${line.productName ?? "item"}`)
      .join(", ") || `${row.itemCount} item${row.itemCount === 1 ? "" : "s"}`;

  const values: Record<string, string> = {
    customer_name: (row.name || "").split(" ")[0] || "there",
    cart_summary: summary,
    cart_total: formatPKR(row.subtotalPaisa),
    checkout_url: `${SITE_URL}/checkout`,
  };

  const variables = template.variables.map((name) => values[name] ?? "");
  const result = await sendTemplate(row.phone, template.name, variables, {
    customerId: row.customerId,
    trigger,
  });
  return { ...result, trigger };
}

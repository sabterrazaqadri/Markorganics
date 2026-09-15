"use server";

import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orderEvents, orderItems, orders, productVariants, products } from "@/lib/db/schema";
import { orderCookieName, verifyOrderToken } from "@/lib/auth";
import { adjustStock } from "@/lib/admin/inventory";
import { refreshCustomerStats } from "@/lib/admin/customers";
import { ANALYTICS_TAG } from "@/lib/admin/analytics";
import { deliveryFeeWith, getDeliverySettings } from "@/lib/settings";
import { MAX_QTY_PER_LINE, POST_PURCHASE_WINDOW_MS } from "@/config/commerce";
import { rateLimit } from "@/lib/rate-limit";

const input = z.object({
  orderNumber: z.string().trim().min(4).max(24),
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(MAX_QTY_PER_LINE).default(1),
});

export type AddToOrderResult = { ok: true; message: string } | { ok: false; message: string };

/**
 * Post-purchase upsell: adds one more item to an order that was just placed.
 *
 * Nothing about this bypasses the order rules. The same browser must hold the
 * signed cookie placeOrder set, the order must still be pending and inside the
 * window, stock is locked and taken through the ledger, and the delivery fee
 * is recomputed so a top-up that crosses the free-delivery line drops the fee
 * rather than keeping it. Prices are read from the catalogue, never sent up.
 */
export async function addToOrderAction(raw: unknown): Promise<AddToOrderResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "That item could not be added." };
  const { orderNumber, variantId, quantity } = parsed.data;

  const jar = await cookies();
  const token = jar.get(orderCookieName(orderNumber))?.value;

  if (!rateLimit(`order-add:${orderNumber}`, 10, 10 * 60 * 1000).ok) {
    return { ok: false, message: "Too many changes. Message us on WhatsApp and we will sort it out." };
  }

  const delivery = await getDeliverySettings();

  try {
    const outcome = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.orderNumber, orderNumber), isNull(orders.deletedAt)))
        .for("update");
      if (!order) throw new Error("Order not found.");
      if (!(await verifyOrderToken(token, order.id))) throw new Error("This order can no longer be changed from here.");
      if (order.status !== "pending") throw new Error("This order has been confirmed. Message us on WhatsApp to add to it.");
      if (Date.now() - order.createdAt.getTime() > POST_PURCHASE_WINDOW_MS) {
        throw new Error("The window to add to this order has closed. Message us on WhatsApp.");
      }

      const [row] = await tx
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          label: productVariants.label,
          pricePaisa: productVariants.pricePaisa,
          stock: productVariants.stock,
          productName: products.name,
          productSlug: products.slug,
          status: products.status,
          isBundle: products.isBundle,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(and(eq(productVariants.id, variantId), isNull(productVariants.deletedAt)))
        .for("update", { of: productVariants });
      if (!row || row.status !== "active" || row.isBundle) throw new Error("That item is not available.");
      if (row.stock < quantity) throw new Error(`Only ${row.stock} of ${row.productName} ${row.label} left.`);

      const existing = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      const same = existing.find((i) => i.variantId === variantId && !i.bundleSku);
      if (same) {
        const q = same.quantity + quantity;
        if (q > MAX_QTY_PER_LINE) throw new Error(`You can order up to ${MAX_QTY_PER_LINE} of one item.`);
        await tx
          .update(orderItems)
          .set({ quantity: q, lineTotalPaisa: same.unitPricePaisa * q })
          .where(eq(orderItems.id, same.id));
      } else {
        await tx.insert(orderItems).values({
          orderId: order.id,
          variantId,
          productSlug: row.productSlug,
          productName: row.productName,
          variantLabel: row.label,
          sku: row.sku,
          unitPricePaisa: row.pricePaisa,
          quantity,
          lineTotalPaisa: row.pricePaisa * quantity,
        });
      }

      await adjustStock(tx, {
        variantId,
        delta: -quantity,
        reason: "order_edit",
        note: `Order ${order.orderNumber}: added by the customer after checkout`,
        orderId: order.id,
      });

      const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      const subtotal = lines.reduce((n, l) => n + l.lineTotalPaisa, 0);
      const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
      /* A discount already granted stays as it was; only delivery is re-judged,
         and only ever downwards: a paid fee can become free, never the reverse. */
      const recomputed = deliveryFeeWith(delivery, subtotal, order.city);
      const deliveryPaisa = Math.min(order.deliveryPaisa, recomputed);
      const totalPaisa = Math.max(0, subtotal - order.discountPaisa + deliveryPaisa);

      await tx
        .update(orders)
        .set({ subtotalPaisa: subtotal, deliveryPaisa, totalPaisa, itemCount, updatedAt: new Date() })
        .where(eq(orders.id, order.id));

      await tx.insert(orderEvents).values({
        orderId: order.id,
        type: "edit",
        message: `Customer added ${quantity} × ${row.productName} ${row.label} after checkout`,
        meta: { variantId, quantity, source: "post_purchase_upsell" },
      });

      if (order.customerId) await refreshCustomerStats(tx, order.customerId);

      return { productName: row.productName, label: row.label, freeDelivery: order.deliveryPaisa > 0 && deliveryPaisa === 0 };
    });

    revalidatePath(`/order/${orderNumber}`);
    revalidatePath("/products/[slug]", "page");
    revalidateTag(ANALYTICS_TAG);

    return {
      ok: true,
      message: outcome.freeDelivery
        ? `${outcome.productName} added, and delivery is now free.`
        : `${outcome.productName} ${outcome.label} added to your parcel.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not add that item." };
  }
}

/** Server-side check the order page uses to decide whether to show the upsell. */
export async function canAddToOrder(orderNumber: string, orderId: string): Promise<boolean> {
  const jar = await cookies();
  return verifyOrderToken(jar.get(orderCookieName(orderNumber))?.value, orderId);
}

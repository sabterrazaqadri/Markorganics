import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import {
  orderEvents,
  orderItems,
  orders,
  productVariants,
  type OrderStatus,
} from "@/lib/db/schema";
import { adjustStock } from "./inventory";
import { refreshCustomerStats, upsertCustomer } from "./customers";
import { ActionError } from "./result";
import type { AdminContext } from "./session";
import { formatPKR } from "@/lib/money";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const CLOSED: OrderStatus[] = ["cancelled", "returned"];

export interface StatusChangeResult {
  from: OrderStatus;
  to: OrderStatus;
  restocked: boolean;
}

/**
 * Moves an order between statuses inside one transaction: stock is restored
 * when it closes and taken again when it reopens, the timeline gets an entry
 * with who did it, and the customer's aggregates are recomputed.
 */
export async function changeOrderStatus(
  ctx: AdminContext,
  id: string,
  to: OrderStatus,
  note?: string,
): Promise<StatusChangeResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: orders.status, customerId: orders.customerId, orderNumber: orders.orderNumber })
      .from(orders)
      .where(eq(orders.id, id))
      .for("update");
    if (!current) throw new ActionError("Order not found.");
    if (current.status === to) throw new ActionError(`This order is already ${to}.`);

    const restocks = CLOSED.includes(to) && !CLOSED.includes(current.status);
    const redecrements = CLOSED.includes(current.status) && !CLOSED.includes(to);

    if (restocks || redecrements) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
      for (const item of items) {
        if (!item.variantId) continue;
        await adjustStock(tx, {
          variantId: item.variantId,
          delta: restocks ? item.quantity : -item.quantity,
          reason: restocks ? "restock" : "sale",
          note: `Order ${current.orderNumber} ${restocks ? "closed" : "reopened"}`,
          userId: ctx.user.id,
          orderId: id,
        });
      }
    }

    await tx
      .update(orders)
      .set({
        status: to,
        lastActorId: ctx.user.id,
        ...(to === "cancelled" && note ? { cancelReason: note } : {}),
        ...(to === "returned" && note ? { returnReason: note } : {}),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    await tx.insert(orderEvents).values({
      orderId: id,
      type: "status",
      fromStatus: current.status,
      toStatus: to,
      note: note || null,
      userId: ctx.user.id,
      userName: ctx.user.name,
    });

    if (current.customerId) await refreshCustomerStats(tx, current.customerId);

    return { from: current.status, to, restocked: restocks };
  });
}

export async function addTimelineNote(ctx: AdminContext, orderId: string, message: string): Promise<void> {
  await db.insert(orderEvents).values({
    orderId,
    type: "note",
    message,
    userId: ctx.user.id,
    userName: ctx.user.name,
  });
  await db.update(orders).set({ lastActorId: ctx.user.id, updatedAt: new Date() }).where(eq(orders.id, orderId));
}

export async function setOrderTags(ctx: AdminContext, orderId: string, tags: string[]): Promise<string[]> {
  const [before] = await db.select({ tags: orders.tags }).from(orders).where(eq(orders.id, orderId));
  if (!before) throw new ActionError("Order not found.");
  await db.update(orders).set({ tags, lastActorId: ctx.user.id, updatedAt: new Date() }).where(eq(orders.id, orderId));
  await db.insert(orderEvents).values({
    orderId,
    type: "tag",
    message: `Tags set to ${tags.length ? tags.join(", ") : "none"}`,
    meta: { before: before.tags, after: tags } as never,
    userId: ctx.user.id,
    userName: ctx.user.name,
  });
  return before.tags;
}

/* ------------------------------------------------------------ order edit */

export interface EditLine {
  id?: string;
  variantId?: string | null;
  productName: string;
  variantLabel: string;
  sku: string;
  productSlug: string;
  unitPricePaisa: number;
  quantity: number;
}

export interface EditResult {
  before: { subtotal: number; discount: number; delivery: number; total: number };
  after: { subtotal: number; discount: number; delivery: number; total: number };
}

/**
 * Rewrites the lines of an unshipped order.
 *
 * Every quantity change moves stock the opposite way, an increase that the
 * shelf cannot cover is rejected before anything is written, and the timeline
 * gets a before/after entry so the change is legible months later.
 */
export async function editOrder(
  ctx: AdminContext,
  input: {
    orderId: string;
    lines: EditLine[];
    deliveryPaisa: number;
    discountPaisa: number;
    discountReason?: string;
    reason?: string;
  },
): Promise<EditResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).for("update");
    if (!order) throw new ActionError("Order not found.");
    if (order.deletedAt) throw new ActionError("This order has been deleted.");
    if (["shipped", "delivered"].includes(order.status)) {
      throw new ActionError("This order has already shipped and can no longer be edited.");
    }

    const existing = await tx.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
    const existingById = new Map(existing.map((i) => [i.id, i]));

    /* Net stock movement per variant: negative takes from the shelf. */
    const delta = new Map<string, number>();
    const bump = (variantId: string | null | undefined, n: number) => {
      if (!variantId || n === 0) return;
      delta.set(variantId, (delta.get(variantId) ?? 0) + n);
    };

    const keptIds = new Set<string>();
    for (const line of input.lines) {
      if (line.id) {
        const prior = existingById.get(line.id);
        if (!prior) throw new ActionError("An order line changed while you were editing. Reload and try again.");
        keptIds.add(line.id);
        bump(prior.variantId, prior.quantity - line.quantity);
      } else {
        bump(line.variantId, -line.quantity);
      }
    }
    for (const prior of existing) {
      if (!keptIds.has(prior.id)) bump(prior.variantId, prior.quantity);
    }

    /* Reject the whole edit if any decrease cannot be covered. */
    const takes = [...delta.entries()].filter(([, n]) => n < 0);
    const costById = new Map<string, number>();
    if (takes.length) {
      const rows = await tx
        .select({
          id: productVariants.id,
          stock: productVariants.stock,
          label: productVariants.label,
          sku: productVariants.sku,
          avgCostPaisa: productVariants.avgCostPaisa,
        })
        .from(productVariants)
        .where(inArray(productVariants.id, takes.map(([id]) => id)))
        .for("update");
      const stockById = new Map(rows.map((r) => [r.id, r]));
      for (const r of rows) costById.set(r.id, r.avgCostPaisa);
      for (const [variantId, n] of takes) {
        const row = stockById.get(variantId);
        if (!row) throw new ActionError("An item on this order no longer exists.");
        if (row.stock < -n) {
          throw new ActionError(`Only ${row.stock} of ${row.sku} (${row.label}) left in stock.`);
        }
      }
    }

    for (const [variantId, n] of delta) {
      await adjustStock(tx, {
        variantId,
        delta: n,
        reason: "order_edit",
        note: `Order ${order.orderNumber} edited`,
        userId: ctx.user.id,
        orderId: order.id,
      });
    }

    /* Rewrite the lines. */
    const removeIds = existing.filter((i) => !keptIds.has(i.id)).map((i) => i.id);
    if (removeIds.length) await tx.delete(orderItems).where(inArray(orderItems.id, removeIds));

    let subtotal = 0;
    let itemCount = 0;
    for (const line of input.lines) {
      const lineTotal = line.unitPricePaisa * line.quantity;
      subtotal += lineTotal;
      itemCount += line.quantity;
      const values = {
        variantId: line.variantId ?? null,
        productSlug: line.productSlug,
        productName: line.productName,
        variantLabel: line.variantLabel,
        sku: line.sku,
        unitPricePaisa: line.unitPricePaisa,
        quantity: line.quantity,
        lineTotalPaisa: lineTotal,
      };
      if (line.id) {
        // Cost is never rewritten on an edit: it stays the price paid for the unit that was actually sold.
        await tx.update(orderItems).set(values).where(eq(orderItems.id, line.id));
      } else {
        const unitCostPaisa = line.variantId ? (costById.get(line.variantId) ?? 0) : 0;
        await tx.insert(orderItems).values({ ...values, unitCostPaisa, orderId: order.id });
      }
    }

    const discount = Math.min(input.discountPaisa, subtotal);
    const total = Math.max(0, subtotal - discount + input.deliveryPaisa);

    const before = {
      subtotal: order.subtotalPaisa,
      discount: order.discountPaisa,
      delivery: order.deliveryPaisa,
      total: order.totalPaisa,
    };
    const after = { subtotal, discount, delivery: input.deliveryPaisa, total };

    await tx
      .update(orders)
      .set({
        subtotalPaisa: subtotal,
        discountPaisa: discount,
        discountCode: discount > 0 ? (input.discountReason || order.discountCode || "Manual discount") : null,
        deliveryPaisa: input.deliveryPaisa,
        totalPaisa: total,
        itemCount,
        lastActorId: ctx.user.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await tx.insert(orderEvents).values({
      orderId: order.id,
      type: "edit",
      message: `Order edited: total ${formatPKR(before.total)} to ${formatPKR(after.total)}${input.reason ? ` — ${input.reason}` : ""}`,
      meta: { before, after, lines: input.lines.length } as never,
      userId: ctx.user.id,
      userName: ctx.user.name,
    });

    if (order.customerId) await refreshCustomerStats(tx, order.customerId);
    return { before, after };
  });
}

/* ---------------------------------------------------------- bulk actions */

export async function bulkChangeStatus(
  ctx: AdminContext,
  ids: string[],
  to: OrderStatus,
  note?: string,
): Promise<{ changed: number; skipped: number }> {
  let changed = 0;
  let skipped = 0;
  for (const id of ids) {
    try {
      await changeOrderStatus(ctx, id, to, note);
      changed += 1;
    } catch {
      skipped += 1;
    }
  }
  return { changed, skipped };
}

export async function bulkTag(
  ctx: AdminContext,
  ids: string[],
  tag: string,
  mode: "add" | "remove",
): Promise<number> {
  const rows = await db
    .select({ id: orders.id, tags: orders.tags })
    .from(orders)
    .where(and(inArray(orders.id, ids), isNull(orders.deletedAt)));

  let changed = 0;
  for (const row of rows) {
    const has = row.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (mode === "add" && has) continue;
    if (mode === "remove" && !has) continue;
    const next = mode === "add" ? [...row.tags, tag] : row.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
    await db.update(orders).set({ tags: next, lastActorId: ctx.user.id, updatedAt: new Date() }).where(eq(orders.id, row.id));
    await db.insert(orderEvents).values({
      orderId: row.id,
      type: "tag",
      message: `${mode === "add" ? "Tagged" : "Untagged"} ${tag}`,
      userId: ctx.user.id,
      userName: ctx.user.name,
    });
    changed += 1;
  }
  return changed;
}

/** Attaches an order to a customer record, creating one if needed. */
export async function attachCustomer(tx: Tx, orderId: string, phone: string, name: string, city: string): Promise<string> {
  const customerId = await upsertCustomer(tx, { phone, name, city });
  await tx.update(orders).set({ customerId, updatedAt: new Date() }).where(eq(orders.id, orderId));
  await refreshCustomerStats(tx, customerId);
  return customerId;
}

export async function softDeleteOrder(ctx: AdminContext, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!order) throw new ActionError("Order not found.");
    if (order.deletedAt) return;
    await tx.update(orders).set({ deletedAt: new Date(), lastActorId: ctx.user.id }).where(eq(orders.id, id));
    await tx.insert(orderEvents).values({
      orderId: id,
      type: "note",
      message: "Order deleted",
      userId: ctx.user.id,
      userName: ctx.user.name,
    });
    if (order.customerId) await refreshCustomerStats(tx, order.customerId);
  });
}

export { sql };

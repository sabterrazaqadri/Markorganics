import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  draftOrderItems,
  draftOrders,
  orderEvents,
  orderItems,
  orders,
  productVariants,
  type DraftOrder,
  type DraftOrderItem,
} from "@/lib/db/schema";
import { generateOrderNumber } from "@/lib/order-number";
import { adjustStock } from "./inventory";
import { refreshCustomerStats, upsertCustomer } from "./customers";
import { ActionError } from "./result";
import type { AdminContext } from "./session";
import type { EditLine } from "./orders";
import { getStoreSettings } from "@/lib/settings";

export type DraftWithItems = DraftOrder & { items: DraftOrderItem[] };

export async function listDrafts(status?: "open" | "completed" | "cancelled") {
  return db.query.draftOrders.findMany({
    where: and(isNull(draftOrders.deletedAt), status ? eq(draftOrders.status, status) : undefined),
    orderBy: [desc(draftOrders.createdAt)],
    limit: 200,
    with: { items: true },
  });
}

export async function getDraft(id: string): Promise<DraftWithItems | undefined> {
  return db.query.draftOrders.findFirst({ where: eq(draftOrders.id, id), with: { items: true } });
}

export interface SaveDraftInput {
  id?: string;
  customerId: string | null;
  customerName: string;
  phone: string;
  altPhone: string | null;
  city: string;
  address: string;
  notes?: string;
  internalNote?: string;
  lines: EditLine[];
  deliveryPaisa: number;
  discountPaisa: number;
  discountReason?: string;
}

/** Drafts never reserve stock — nothing here touches product_variants. */
export async function saveDraft(ctx: AdminContext, input: SaveDraftInput): Promise<string> {
  const subtotal = input.lines.reduce((n, l) => n + l.unitPricePaisa * l.quantity, 0);
  const discount = Math.min(input.discountPaisa, subtotal);
  const total = Math.max(0, subtotal - discount + input.deliveryPaisa);

  return db.transaction(async (tx) => {
    const values = {
      customerId: input.customerId,
      customerName: input.customerName,
      phone: input.phone,
      altPhone: input.altPhone,
      city: input.city,
      address: input.address,
      notes: input.notes ?? null,
      internalNote: input.internalNote ?? null,
      subtotalPaisa: subtotal,
      discountPaisa: discount,
      discountReason: input.discountReason ?? null,
      deliveryPaisa: input.deliveryPaisa,
      totalPaisa: total,
      updatedAt: new Date(),
    };

    let draftId = input.id;
    if (draftId) {
      const [existing] = await tx.select({ status: draftOrders.status }).from(draftOrders).where(eq(draftOrders.id, draftId));
      if (!existing) throw new ActionError("Draft not found.");
      if (existing.status !== "open") throw new ActionError("This draft has already been converted.");
      await tx.update(draftOrders).set(values).where(eq(draftOrders.id, draftId));
      await tx.delete(draftOrderItems).where(eq(draftOrderItems.draftOrderId, draftId));
    } else {
      const [row] = await tx
        .insert(draftOrders)
        .values({ ...values, createdById: ctx.user.id })
        .returning({ id: draftOrders.id });
      draftId = row.id;
    }

    await tx.insert(draftOrderItems).values(
      input.lines.map((l) => ({
        draftOrderId: draftId!,
        variantId: l.variantId ?? null,
        productSlug: l.productSlug,
        productName: l.productName,
        variantLabel: l.variantLabel,
        sku: l.sku,
        unitPricePaisa: l.unitPricePaisa,
        quantity: l.quantity,
        lineTotalPaisa: l.unitPricePaisa * l.quantity,
      })),
    );

    return draftId!;
  });
}

/**
 * Turns a draft into a real order: stock is taken here for the first time,
 * the customer record is created or attached, and the draft is closed.
 */
export async function convertDraft(ctx: AdminContext, draftId: string): Promise<{ orderId: string; orderNumber: string }> {
  const prefix = (await getStoreSettings()).orderNumberPrefix;

  return db.transaction(async (tx) => {
    const [draft] = await tx.select().from(draftOrders).where(eq(draftOrders.id, draftId)).for("update");
    if (!draft) throw new ActionError("Draft not found.");
    if (draft.status !== "open") throw new ActionError("This draft has already been converted.");

    const items = await tx.select().from(draftOrderItems).where(eq(draftOrderItems.draftOrderId, draftId));
    if (items.length === 0) throw new ActionError("Add at least one item before converting.");

    /* Check the shelf before taking anything. */
    const variantIds = items.map((i) => i.variantId).filter((v): v is string => Boolean(v));
    if (variantIds.length) {
      const rows = await tx
        .select({ id: productVariants.id, stock: productVariants.stock, sku: productVariants.sku, label: productVariants.label })
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds))
        .for("update");
      const byId = new Map(rows.map((r) => [r.id, r]));
      const wanted = new Map<string, number>();
      for (const item of items) {
        if (!item.variantId) continue;
        wanted.set(item.variantId, (wanted.get(item.variantId) ?? 0) + item.quantity);
      }
      for (const [variantId, quantity] of wanted) {
        const row = byId.get(variantId);
        if (!row) throw new ActionError("An item on this draft no longer exists.");
        if (row.stock < quantity) throw new ActionError(`Only ${row.stock} of ${row.sku} (${row.label}) left in stock.`);
      }
    }

    const customerId = await upsertCustomer(tx, {
      phone: draft.phone,
      name: draft.customerName,
      city: draft.city,
    });

    let orderNumber = generateOrderNumber(prefix);
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await tx.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
      if (clash.length === 0) break;
      orderNumber = generateOrderNumber(prefix);
    }

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        status: "pending",
        customerId,
        customerName: draft.customerName,
        phone: draft.phone,
        altPhone: draft.altPhone,
        city: draft.city,
        address: draft.address,
        notes: draft.notes,
        internalNote: draft.internalNote,
        subtotalPaisa: draft.subtotalPaisa,
        discountPaisa: draft.discountPaisa,
        discountCode: draft.discountReason,
        deliveryPaisa: draft.deliveryPaisa,
        totalPaisa: draft.totalPaisa,
        itemCount: items.reduce((n, i) => n + i.quantity, 0),
        lastActorId: ctx.user.id,
        draftOrderId: draft.id,
      })
      .returning({ id: orders.id });

    await tx.insert(orderItems).values(
      items.map((i) => ({
        orderId: order.id,
        variantId: i.variantId,
        productSlug: i.productSlug,
        productName: i.productName,
        variantLabel: i.variantLabel,
        sku: i.sku,
        unitPricePaisa: i.unitPricePaisa,
        quantity: i.quantity,
        lineTotalPaisa: i.lineTotalPaisa,
      })),
    );

    for (const item of items) {
      if (!item.variantId) continue;
      await adjustStock(tx, {
        variantId: item.variantId,
        delta: -item.quantity,
        reason: "sale",
        note: `Draft converted to ${orderNumber}`,
        userId: ctx.user.id,
        orderId: order.id,
      });
    }

    await tx.insert(orderEvents).values({
      orderId: order.id,
      type: "created",
      toStatus: "pending",
      message: "Created from a draft order",
      userId: ctx.user.id,
      userName: ctx.user.name,
    });

    await tx
      .update(draftOrders)
      .set({ status: "completed", convertedOrderId: order.id, customerId, updatedAt: new Date() })
      .where(eq(draftOrders.id, draftId));

    await refreshCustomerStats(tx, customerId);
    return { orderId: order.id, orderNumber };
  });
}

export async function deleteDraft(id: string): Promise<void> {
  await db.update(draftOrders).set({ deletedAt: new Date(), status: "cancelled" }).where(eq(draftOrders.id, id));
}

"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, type OrderStatus } from "@/lib/db/schema";
import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { run, type ActionResult, ActionError } from "@/lib/admin/result";
import {
  addTimelineNote,
  bulkChangeStatus,
  bulkTag,
  changeOrderStatus,
  editOrder,
  setOrderTags,
  softDeleteOrder,
} from "@/lib/admin/orders";
import { setInternalNote } from "@/lib/queries/orders";
import { revalidateCatalog, revalidateReports } from "@/lib/admin/revalidate";
import {
  bulkOrderSchema,
  editOrderSchema,
  internalNoteSchema,
  orderTagsSchema,
  savedViewSchema,
  statusChangeSchema,
} from "@/lib/validation/admin";
import { createSavedView, deleteSavedView } from "@/lib/admin/saved-views";

function refreshOrder(id: string) {
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  revalidateReports();
}

export async function changeStatusAction(
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<ActionResult<{ from: OrderStatus; to: OrderStatus; restocked: boolean }>> {
  return run(async () => {
    const ctx = await requirePermission("orders:write");
    const parsed = statusChangeSchema.parse({ status, note });
    const result = await changeOrderStatus(ctx, orderId, parsed.status, parsed.note);

    const [order] = await db.select({ orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, orderId));
    await audit(ctx, {
      action: "order.status",
      entityType: "order",
      entityId: orderId,
      entityLabel: order?.orderNumber ?? orderId,
      before: { status: result.from },
      after: { status: result.to, note: parsed.note ?? null, restocked: result.restocked },
    });

    refreshOrder(orderId);
    if (result.restocked) revalidateCatalog();
    return result;
  });
}

export async function saveInternalNoteAction(orderId: string, note: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("orders:write");
    const parsed = internalNoteSchema.parse({ internalNote: note });
    const [before] = await db
      .select({ internalNote: orders.internalNote, orderNumber: orders.orderNumber })
      .from(orders)
      .where(eq(orders.id, orderId));
    if (!before) throw new ActionError("Order not found.");

    await setInternalNote(orderId, parsed.internalNote);
    await audit(ctx, {
      action: "order.note",
      entityType: "order",
      entityId: orderId,
      entityLabel: before.orderNumber,
      before: { internalNote: before.internalNote },
      after: { internalNote: parsed.internalNote },
    });
    refreshOrder(orderId);
    return null;
  });
}

export async function addTimelineNoteAction(orderId: string, message: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("orders:write");
    const text = message.trim();
    if (!text) throw new ActionError("Write something first.");
    if (text.length > 500) throw new ActionError("Keep timeline notes under 500 characters.");
    await addTimelineNote(ctx, orderId, text);
    await audit(ctx, { action: "order.timeline_note", entityType: "order", entityId: orderId, after: { message: text } });
    refreshOrder(orderId);
    return null;
  });
}

export async function setTagsAction(orderId: string, tagsCsv: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("orders:write");
    const parsed = orderTagsSchema.parse({ orderId, tags: tagsCsv });
    const before = await setOrderTags(ctx, orderId, parsed.tags);
    await audit(ctx, {
      action: "order.tags",
      entityType: "order",
      entityId: orderId,
      before: { tags: before },
      after: { tags: parsed.tags },
    });
    refreshOrder(orderId);
    return null;
  });
}

export interface EditLineInput {
  id?: string;
  variantId?: string | null;
  productName: string;
  variantLabel: string;
  sku: string;
  productSlug: string;
  unitPriceRupees: number | string;
  quantity: number | string;
}

export async function editOrderAction(input: {
  orderId: string;
  lines: EditLineInput[];
  deliveryRupees: number | string;
  discountRupees: number | string;
  discountReason?: string;
  reason?: string;
}): Promise<ActionResult<{ totalPaisa: number }>> {
  return run(async () => {
    const ctx = await requirePermission("orders:edit");
    const parsed = editOrderSchema.parse(input);

    const result = await editOrder(ctx, {
      orderId: parsed.orderId,
      lines: parsed.lines.map((l) => ({
        id: l.id,
        variantId: l.variantId ?? null,
        productName: l.productName,
        variantLabel: l.variantLabel,
        sku: l.sku,
        productSlug: l.productSlug,
        unitPricePaisa: Math.round(l.unitPriceRupees * 100),
        quantity: l.quantity,
      })),
      deliveryPaisa: Math.round(parsed.deliveryRupees * 100),
      discountPaisa: Math.round(parsed.discountRupees * 100),
      discountReason: parsed.discountReason,
      reason: parsed.reason,
    });

    await audit(ctx, {
      action: "order.edit",
      entityType: "order",
      entityId: parsed.orderId,
      before: result.before,
      after: result.after,
    });
    refreshOrder(parsed.orderId);
    revalidateCatalog();
    return { totalPaisa: result.after.total };
  });
}

export async function bulkOrderAction(input: {
  ids: string[];
  action: "status" | "tag" | "untag";
  status?: OrderStatus;
  tag?: string;
  note?: string;
}): Promise<ActionResult<{ changed: number; skipped: number }>> {
  return run(async () => {
    const ctx = await requirePermission("orders:write");
    const parsed = bulkOrderSchema.parse(input);

    let outcome = { changed: 0, skipped: 0 };
    if (parsed.action === "status") {
      if (!parsed.status) throw new ActionError("Pick a status.");
      outcome = await bulkChangeStatus(ctx, parsed.ids, parsed.status, parsed.note);
    } else {
      if (!parsed.tag) throw new ActionError("Enter a tag.");
      const changed = await bulkTag(ctx, parsed.ids, parsed.tag, parsed.action === "tag" ? "add" : "remove");
      outcome = { changed, skipped: parsed.ids.length - changed };
    }

    await audit(ctx, {
      action: `order.bulk_${parsed.action}`,
      entityType: "order",
      entityLabel: `${parsed.ids.length} orders`,
      after: { ...outcome, status: parsed.status ?? null, tag: parsed.tag ?? null },
    });

    revalidatePath("/admin/orders");
    revalidateReports();
    if (parsed.action === "status") revalidateCatalog();
    return outcome;
  });
}

export async function deleteOrderAction(orderId: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("orders:edit");
    const [order] = await db.select({ orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, orderId));
    await softDeleteOrder(ctx, orderId);
    await audit(ctx, {
      action: "order.delete",
      entityType: "order",
      entityId: orderId,
      entityLabel: order?.orderNumber ?? orderId,
      after: { deleted: true },
    });
    revalidatePath("/admin/orders");
    revalidateReports();
    return null;
  });
}

/* ----------------------------------------------------------- saved views */

export async function saveViewAction(input: {
  resource: "orders" | "products" | "customers";
  name: string;
  query: string;
}): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("orders:read");
    const parsed = savedViewSchema.parse(input);
    const view = await createSavedView({ ...parsed, userId: ctx.user.id });
    await audit(ctx, { action: "saved_view.create", entityType: "saved_view", entityId: view.id, entityLabel: view.name });
    revalidatePath(`/admin/${parsed.resource}`);
    return { id: view.id };
  });
}

export async function deleteViewAction(id: string, resource: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("orders:read");
    const removed = await deleteSavedView(id, ctx.user.id);
    if (!removed) throw new ActionError("That view belongs to someone else.");
    await audit(ctx, { action: "saved_view.delete", entityType: "saved_view", entityId: id });
    revalidatePath(`/admin/${resource}`);
    return null;
  });
}

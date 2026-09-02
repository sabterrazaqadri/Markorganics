"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { run, type ActionResult } from "@/lib/admin/result";
import { convertDraft, deleteDraft, getDraft, saveDraft } from "@/lib/admin/drafts";
import { revalidateCatalog, revalidateReports } from "@/lib/admin/revalidate";
import { draftOrderSchema } from "@/lib/validation/admin";
import type { z } from "zod";

type DraftInput = z.input<typeof draftOrderSchema>;

export async function saveDraftAction(input: DraftInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("drafts:write");
    const values = draftOrderSchema.parse(input);

    const id = await saveDraft(ctx, {
      id: values.id,
      customerId: values.customerId,
      customerName: values.customerName,
      phone: values.phone,
      altPhone: values.altPhone,
      city: values.city,
      address: values.address,
      notes: values.notes,
      internalNote: values.internalNote,
      lines: values.lines.map((l) => ({
        id: l.id,
        variantId: l.variantId ?? null,
        productName: l.productName,
        variantLabel: l.variantLabel,
        sku: l.sku,
        productSlug: l.productSlug,
        unitPricePaisa: Math.round(l.unitPriceRupees * 100),
        quantity: l.quantity,
      })),
      deliveryPaisa: Math.round(values.deliveryRupees * 100),
      discountPaisa: Math.round(values.discountRupees * 100),
      discountReason: values.discountReason,
    });

    await audit(ctx, {
      action: values.id ? "draft.update" : "draft.create",
      entityType: "draft_order",
      entityId: id,
      entityLabel: values.customerName,
      after: { phone: values.phone, lines: values.lines.length },
    });

    revalidatePath("/admin/drafts");
    revalidatePath(`/admin/drafts/${id}`);
    return { id };
  });
}

export async function convertDraftAction(id: string): Promise<ActionResult<{ orderId: string; orderNumber: string }>> {
  return run(async () => {
    const ctx = await requirePermission("drafts:write");
    const result = await convertDraft(ctx, id);
    await audit(ctx, {
      action: "draft.convert",
      entityType: "draft_order",
      entityId: id,
      entityLabel: result.orderNumber,
      after: { orderId: result.orderId, orderNumber: result.orderNumber },
    });
    revalidatePath("/admin/drafts");
    revalidatePath("/admin/orders");
    revalidateCatalog();
    revalidateReports();
    return result;
  });
}

export async function deleteDraftAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("drafts:write");
    const draft = await getDraft(id);
    await deleteDraft(id);
    await audit(ctx, {
      action: "draft.delete",
      entityType: "draft_order",
      entityId: id,
      entityLabel: draft?.customerName ?? id,
      after: { deleted: true },
    });
    revalidatePath("/admin/drafts");
    return null;
  });
}

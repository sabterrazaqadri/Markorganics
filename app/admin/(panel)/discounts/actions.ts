"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collections, discounts, discountTargets, products } from "@/lib/db/schema";
import { requirePermission } from "@/lib/admin/session";
import { audit, diff } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { discountSchema } from "@/lib/validation/admin";
import type { z } from "zod";

type DiscountInput = z.input<typeof discountSchema>;

export async function saveDiscountAction(input: DiscountInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("discounts:write");
    const values = discountSchema.parse(input);

    const code = values.method === "code" ? (values.code ?? "").trim().toUpperCase() : null;
    if (code) {
      const clash = await db.query.discounts.findFirst({
        where: and(eq(discounts.code, code), isNull(discounts.deletedAt)),
        columns: { id: true },
      });
      if (clash && clash.id !== values.id) throw new ActionError(`The code "${code}" is already in use.`);
    }

    const row = {
      title: values.title,
      code,
      method: values.method,
      type: values.type,
      // percentage is stored as basis points; fixed amounts as paisa.
      value:
        values.type === "percentage"
          ? Math.round(values.percentage * 100)
          : values.type === "fixed_amount"
            ? Math.round(values.amountRupees * 100)
            : 0,
      appliesTo: values.appliesTo,
      minSubtotalPaisa: values.minSubtotalRupees,
      minQuantity: values.minQuantity,
      firstTimeOnly: values.firstTimeOnly,
      segmentId: values.segmentId,
      usageLimit: values.usageLimit === "" || values.usageLimit === undefined ? null : Number(values.usageLimit),
      oncePerCustomer: values.oncePerCustomer,
      buyQuantity: values.buyQuantity,
      getQuantity: values.getQuantity,
      getDiscountBp: Math.round(values.getDiscountPercent * 100),
      startsAt: new Date(`${values.startsAt}T00:00:00+05:00`),
      endsAt: values.endsAt ? new Date(`${values.endsAt}T23:59:59+05:00`) : null,
      isEnabled: values.isEnabled,
      updatedAt: new Date(),
    };

    const before = values.id
      ? await db.query.discounts.findFirst({ where: eq(discounts.id, values.id) })
      : undefined;

    const id = await db.transaction(async (tx) => {
      let discountId = values.id;
      if (discountId) {
        if (!before) throw new ActionError("Discount not found.");
        await tx.update(discounts).set(row).where(eq(discounts.id, discountId));
      } else {
        const [created] = await tx.insert(discounts).values(row).returning({ id: discounts.id });
        discountId = created.id;
      }

      await tx.delete(discountTargets).where(eq(discountTargets.discountId, discountId));
      const targets: { discountId: string; role: string; productId?: string; collectionId?: string }[] = [];
      if (values.appliesTo === "products") {
        for (const productId of values.targetProductIds) targets.push({ discountId, role: "applies", productId });
      }
      if (values.appliesTo === "collections") {
        for (const collectionId of values.targetCollectionIds) targets.push({ discountId, role: "applies", collectionId });
      }
      if (values.type === "buy_x_get_y") {
        for (const productId of values.buyProductIds) targets.push({ discountId, role: "buy", productId });
        for (const productId of values.getProductIds) targets.push({ discountId, role: "get", productId });
      }
      if (targets.length) await tx.insert(discountTargets).values(targets);

      return discountId;
    });

    const after = await db.query.discounts.findFirst({ where: eq(discounts.id, id!) });
    const d = diff(
      before as unknown as Record<string, unknown> | undefined,
      after as unknown as Record<string, unknown>,
      ["title", "code", "method", "type", "value", "appliesTo", "isEnabled", "usageLimit", "startsAt", "endsAt"],
    );
    await audit(ctx, {
      action: before ? "discount.update" : "discount.create",
      entityType: "discount",
      entityId: id!,
      entityLabel: values.title,
      before: d.before,
      after: d.after,
    });

    revalidatePath("/admin/discounts");
    revalidatePath(`/admin/discounts/${id}`);
    return { id: id! };
  });
}

export async function toggleDiscountAction(id: string, isEnabled: boolean): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("discounts:write");
    const before = await db.query.discounts.findFirst({ where: eq(discounts.id, id) });
    if (!before) throw new ActionError("Discount not found.");
    await db.update(discounts).set({ isEnabled, updatedAt: new Date() }).where(eq(discounts.id, id));
    await audit(ctx, {
      action: "discount.toggle",
      entityType: "discount",
      entityId: id,
      entityLabel: before.title,
      before: { isEnabled: before.isEnabled },
      after: { isEnabled },
    });
    revalidatePath("/admin/discounts");
    return null;
  });
}

export async function deleteDiscountAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("discounts:write");
    const before = await db.query.discounts.findFirst({ where: eq(discounts.id, id) });
    if (!before) throw new ActionError("Discount not found.");
    await db
      .update(discounts)
      .set({ deletedAt: new Date(), isEnabled: false, code: null, updatedAt: new Date() })
      .where(eq(discounts.id, id));
    await audit(ctx, {
      action: "discount.delete",
      entityType: "discount",
      entityId: id,
      entityLabel: before.title,
      after: { deleted: true },
    });
    revalidatePath("/admin/discounts");
    return null;
  });
}

export async function discountOptionsAction(): Promise<{
  products: { id: string; name: string }[];
  collections: { id: string; title: string }[];
  segments: { id: string; name: string }[];
}> {
  await requirePermission("discounts:read");
  const [productRows, collectionRows, segmentRows] = await Promise.all([
    db.select({ id: products.id, name: products.name }).from(products).where(isNull(products.deletedAt)).orderBy(asc(products.name)).limit(500),
    db
      .select({ id: collections.id, title: collections.title })
      .from(collections)
      .where(isNull(collections.deletedAt))
      .orderBy(asc(collections.title))
      .limit(200),
    // Only ids and names, so the discount editor never leaks segment rules.
    db
      .execute<{ id: string; name: string }>(
        sql`SELECT id::text AS id, name FROM customer_segments WHERE deleted_at IS NULL ORDER BY name LIMIT 100`,
      )
      .then((r) => r.rows ?? []),
  ]);
  return { products: productRows, collections: collectionRows, segments: segmentRows };
}

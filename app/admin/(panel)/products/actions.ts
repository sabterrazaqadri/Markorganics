"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, type ProductStatus } from "@/lib/db/schema";
import { requirePermission } from "@/lib/admin/session";
import { audit, diff } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { revalidateCatalog } from "@/lib/admin/revalidate";
import { productInputSchema, type ProductInput } from "@/lib/validation/product";
import { bulkProductEditSchema, inventoryAdjustSchema, lowStockSchema } from "@/lib/validation/admin";
import {
  ConflictError,
  bulkEditProducts,
  bulkEditVariants,
  createProduct,
  setProductStatus,
  softDeleteProduct,
  updateProduct,
} from "@/lib/queries/products-admin";
import { getProductByIdAdmin } from "@/lib/queries/products";
import { setStock } from "@/lib/admin/inventory";
import { applyImport, planImport, type ImportOutcome, type ImportPlan } from "@/lib/admin/product-csv";
import { rupeesToPaisa } from "@/lib/money";

export async function saveProductAction(
  input: ProductInput,
  productId?: string,
): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("products:write");
    const values = productInputSchema.parse(input);

    try {
      if (productId) {
        const before = await getProductByIdAdmin(productId);
        if (!before) throw new ActionError("Product not found.");
        await updateProduct(productId, values, ctx.user.id);
        const after = await getProductByIdAdmin(productId);
        const d = diff(
          before as unknown as Record<string, unknown>,
          after as unknown as Record<string, unknown>,
          ["name", "slug", "status", "family", "productType", "vendor", "tags", "isBestseller", "sortOrder"],
        );
        await audit(ctx, {
          action: "product.update",
          entityType: "product",
          entityId: productId,
          entityLabel: values.name,
          before: d.before,
          after: d.after,
        });
        revalidateCatalog(before.slug);
        if (before.slug !== values.slug) revalidateCatalog(values.slug);
        revalidatePath(`/admin/products/${productId}`);
        revalidatePath("/admin/products");
        return { id: productId };
      }

      const id = await createProduct(values, ctx.user.id);
      await audit(ctx, {
        action: "product.create",
        entityType: "product",
        entityId: id,
        entityLabel: values.name,
        after: { name: values.name, slug: values.slug, status: values.status },
      });
      revalidateCatalog(values.slug);
      revalidatePath("/admin/products");
      return { id };
    } catch (err) {
      if (err instanceof ConflictError) throw new ActionError(err.message);
      throw err;
    }
  });
}

export async function setProductStatusAction(id: string, status: ProductStatus): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("products:write");
    const [before] = await db
      .select({ status: products.status, name: products.name, slug: products.slug })
      .from(products)
      .where(eq(products.id, id));
    if (!before) throw new ActionError("Product not found.");

    await setProductStatus(id, status);
    await audit(ctx, {
      action: "product.status",
      entityType: "product",
      entityId: id,
      entityLabel: before.name,
      before: { status: before.status },
      after: { status },
    });
    revalidateCatalog(before.slug);
    revalidatePath("/admin/products");
    return null;
  });
}

export async function deleteProductAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("products:write");
    const [before] = await db.select({ name: products.name, slug: products.slug }).from(products).where(eq(products.id, id));
    if (!before) throw new ActionError("Product not found.");
    await softDeleteProduct(id);
    await audit(ctx, {
      action: "product.delete",
      entityType: "product",
      entityId: id,
      entityLabel: before.name,
      after: { deleted: true },
    });
    revalidateCatalog(before.slug);
    revalidatePath("/admin/products");
    return null;
  });
}

/* ------------------------------------------------------------- inventory */

export async function adjustStockAction(input: {
  variantId: string;
  stock: number | string;
  reason: string;
  note?: string;
}): Promise<ActionResult<{ from: number; to: number }>> {
  return run(async () => {
    const ctx = await requirePermission("inventory:write");
    const parsed = inventoryAdjustSchema.parse(input);
    const result = await db.transaction((tx) =>
      setStock(tx, {
        variantId: parsed.variantId,
        stock: parsed.stock,
        reason: parsed.reason,
        note: parsed.note,
        userId: ctx.user.id,
      }),
    );
    await audit(ctx, {
      action: "inventory.adjust",
      entityType: "variant",
      entityId: parsed.variantId,
      before: { stock: result.from },
      after: { stock: result.to, reason: parsed.reason, note: parsed.note ?? "" },
    });
    revalidatePath("/admin/inventory");
    revalidatePath(`/admin/inventory/${parsed.variantId}`);
    revalidateCatalog();
    return result;
  });
}

export async function setLowStockAction(variantId: string, threshold: number | string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("inventory:write");
    const parsed = lowStockSchema.parse({ variantId, lowStockThreshold: threshold });
    await bulkEditVariants([{ variantId: parsed.variantId, lowStockThreshold: parsed.lowStockThreshold }], ctx.user.id);
    await audit(ctx, {
      action: "inventory.threshold",
      entityType: "variant",
      entityId: parsed.variantId,
      after: { lowStockThreshold: parsed.lowStockThreshold },
    });
    revalidatePath("/admin/inventory");
    return null;
  });
}

/* ------------------------------------------------------------ bulk edits */

export async function bulkEditAction(input: {
  rows: { variantId: string; priceRupees?: string; compareAtRupees?: string; stock?: string }[];
  productRows: { productId: string; status?: ProductStatus; tags?: string }[];
}): Promise<ActionResult<{ changed: number }>> {
  return run(async () => {
    const ctx = await requirePermission("products:write");
    const parsed = bulkProductEditSchema.parse(input);

    const variantEdits = parsed.rows.map((r) => ({
      variantId: r.variantId,
      pricePaisa: r.priceRupees === undefined ? undefined : rupeesToPaisa(r.priceRupees),
      compareAtPaisa:
        r.compareAtRupees === undefined || r.compareAtRupees === "" ? undefined : rupeesToPaisa(Number(r.compareAtRupees)),
      stock: r.stock === undefined ? undefined : Number(r.stock),
      lowStockThreshold: r.lowStockThreshold,
    }));

    const changedVariants = await bulkEditVariants(variantEdits, ctx.user.id);
    const changedProducts = await bulkEditProducts(parsed.productRows);

    await audit(ctx, {
      action: "product.bulk_edit",
      entityType: "product",
      entityLabel: `${parsed.rows.length} variants, ${parsed.productRows.length} products`,
      after: { changedVariants, changedProducts },
    });

    revalidateCatalog();
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");
    return { changed: changedVariants + changedProducts };
  });
}

/* ------------------------------------------------------------ csv import */

export async function planImportAction(csv: string): Promise<ActionResult<ImportPlan>> {
  return run(async () => {
    await requirePermission("products:write");
    if (csv.length > 4_000_000) throw new ActionError("That file is too large. Split it into smaller batches.");
    return planImport(csv);
  });
}

export async function applyImportAction(csv: string): Promise<ActionResult<ImportOutcome>> {
  return run(async () => {
    const ctx = await requirePermission("products:write");
    if (csv.length > 4_000_000) throw new ActionError("That file is too large. Split it into smaller batches.");

    const plan = await planImport(csv);
    if (!plan.ok) throw new ActionError("The file still has errors, so nothing was imported.");

    const outcome = await applyImport(csv, ctx.user.id);
    await audit(ctx, {
      action: "product.import",
      entityType: "product",
      entityLabel: `${plan.created + plan.updated} rows`,
      after: outcome as unknown as Record<string, unknown>,
    });
    revalidateCatalog();
    revalidatePath("/admin/products");
    return outcome;
  });
}

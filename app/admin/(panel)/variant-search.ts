"use server";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { productVariants, products } from "@/lib/db/schema";
import { requirePermission } from "@/lib/admin/session";
import type { VariantOption } from "@/components/admin/VariantPicker";

/** Powers the line-item picker in order editing and draft orders. */
export async function searchVariants(query: string): Promise<VariantOption[]> {
  await requirePermission("products:read");
  const q = `%${query.trim()}%`;

  return db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      label: productVariants.label,
      sku: productVariants.sku,
      pricePaisa: productVariants.pricePaisa,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        isNull(productVariants.deletedAt),
        isNull(products.deletedAt),
        query.trim()
          ? sql`(${products.name} ILIKE ${q} OR ${productVariants.sku} ILIKE ${q} OR ${productVariants.label} ILIKE ${q})`
          : undefined,
      ),
    )
    .orderBy(asc(products.name), asc(productVariants.sortOrder))
    .limit(25);
}

import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, productVariants, type ProductWithVariants } from "@/lib/db/schema";
import type { Family } from "@/lib/catalog";

const variantsOrdered = {
  variants: { where: isNull(productVariants.deletedAt), orderBy: [asc(productVariants.sortOrder)] },
};

/** Only Active, undeleted products are ever visible on the storefront. */
const live = and(eq(products.status, "active"), isNull(products.deletedAt));

export async function getActiveProducts(): Promise<ProductWithVariants[]> {
  return db.query.products.findMany({
    where: live,
    orderBy: [asc(products.sortOrder), asc(products.name)],
    with: variantsOrdered,
  });
}

export async function getProductsByFamily(family: Family): Promise<ProductWithVariants[]> {
  return db.query.products.findMany({
    where: and(live, eq(products.family, family)),
    orderBy: [asc(products.sortOrder)],
    with: variantsOrdered,
  });
}

export async function getProductBySlug(slug: string): Promise<ProductWithVariants | undefined> {
  return db.query.products.findFirst({
    where: and(eq(products.slug, slug), live),
    with: variantsOrdered,
  });
}

export async function getBestsellers(limit = 4): Promise<ProductWithVariants[]> {
  return db.query.products.findMany({
    where: and(live, eq(products.isBestseller, true)),
    orderBy: [asc(products.sortOrder)],
    with: variantsOrdered,
    limit,
  });
}

/** Admin: everything except soft-deleted rows. */
export async function getAllProductsAdmin(): Promise<ProductWithVariants[]> {
  return db.query.products.findMany({
    where: isNull(products.deletedAt),
    orderBy: [asc(products.status), asc(products.sortOrder), asc(products.name)],
    with: variantsOrdered,
  });
}

export async function getProductByIdAdmin(id: string): Promise<ProductWithVariants | undefined> {
  return db.query.products.findFirst({ where: eq(products.id, id), with: variantsOrdered });
}

/** Helpers that work on already-loaded rows. */
export function lowestPrice(p: ProductWithVariants): number {
  return p.variants.length ? Math.min(...p.variants.map((v) => v.pricePaisa)) : 0;
}

export function totalStock(p: ProductWithVariants): number {
  return p.variants.reduce((n, v) => n + v.stock, 0);
}

export function inStock(p: ProductWithVariants): boolean {
  return p.variants.some((v) => v.stock > 0);
}

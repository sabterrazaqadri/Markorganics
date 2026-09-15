import "server-only";
import { and, asc, desc, eq, inArray, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import {
  bundleComponents,
  collectionProducts,
  metafieldDefinitions,
  metafieldValues,
  productVariants,
  products,
  type Product,
  type ProductI18n,
  type ProductStatus,
  type ProductVariant,
} from "@/lib/db/schema";
import { syncOneBundle } from "@/lib/bundles";
import type { ProductValues } from "@/lib/validation/product";
import type { ProductsFilter } from "@/lib/validation/admin";
import { rupeesToPaisa } from "@/lib/money";
import { reevaluateAllAutomaticCollections } from "@/lib/admin/collections";
import { setStock } from "@/lib/admin/inventory";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export const PRODUCTS_PAGE_SIZE = 50;

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

async function assertUniqueSlugAndSkus(values: ProductValues, productId?: string) {
  const slugClash = await db.query.products.findFirst({
    where: productId
      ? and(eq(products.slug, values.slug), notInArray(products.id, [productId]), isNull(products.deletedAt))
      : and(eq(products.slug, values.slug), isNull(products.deletedAt)),
    columns: { id: true },
  });
  if (slugClash) throw new ConflictError(`Slug "${values.slug}" is already used by another product.`);

  const skus = values.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) throw new ConflictError("Each variant needs a different SKU.");
  const skuRows = await db
    .select({ sku: productVariants.sku, productId: productVariants.productId })
    .from(productVariants)
    .where(inArray(productVariants.sku, skus));
  const foreign = skuRows.find((r) => r.productId !== productId);
  if (foreign) throw new ConflictError(`SKU "${foreign.sku}" is already used by another product.`);
}

function productRow(values: ProductValues) {
  // status is the source of truth; is_archived stays mirrored for older code.
  const status: ProductStatus = values.isArchived ? "archived" : values.status;
  return {
    name: values.name,
    slug: values.slug,
    family: values.family,
    status,
    isArchived: status === "archived",
    productType: values.productType,
    vendor: values.vendor,
    tags: values.tags,
    seoTitle: values.seoTitle,
    seoDescription: values.seoDescription,
    shortDescription: values.shortDescription,
    longDescription: values.longDescription,
    howToUse: values.howToUse,
    ingredients: values.ingredients,
    benefits: values.benefits,
    images: values.images,
    isBestseller: values.isBestseller,
    sortOrder: values.sortOrder,
    faqs: values.faqs,
    i18n: i18nOf(values),
    isBundle: values.isBundle,
    updatedAt: new Date(),
  };
}

/** Only non-empty Urdu fields are stored, so the storefront falls back per field. */
function i18nOf(values: ProductValues): ProductI18n {
  const u = values.urdu;
  const ur: NonNullable<ProductI18n["ur"]> = {};
  if (u.name) ur.name = u.name;
  if (u.shortDescription) ur.shortDescription = u.shortDescription;
  if (u.longDescription) ur.longDescription = u.longDescription;
  if (u.howToUse.length) ur.howToUse = u.howToUse;
  if (u.ingredients) ur.ingredients = u.ingredients;
  if (u.benefits.length) ur.benefits = u.benefits;
  if (u.faqs.length) ur.faqs = u.faqs;
  return Object.keys(ur).length ? { ur } : {};
}

/**
 * Every variant of a bundle ships the same components. Rows are replaced
 * wholesale, then the derived stock is refreshed. A bundle may not contain
 * another bundle or itself.
 */
async function writeBundleComponents(tx: Tx, productId: string, variantIds: string[], values: ProductValues) {
  await tx.delete(bundleComponents).where(inArray(bundleComponents.bundleVariantId, variantIds));
  if (!values.isBundle || values.bundleComponents.length === 0) return;

  const wanted = values.bundleComponents.map((c) => c.variantId);
  const rows = await tx
    .select({ id: productVariants.id, productId: productVariants.productId, isBundle: products.isBundle })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(inArray(productVariants.id, wanted), isNull(productVariants.deletedAt)));
  const ok = new Map(rows.map((r) => [r.id, r]));
  for (const c of values.bundleComponents) {
    const row = ok.get(c.variantId);
    if (!row) throw new ConflictError("One of the kit products no longer exists.");
    if (row.isBundle || row.productId === productId) throw new ConflictError("A kit cannot contain another kit or itself.");
  }
  for (const bundleVariantId of variantIds) {
    await tx.insert(bundleComponents).values(
      values.bundleComponents.map((c, i) => ({ bundleVariantId, componentVariantId: c.variantId, quantity: c.quantity, sortOrder: i })),
    );
    await syncOneBundle(tx, bundleVariantId);
  }
}

async function writeMetafields(tx: Tx, productId: string, values: ProductValues) {
  for (const field of values.metafields) {
    if (field.value.trim() === "") {
      await tx
        .delete(metafieldValues)
        .where(and(eq(metafieldValues.definitionId, field.definitionId), eq(metafieldValues.ownerId, productId)));
      continue;
    }
    await tx
      .insert(metafieldValues)
      .values({
        definitionId: field.definitionId,
        ownerType: "product",
        ownerId: productId,
        value: field.value,
      })
      .onConflictDoUpdate({
        target: [metafieldValues.definitionId, metafieldValues.ownerId],
        set: { value: field.value, updatedAt: new Date() },
      });
  }
}

async function writeManualCollections(tx: Tx, productId: string, collectionIds: string[]) {
  // Only manual memberships are editable here; automatic ones are recomputed.
  const manual = await tx.execute<{ id: string }>(sql`
    SELECT id::text AS id FROM collections WHERE type = 'manual' AND deleted_at IS NULL
  `);
  const manualIds = new Set((manual.rows ?? []).map((r) => r.id));
  const wanted = collectionIds.filter((id) => manualIds.has(id));

  await tx.execute(sql`
    DELETE FROM collection_products cp
    USING collections c
    WHERE cp.collection_id = c.id AND c.type = 'manual' AND cp.product_id = ${productId}
  `);
  if (wanted.length) {
    await tx
      .insert(collectionProducts)
      .values(wanted.map((collectionId, i) => ({ collectionId, productId, position: i })))
      .onConflictDoNothing();
  }
}

export async function createProduct(values: ProductValues, userId?: string): Promise<string> {
  await assertUniqueSlugAndSkus(values);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(products).values(productRow(values)).returning({ id: products.id });
    const inserted = await tx
      .insert(productVariants)
      .values(
        values.variants.map((v, i) => ({
          productId: row.id,
          sku: v.sku,
          label: v.label,
          barcode: v.barcode,
          pricePaisa: rupeesToPaisa(v.priceRupees),
          compareAtPaisa: v.compareAtRupees ? rupeesToPaisa(v.compareAtRupees) : null,
          stock: values.isBundle ? 0 : v.stock,
          lowStockThreshold: v.lowStockThreshold,
          sortOrder: i,
        })),
      )
      .returning({ id: productVariants.id });
    await writeMetafields(tx, row.id, values);
    await writeManualCollections(tx, row.id, values.collectionIds);
    await writeBundleComponents(
      tx,
      row.id,
      inserted.map((v) => v.id),
      values,
    );
    return row.id;
  });
  // Automatic collections re-evaluate on every product save.
  await reevaluateAllAutomaticCollections();
  void userId;
  return id;
}

export async function updateProduct(id: string, values: ProductValues, userId?: string): Promise<void> {
  await assertUniqueSlugAndSkus(values, id);
  await db.transaction(async (tx) => {
    await tx.update(products).set(productRow(values)).where(eq(products.id, id));

    const keepIds: string[] = [];
    for (const [i, v] of values.variants.entries()) {
      const data = {
        sku: v.sku,
        label: v.label,
        barcode: v.barcode,
        pricePaisa: rupeesToPaisa(v.priceRupees),
        compareAtPaisa: v.compareAtRupees ? rupeesToPaisa(v.compareAtRupees) : null,
        lowStockThreshold: v.lowStockThreshold,
        sortOrder: i,
        updatedAt: new Date(),
      };
      if (v.id) {
        await tx.update(productVariants).set(data).where(and(eq(productVariants.id, v.id), eq(productVariants.productId, id)));
        // Stock moves through the ledger so the history stays complete. A
        // bundle's stock is derived from its parts and is never set by hand.
        if (!values.isBundle) {
          await setStock(tx, { variantId: v.id, stock: v.stock, reason: "correction", note: "Edited on the product page", userId });
        }
        keepIds.push(v.id);
      } else {
        const [row] = await tx
          .insert(productVariants)
          .values({ ...data, productId: id, stock: values.isBundle ? 0 : v.stock })
          .returning({ id: productVariants.id });
        keepIds.push(row.id);
      }
    }
    // Variants removed in the editor are soft-deleted; past order lines keep
    // their snapshot and the inventory ledger stays readable.
    await tx
      .update(productVariants)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(productVariants.productId, id), notInArray(productVariants.id, keepIds), isNull(productVariants.deletedAt)));

    await writeMetafields(tx, id, values);
    await writeManualCollections(tx, id, values.collectionIds);
    await writeBundleComponents(tx, id, keepIds, values);
  });
  await reevaluateAllAutomaticCollections();
}

/** Variants a kit can be built from: every live, non-bundle variant. */
export async function listComponentOptions(): Promise<{ variantId: string; label: string; pricePaisa: number }[]> {
  const rows = await db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      variantLabel: productVariants.label,
      pricePaisa: productVariants.pricePaisa,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(isNull(products.deletedAt), isNull(productVariants.deletedAt), eq(products.isBundle, false)))
    .orderBy(asc(products.sortOrder), asc(products.name), asc(productVariants.sortOrder));
  return rows.map((r) => ({ variantId: r.variantId, label: `${r.productName} ${r.variantLabel}`, pricePaisa: r.pricePaisa }));
}

export async function getBundleComponentsForProduct(productId: string): Promise<{ variantId: string; quantity: number }[]> {
  const rows = await db
    .select({ componentVariantId: bundleComponents.componentVariantId, quantity: bundleComponents.quantity })
    .from(bundleComponents)
    .innerJoin(productVariants, eq(productVariants.id, bundleComponents.bundleVariantId))
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(bundleComponents.sortOrder));
  // Every variant carries the same list; return it once.
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.componentVariantId) ? false : (seen.add(r.componentVariantId), true)))
    .map((r) => ({ variantId: r.componentVariantId, quantity: r.quantity }));
}

export async function setProductStatus(id: string, status: ProductStatus): Promise<void> {
  await db
    .update(products)
    .set({ status, isArchived: status === "archived", updatedAt: new Date() })
    .where(eq(products.id, id));
  await reevaluateAllAutomaticCollections();
}

/** Kept for the legacy archive toggle. */
export async function setProductArchived(id: string, archived: boolean): Promise<void> {
  await setProductStatus(id, archived ? "archived" : "active");
}

export async function softDeleteProduct(id: string): Promise<void> {
  await db
    .update(products)
    .set({ deletedAt: new Date(), status: "archived", isArchived: true, updatedAt: new Date() })
    .where(eq(products.id, id));
}

/* --------------------------------------------------------------- listing */

export interface AdminProductRow extends Product {
  variants: ProductVariant[];
  totalStock: number;
  minPricePaisa: number;
}

export function buildProductWhere(filter: ProductsFilter): SQL | undefined {
  const conds: SQL[] = [isNull(products.deletedAt)];
  if (filter.q) {
    const q = `%${filter.q.trim()}%`;
    conds.push(sql`(${products.name} ILIKE ${q} OR ${products.slug} ILIKE ${q} OR EXISTS (
      SELECT 1 FROM product_variants pv WHERE pv.product_id = ${products.id} AND pv.sku ILIKE ${q}
    ))`);
  }
  if (filter.status) conds.push(eq(products.status, filter.status));
  if (filter.family) conds.push(eq(products.family, filter.family));
  if (filter.productType) conds.push(eq(products.productType, filter.productType));
  if (filter.vendor) conds.push(eq(products.vendor, filter.vendor));
  if (filter.tag) conds.push(sql`EXISTS (SELECT 1 FROM unnest(${products.tags}) t WHERE lower(t) = lower(${filter.tag}))`);
  if (filter.collectionId) {
    conds.push(sql`EXISTS (
      SELECT 1 FROM collection_products cp WHERE cp.product_id = ${products.id} AND cp.collection_id = ${filter.collectionId}
    )`);
  }
  if (filter.stock === "low") {
    conds.push(sql`EXISTS (
      SELECT 1 FROM product_variants pv
      WHERE pv.product_id = ${products.id} AND pv.deleted_at IS NULL AND pv.stock <= pv.low_stock_threshold
    )`);
  }
  if (filter.stock === "out") {
    conds.push(sql`NOT EXISTS (
      SELECT 1 FROM product_variants pv WHERE pv.product_id = ${products.id} AND pv.deleted_at IS NULL AND pv.stock > 0
    )`);
  }
  return and(...conds);
}

export async function listProductsAdmin(
  filter: ProductsFilter,
): Promise<{ rows: AdminProductRow[]; nextCursor: string | null }> {
  const conds: SQL[] = [];
  const base = buildProductWhere(filter);
  if (base) conds.push(base);
  if (filter.cursor) {
    const [value, id] = filter.cursor.split("|");
    if (id) {
      if (filter.sort === "created") conds.push(sql`(${products.createdAt}, ${products.id}) < (${new Date(Number(value))}, ${id})`);
      else conds.push(sql`(${products.name}, ${products.id}) > (${value}, ${id})`);
    }
  }

  const orderBy =
    filter.sort === "created" ? [desc(products.createdAt), desc(products.id)] : [asc(products.name), asc(products.id)];

  const rows = await db.query.products.findMany({
    where: and(...conds),
    orderBy,
    limit: PRODUCTS_PAGE_SIZE + 1,
    with: { variants: { where: isNull(productVariants.deletedAt), orderBy: [asc(productVariants.sortOrder)] } },
  });

  const hasMore = rows.length > PRODUCTS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PRODUCTS_PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    rows: page.map((p) => ({
      ...p,
      totalStock: p.variants.reduce((n, v) => n + v.stock, 0),
      minPricePaisa: p.variants.length ? Math.min(...p.variants.map((v) => v.pricePaisa)) : 0,
    })),
    nextCursor:
      hasMore && last ? `${filter.sort === "created" ? last.createdAt.getTime() : last.name}|${last.id}` : null,
  };
}

export async function countProductsAdmin(filter: ProductsFilter): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(products).where(buildProductWhere(filter));
  return row?.n ?? 0;
}

export async function productStatusCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: products.status, n: sql<number>`count(*)::int` })
    .from(products)
    .where(isNull(products.deletedAt))
    .groupBy(products.status);
  const out: Record<string, number> = { active: 0, draft: 0, archived: 0 };
  for (const r of rows) out[r.status] = r.n;
  out.all = rows.reduce((n, r) => n + r.n, 0);
  return out;
}

export async function distinctProductFacets(): Promise<{ types: string[]; vendors: string[]; tags: string[] }> {
  const [types, vendors, tags] = await Promise.all([
    db.execute<{ v: string }>(sql`SELECT DISTINCT product_type AS v FROM products WHERE product_type <> '' AND deleted_at IS NULL ORDER BY 1 LIMIT 100`),
    db.execute<{ v: string }>(sql`SELECT DISTINCT vendor AS v FROM products WHERE vendor <> '' AND deleted_at IS NULL ORDER BY 1 LIMIT 100`),
    db.execute<{ v: string }>(sql`SELECT DISTINCT unnest(tags) AS v FROM products WHERE deleted_at IS NULL ORDER BY 1 LIMIT 200`),
  ]);
  return {
    types: (types.rows ?? []).map((r) => r.v),
    vendors: (vendors.rows ?? []).map((r) => r.v),
    tags: (tags.rows ?? []).map((r) => r.v),
  };
}

/* ------------------------------------------------------------ metafields */

export async function listMetafieldDefinitions() {
  return db
    .select()
    .from(metafieldDefinitions)
    .where(and(eq(metafieldDefinitions.ownerType, "product"), isNull(metafieldDefinitions.deletedAt)))
    .orderBy(asc(metafieldDefinitions.position), asc(metafieldDefinitions.name));
}

export async function getMetafieldValues(productId: string): Promise<Record<string, string>> {
  const rows = await db
    .select({ definitionId: metafieldValues.definitionId, value: metafieldValues.value })
    .from(metafieldValues)
    .where(and(eq(metafieldValues.ownerId, productId), eq(metafieldValues.ownerType, "product")));
  return Object.fromEntries(rows.map((r) => [r.definitionId, r.value]));
}

/* ------------------------------------------------------------ bulk edits */

export interface BulkVariantEdit {
  variantId: string;
  pricePaisa?: number;
  compareAtPaisa?: number | null;
  stock?: number;
  lowStockThreshold?: number;
}

export async function bulkEditVariants(edits: BulkVariantEdit[], userId?: string): Promise<number> {
  if (edits.length === 0) return 0;
  return db.transaction(async (tx) => {
    let changed = 0;
    for (const edit of edits) {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (edit.pricePaisa !== undefined) set.pricePaisa = edit.pricePaisa;
      if (edit.compareAtPaisa !== undefined) set.compareAtPaisa = edit.compareAtPaisa;
      if (edit.lowStockThreshold !== undefined) set.lowStockThreshold = edit.lowStockThreshold;
      if (Object.keys(set).length > 1) {
        await tx.update(productVariants).set(set).where(eq(productVariants.id, edit.variantId));
        changed += 1;
      }
      if (edit.stock !== undefined) {
        const result = await setStock(tx, {
          variantId: edit.variantId,
          stock: edit.stock,
          reason: "correction",
          note: "Bulk edit",
          userId,
        });
        if (result.from !== result.to) changed += 1;
      }
    }
    return changed;
  });
}

export async function bulkEditProducts(
  edits: { productId: string; status?: ProductStatus; tags?: string[] }[],
): Promise<number> {
  if (edits.length === 0) return 0;
  let changed = 0;
  for (const edit of edits) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (edit.status) {
      set.status = edit.status;
      set.isArchived = edit.status === "archived";
    }
    if (edit.tags) set.tags = edit.tags;
    if (Object.keys(set).length === 1) continue;
    await db.update(products).set(set).where(eq(products.id, edit.productId));
    changed += 1;
  }
  await reevaluateAllAutomaticCollections();
  return changed;
}

import "server-only";
import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import {
  inventoryAdjustments,
  productVariants,
  products,
  users,
  type InventoryReason,
} from "@/lib/db/schema";
import { syncBundleStock } from "@/lib/bundles";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export const INVENTORY_PAGE_SIZE = 50;

export { MANUAL_REASONS, REASON_LABEL } from "./inventory-reasons";

export interface AdjustInput {
  variantId: string;
  delta: number;
  reason: InventoryReason;
  note?: string;
  userId?: string | null;
  orderId?: string | null;
  /** Cost paid per unit of a positive ("received") delta. Ignored otherwise. */
  unitCostPaisa?: number | null;
}

/**
 * A positive delta with a unit cost moves the variant's weighted-average
 * cost; anything else (a sale, a correction, damage, theft) leaves the
 * average exactly where it was, because none of those are a purchase.
 */
async function rollCostForward(
  tx: Tx,
  variantId: string,
  priorStock: number,
  priorAvgCostPaisa: number,
  delta: number,
  unitCostPaisa?: number | null,
): Promise<void> {
  if (delta <= 0 || unitCostPaisa == null) return;
  const nextStock = priorStock + delta;
  const nextAvg =
    nextStock > 0 ? Math.round((priorStock * priorAvgCostPaisa + delta * unitCostPaisa) / nextStock) : unitCostPaisa;
  await tx.update(productVariants).set({ avgCostPaisa: nextAvg }).where(eq(productVariants.id, variantId));
}

/**
 * Moves stock by `delta` and writes the audit row in one statement pair.
 * Stock never goes below zero. Returns the resulting stock.
 */
export async function adjustStock(tx: Tx, input: AdjustInput): Promise<number> {
  const [row] = await tx
    .update(productVariants)
    .set({ stock: sql`GREATEST(0, ${productVariants.stock} + ${input.delta})`, updatedAt: new Date() })
    .where(eq(productVariants.id, input.variantId))
    .returning({ stock: productVariants.stock, avgCostPaisa: productVariants.avgCostPaisa });

  if (!row) throw new Error("Variant not found");

  // GREATEST(0, ...) never clamps a positive delta, so the prior stock is exact.
  const priorStock = row.stock - input.delta;
  await rollCostForward(tx, input.variantId, priorStock, row.avgCostPaisa, input.delta, input.unitCostPaisa);

  await tx.insert(inventoryAdjustments).values({
    variantId: input.variantId,
    delta: input.delta,
    resultingStock: row.stock,
    reason: input.reason,
    unitCostPaisa: input.delta > 0 ? (input.unitCostPaisa ?? null) : null,
    note: input.note ?? "",
    userId: input.userId ?? null,
    orderId: input.orderId ?? null,
  });
  // Any bundle that ships this variant can now cover a different number of orders.
  await syncBundleStock(tx, [input.variantId]);
  return row.stock;
}

/** Sets an absolute stock level, recording the implied delta. */
export async function setStock(
  tx: Tx,
  input: {
    variantId: string;
    stock: number;
    reason: InventoryReason;
    note?: string;
    userId?: string | null;
    unitCostPaisa?: number | null;
  },
): Promise<{ from: number; to: number }> {
  const [current] = await tx
    .select({ stock: productVariants.stock, avgCostPaisa: productVariants.avgCostPaisa })
    .from(productVariants)
    .where(eq(productVariants.id, input.variantId))
    .for("update");
  if (!current) throw new Error("Variant not found");

  const to = Math.max(0, Math.round(input.stock));
  if (to === current.stock) return { from: current.stock, to };

  const delta = to - current.stock;
  await tx
    .update(productVariants)
    .set({ stock: to, updatedAt: new Date() })
    .where(eq(productVariants.id, input.variantId));
  await rollCostForward(tx, input.variantId, current.stock, current.avgCostPaisa, delta, input.unitCostPaisa);
  await tx.insert(inventoryAdjustments).values({
    variantId: input.variantId,
    delta,
    resultingStock: to,
    reason: input.reason,
    unitCostPaisa: delta > 0 ? (input.unitCostPaisa ?? null) : null,
    note: input.note ?? "",
    userId: input.userId ?? null,
  });
  await syncBundleStock(tx, [input.variantId]);
  return { from: current.stock, to };
}

/* ---------------------------------------------------------------- listing */

export interface InventoryFilter {
  q?: string;
  view?: "all" | "low" | "out";
  productId?: string;
  cursor?: string;
}

export interface InventoryRow {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  family: string;
  sku: string;
  label: string;
  stock: number;
  committed: number;
  onHand: number;
  lowStockThreshold: number;
  pricePaisa: number;
}

/**
 * Stock is decremented at checkout, so `stock` is what is free to sell.
 * `committed` is what is sitting in unfulfilled orders, and on hand is the sum.
 */
const COMMITTED = sql<number>`COALESCE((
  SELECT SUM(oi.quantity)::int FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.variant_id = ${productVariants.id}
    AND o.deleted_at IS NULL
    AND o.status IN ('pending','confirmed')
), 0)`;

export async function listInventory(
  filter: InventoryFilter,
): Promise<{ rows: InventoryRow[]; nextCursor: string | null }> {
  const conds: SQL[] = [isNull(productVariants.deletedAt), isNull(products.deletedAt)];
  if (filter.q) {
    const q = `%${filter.q.trim()}%`;
    conds.push(sql`(${products.name} ILIKE ${q} OR ${productVariants.sku} ILIKE ${q} OR ${productVariants.label} ILIKE ${q})`);
  }
  if (filter.productId) conds.push(eq(productVariants.productId, filter.productId));
  if (filter.view === "low") conds.push(sql`${productVariants.stock} <= ${productVariants.lowStockThreshold}`);
  if (filter.view === "out") conds.push(eq(productVariants.stock, 0));
  if (filter.cursor) {
    const [name, id] = filter.cursor.split("|");
    if (id) conds.push(sql`(${products.name}, ${productVariants.id}) > (${name}, ${id})`);
  }

  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      family: sql<string>`${products.family}::text`,
      sku: productVariants.sku,
      label: productVariants.label,
      stock: productVariants.stock,
      committed: COMMITTED,
      lowStockThreshold: productVariants.lowStockThreshold,
      pricePaisa: productVariants.pricePaisa,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(...conds))
    .orderBy(asc(products.name), asc(productVariants.id))
    .limit(INVENTORY_PAGE_SIZE + 1);

  const hasMore = rows.length > INVENTORY_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, INVENTORY_PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  return {
    rows: page.map((r) => ({ ...r, onHand: r.stock + r.committed })),
    nextCursor: hasMore && last ? `${last.productName}|${last.variantId}` : null,
  };
}

export async function getVariantHistory(variantId: string, limit = 100) {
  return db
    .select({
      id: inventoryAdjustments.id,
      delta: inventoryAdjustments.delta,
      resultingStock: inventoryAdjustments.resultingStock,
      reason: inventoryAdjustments.reason,
      note: inventoryAdjustments.note,
      orderId: inventoryAdjustments.orderId,
      createdAt: inventoryAdjustments.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(inventoryAdjustments)
    .leftJoin(users, eq(users.id, inventoryAdjustments.userId))
    .where(eq(inventoryAdjustments.variantId, variantId))
    .orderBy(desc(inventoryAdjustments.createdAt))
    .limit(limit);
}

export async function getVariantWithProduct(variantId: string) {
  const [row] = await db
    .select({
      variant: productVariants,
      productName: products.name,
      productId: products.id,
      productSlug: products.slug,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, variantId))
    .limit(1);
  return row;
}

export async function countLowStock(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        isNull(productVariants.deletedAt),
        isNull(products.deletedAt),
        sql`${products.status} <> 'archived'`,
        sql`${productVariants.stock} <= ${productVariants.lowStockThreshold}`,
      ),
    );
  return row?.n ?? 0;
}

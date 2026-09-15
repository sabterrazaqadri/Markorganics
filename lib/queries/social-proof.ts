import "server-only";
import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderItems, orders, productVariants } from "@/lib/db/schema";

export interface SoldCount {
  /** Units on orders that were confirmed, shipped or delivered. Cancelled and returned never count. */
  total: number;
  last30Days: number;
}

/**
 * Real numbers only. A competitor's "-- sold in last -- hours" placeholder is
 * exactly the thing this replaces, so the storefront shows a count when it
 * is genuinely worth showing and nothing at all when it is not.
 */
export async function getSoldCounts(productIds: string[]): Promise<Map<string, SoldCount>> {
  const out = new Map<string, SoldCount>();
  if (productIds.length === 0) return out;
  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const rows = await db
    .select({
      productId: productVariants.productId,
      total: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
      recent: sql<number>`COALESCE(SUM(CASE WHEN ${orders.createdAt} >= ${since} THEN ${orderItems.quantity} ELSE 0 END), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(
      and(
        inArray(productVariants.productId, productIds),
        inArray(orders.status, ["confirmed", "shipped", "delivered"]),
        isNull(orders.deletedAt),
      ),
    )
    .groupBy(productVariants.productId);
  for (const r of rows) out.set(r.productId, { total: r.total, last30Days: r.recent });
  return out;
}

/** Orders placed in the last 24 hours holding this product, for "N ordered today". */
export async function getRecentOrderCount(productId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000);
  const [row] = await db
    .select({ n: sql<number>`COUNT(DISTINCT ${orders.id})::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(
      and(
        eq(productVariants.productId, productId),
        gte(orders.createdAt, since),
        inArray(orders.status, ["pending", "confirmed", "shipped", "delivered"]),
        isNull(orders.deletedAt),
      ),
    );
  return row?.n ?? 0;
}

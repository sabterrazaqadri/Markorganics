import "server-only";
import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql, sum, inArray, lt, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  customers,
  orderEvents,
  orders,
  productVariants,
  products,
  users,
  type Customer,
  type Order,
  type OrderEvent,
  type OrderItem,
  type OrderStatus,
} from "@/lib/db/schema";
import type { OrdersFilter } from "@/lib/validation/admin";
import { countLowStock } from "@/lib/admin/inventory";

export type OrderWithItems = Order & { items: OrderItem[]; events: OrderEvent[] };
export type OrderDetail = OrderWithItems & { customer: Customer | null };

const eventsOrdered = { events: { orderBy: [asc(orderEvents.createdAt)] } };

export async function getOrderByNumber(orderNumber: string): Promise<OrderWithItems | undefined> {
  return db.query.orders.findFirst({
    where: and(eq(orders.orderNumber, orderNumber), isNull(orders.deletedAt)),
    with: { items: true, ...eventsOrdered },
  });
}

export async function getOrderByNumberAndPhone(
  orderNumber: string,
  phone: string,
): Promise<OrderWithItems | undefined> {
  return db.query.orders.findFirst({
    where: and(eq(orders.orderNumber, orderNumber), eq(orders.phone, phone), isNull(orders.deletedAt)),
    with: { items: true, ...eventsOrdered },
  });
}

export async function getOrderById(id: string): Promise<OrderDetail | undefined> {
  return db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { items: true, ...eventsOrdered, customer: true },
  }) as Promise<OrderDetail | undefined>;
}

/* --------------------------------------------------------------- listing */

export const ORDERS_PAGE_SIZE = 50;

export interface OrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  phone: string;
  city: string;
  tags: string[];
  itemCount: number;
  totalPaisa: number;
  discountPaisa: number;
  createdAt: Date;
  customerId: string | null;
  actorName: string | null;
  riskOrders: number | null;
  riskBad: number | null;
}

export function buildOrderWhere(filter: OrdersFilter): SQL | undefined {
  const conds: SQL[] = [isNull(orders.deletedAt)];

  if (filter.q) {
    const q = `%${filter.q}%`;
    conds.push(or(ilike(orders.orderNumber, q), ilike(orders.phone, q), ilike(orders.customerName, q))!);
  }

  const view = filter.view ?? "all";
  if (view === "unfulfilled") conds.push(inArray(orders.status, ["pending", "confirmed"]));
  else if (view !== "all") conds.push(eq(orders.status, view as OrderStatus));

  if (filter.status) conds.push(eq(orders.status, filter.status));
  if (filter.from) conds.push(gte(orders.createdAt, new Date(`${filter.from}T00:00:00+05:00`)));
  if (filter.to) conds.push(lte(orders.createdAt, new Date(`${filter.to}T23:59:59.999+05:00`)));
  if (filter.city) conds.push(eq(orders.city, filter.city));
  if (filter.tag) conds.push(sql`EXISTS (SELECT 1 FROM unnest(${orders.tags}) t WHERE lower(t) = lower(${filter.tag}))`);
  if (filter.actor) conds.push(eq(orders.lastActorId, filter.actor));
  if (filter.minTotal !== undefined) conds.push(gte(orders.totalPaisa, Math.round(filter.minTotal * 100)));
  if (filter.maxTotal !== undefined) conds.push(lte(orders.totalPaisa, Math.round(filter.maxTotal * 100)));
  if (filter.minItems !== undefined) conds.push(gte(orders.itemCount, filter.minItems));
  if (filter.maxItems !== undefined) conds.push(lte(orders.itemCount, filter.maxItems));

  return and(...conds);
}

/** Keyset pagination on (created_at, id) — stable while new orders arrive. */
export async function listOrders(filter: OrdersFilter): Promise<{ rows: OrderRow[]; nextCursor: string | null }> {
  const conds: SQL[] = [];
  const base = buildOrderWhere(filter);
  if (base) conds.push(base);
  if (filter.cursor) {
    const [at, id] = filter.cursor.split("|");
    const ms = Number(at);
    if (id && Number.isFinite(ms)) conds.push(sql`(${orders.createdAt}, ${orders.id}) < (${new Date(ms)}, ${id})`);
  }

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      customerName: orders.customerName,
      phone: orders.phone,
      city: orders.city,
      tags: orders.tags,
      itemCount: orders.itemCount,
      totalPaisa: orders.totalPaisa,
      discountPaisa: orders.discountPaisa,
      createdAt: orders.createdAt,
      customerId: orders.customerId,
      actorName: users.name,
      riskOrders: customers.ordersCount,
      riskBad: sql<number>`(${customers.cancelledCount} + ${customers.returnedCount})`,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.lastActorId))
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(and(...conds))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(ORDERS_PAGE_SIZE + 1);

  const hasMore = rows.length > ORDERS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, ORDERS_PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? `${last.createdAt.getTime()}|${last.id}` : null,
  };
}

export async function countOrders(filter: OrdersFilter): Promise<number> {
  const [row] = await db.select({ n: count() }).from(orders).where(buildOrderWhere(filter));
  return row?.n ?? 0;
}

/** Counts for the saved-view tabs, in one round trip. */
export async function orderViewCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: orders.status, n: count() })
    .from(orders)
    .where(isNull(orders.deletedAt))
    .groupBy(orders.status);

  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  const all = rows.reduce((n, r) => n + r.n, 0);
  return {
    all,
    unfulfilled: (byStatus.pending ?? 0) + (byStatus.confirmed ?? 0),
    pending: byStatus.pending ?? 0,
    confirmed: byStatus.confirmed ?? 0,
    shipped: byStatus.shipped ?? 0,
    delivered: byStatus.delivered ?? 0,
    cancelled: byStatus.cancelled ?? 0,
    returned: byStatus.returned ?? 0,
  };
}

export async function listOrdersForExport(filter: OrdersFilter, limit = 5000): Promise<OrderWithItems[]> {
  return db.query.orders.findMany({
    where: buildOrderWhere(filter),
    orderBy: [desc(orders.createdAt)],
    limit,
    with: { items: true, events: true },
  });
}

export async function listOrdersByIds(ids: string[]): Promise<OrderWithItems[]> {
  if (ids.length === 0) return [];
  return db.query.orders.findMany({
    where: inArray(orders.id, ids),
    orderBy: [desc(orders.createdAt)],
    with: { items: true, events: true },
  });
}

export async function distinctOrderCities(): Promise<string[]> {
  const rows = await db
    .select({ city: orders.city })
    .from(orders)
    .where(isNull(orders.deletedAt))
    .groupBy(orders.city)
    .orderBy(asc(orders.city))
    .limit(300);
  return rows.map((r) => r.city);
}

export async function distinctOrderTags(): Promise<string[]> {
  const res = await db.execute<{ tag: string }>(sql`
    SELECT DISTINCT unnest(tags) AS tag FROM orders WHERE deleted_at IS NULL ORDER BY 1 LIMIT 200
  `);
  return (res.rows ?? []).map((r) => r.tag);
}

export async function setInternalNote(id: string, internalNote: string): Promise<void> {
  await db.update(orders).set({ internalNote, updatedAt: new Date() }).where(eq(orders.id, id));
}

/* ------------------------------------------------------------- dashboard */

export interface DashboardStats {
  todayCount: number;
  todayRevenuePaisa: number;
  pendingCount: number;
  weekRevenuePaisa: number;
  weekCount: number;
  lowStockCount: number;
  abandonedCount: number;
  deliveryRatePct: number | null;
  lowStock: { productName: string; label: string; sku: string; stock: number; productId: string; variantId: string }[];
  recent: OrderRow[];
}

const REVENUE_STATUSES: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered"];

/** "Today" and "last 7 days" are computed in Pakistan time (UTC+5). */
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const pkOffsetMs = 5 * 60 * 60 * 1000;
  const pkNow = new Date(now.getTime() + pkOffsetMs);
  const startOfTodayPk = new Date(Date.UTC(pkNow.getUTCFullYear(), pkNow.getUTCMonth(), pkNow.getUTCDate()) - pkOffsetMs);
  const weekAgo = new Date(startOfTodayPk.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [today, week, pending, lowStock, recent, lowStockCount, abandoned, rate] = await Promise.all([
    db
      .select({ n: count(), revenue: sum(orders.totalPaisa) })
      .from(orders)
      .where(and(gte(orders.createdAt, startOfTodayPk), inArray(orders.status, REVENUE_STATUSES), isNull(orders.deletedAt))),
    db
      .select({ n: count(), revenue: sum(orders.totalPaisa) })
      .from(orders)
      .where(and(gte(orders.createdAt, weekAgo), inArray(orders.status, REVENUE_STATUSES), isNull(orders.deletedAt))),
    db.select({ n: count() }).from(orders).where(and(eq(orders.status, "pending"), isNull(orders.deletedAt))),
    db
      .select({
        productName: products.name,
        productId: products.id,
        variantId: productVariants.id,
        label: productVariants.label,
        sku: productVariants.sku,
        stock: productVariants.stock,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(
        and(
          sql`${products.status} <> 'archived'`,
          isNull(products.deletedAt),
          isNull(productVariants.deletedAt),
          sql`${productVariants.stock} <= ${productVariants.lowStockThreshold}`,
        ),
      )
      .orderBy(asc(productVariants.stock))
      .limit(12),
    listOrders({ page: 1 } as OrdersFilter).then((r) => r.rows.slice(0, 8)),
    countLowStock(),
    db.execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM abandoned_checkouts WHERE status = 'open'`),
    db.execute<{ delivered: number; total: number }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
        COUNT(*) FILTER (WHERE status IN ('delivered','returned','cancelled'))::int AS total
      FROM orders WHERE deleted_at IS NULL AND created_at >= ${new Date(now.getTime() - 90 * 864e5)}
    `),
  ]);

  const rateRow = rate.rows?.[0];
  return {
    todayCount: today[0]?.n ?? 0,
    todayRevenuePaisa: Number(today[0]?.revenue ?? 0),
    weekCount: week[0]?.n ?? 0,
    weekRevenuePaisa: Number(week[0]?.revenue ?? 0),
    pendingCount: pending[0]?.n ?? 0,
    lowStockCount,
    abandonedCount: abandoned.rows?.[0]?.n ?? 0,
    deliveryRatePct: rateRow && rateRow.total > 0 ? Math.round((rateRow.delivered / rateRow.total) * 100) : null,
    lowStock,
    recent,
  };
}

export { lt };

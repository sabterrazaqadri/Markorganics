import "server-only";
import { and, asc, desc, eq, gt, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import { customers, customerSegments, orders, type Customer } from "@/lib/db/schema";
import { compileRules, parseRules, type Rule, type RuleMatch } from "./rules";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export const CUSTOMERS_PAGE_SIZE = 50;

/** Orders that count as money the store actually expects to see. */
const SPEND_STATUSES = sql`('pending','confirmed','shipped','delivered')`;

/**
 * Recomputes every denormalised aggregate for one customer from the orders
 * table. Called inside the same transaction as any order write, so the numbers
 * a segment filters on are never stale.
 */
export async function refreshCustomerStats(tx: Tx, customerId: string): Promise<void> {
  await tx.execute(sql`
    UPDATE customers c SET
      orders_count    = s.orders_count,
      delivered_count = s.delivered_count,
      cancelled_count = s.cancelled_count,
      returned_count  = s.returned_count,
      total_spent_paisa = s.total_spent,
      avg_order_paisa = CASE WHEN s.paid_orders = 0 THEN 0 ELSE (s.total_spent / s.paid_orders)::int END,
      first_order_at  = s.first_order_at,
      last_order_at   = s.last_order_at,
      updated_at      = now()
    FROM (
      SELECT
        COUNT(*)::int AS orders_count,
        COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS delivered_count,
        COUNT(*) FILTER (WHERE o.status = 'cancelled')::int AS cancelled_count,
        COUNT(*) FILTER (WHERE o.status = 'returned')::int  AS returned_count,
        COALESCE(SUM(o.total_paisa) FILTER (WHERE o.status::text IN ${SPEND_STATUSES}), 0)::int AS total_spent,
        COUNT(*) FILTER (WHERE o.status::text IN ${SPEND_STATUSES})::int AS paid_orders,
        MIN(o.created_at) AS first_order_at,
        MAX(o.created_at) AS last_order_at
      FROM orders o
      WHERE o.customer_id = ${customerId} AND o.deleted_at IS NULL
    ) s
    WHERE c.id = ${customerId}
  `);
}

export interface UpsertCustomerInput {
  phone: string;
  name?: string | null;
  city?: string | null;
  email?: string | null;
}

/**
 * Finds or creates the customer for a normalised phone number.
 * The phone is the identity key: COD customers rarely give an email.
 */
export async function upsertCustomer(tx: Tx, input: UpsertCustomerInput): Promise<string> {
  const [row] = await tx
    .insert(customers)
    .values({
      phone: input.phone,
      name: input.name?.trim() || "",
      city: input.city?.trim() || "",
      email: input.email?.trim() || null,
    })
    .onConflictDoUpdate({
      target: customers.phone,
      set: {
        // Keep the newest non-empty name and city without wiping a good value.
        name: sql`CASE WHEN ${input.name?.trim() || ""} <> '' THEN ${input.name?.trim() || ""} ELSE ${customers.name} END`,
        city: sql`CASE WHEN ${input.city?.trim() || ""} <> '' THEN ${input.city?.trim() || ""} ELSE ${customers.city} END`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: customers.id });
  return row.id;
}

/** Delivered ÷ total. The COD equivalent of a conversion rate. */
export function deliveryRate(c: Pick<Customer, "ordersCount" | "deliveredCount">): number | null {
  if (c.ordersCount === 0) return null;
  return Math.round((c.deliveredCount / c.ordersCount) * 100);
}

export interface RiskAssessment {
  level: "none" | "watch" | "high";
  reason: string;
}

/**
 * The warning that stops a COD store losing money: a customer who keeps
 * refusing or returning parcels is the single most expensive thing there is.
 */
export function assessRisk(c: Pick<Customer, "ordersCount" | "deliveredCount" | "cancelledCount" | "returnedCount">): RiskAssessment {
  const bad = c.cancelledCount + c.returnedCount;
  if (c.ordersCount < 2 || bad === 0) return { level: "none", reason: "" };
  const rate = bad / c.ordersCount;
  if (bad >= 3 || rate >= 0.5) {
    return {
      level: "high",
      reason: `${bad} of ${c.ordersCount} orders were refused, returned or cancelled. Confirm by phone and consider advance payment.`,
    };
  }
  if (bad >= 2 || rate >= 0.34) {
    return {
      level: "watch",
      reason: `${bad} of ${c.ordersCount} orders were refused, returned or cancelled. Worth a confirmation call.`,
    };
  }
  return { level: "none", reason: "" };
}

/* ---------------------------------------------------------------- listing */

export interface CustomersFilter {
  q?: string;
  city?: string;
  tag?: string;
  segmentId?: string;
  sort?: "recent" | "spend" | "orders" | "risk";
  cursor?: string;
}

async function segmentCondition(segmentId: string): Promise<SQL | null> {
  const segment = await db.query.customerSegments.findFirst({
    where: and(eq(customerSegments.id, segmentId), isNull(customerSegments.deletedAt)),
  });
  if (!segment) return null;
  const compiled = compileRules(parseRules(segment.rules), segment.rulesMatch as RuleMatch, "customer");
  // A segment with no usable rules must match nobody, not everybody.
  return compiled ?? sql`false`;
}

export async function buildCustomerWhere(filter: CustomersFilter): Promise<SQL | undefined> {
  const conds: SQL[] = [sql`${customers.deletedAt} IS NULL`, sql`${customers.mergedIntoId} IS NULL`];
  if (filter.q) {
    const q = `%${filter.q.trim()}%`;
    conds.push(or(ilike(customers.name, q), ilike(customers.phone, q), ilike(customers.email, q))!);
  }
  if (filter.city) conds.push(eq(customers.city, filter.city));
  if (filter.tag) conds.push(sql`EXISTS (SELECT 1 FROM unnest(${customers.tags}) t WHERE lower(t) = lower(${filter.tag}))`);
  if (filter.segmentId) {
    const seg = await segmentCondition(filter.segmentId);
    if (seg) conds.push(sql`(${seg})`);
  }
  return and(...conds);
}

export interface CustomerPage {
  rows: Customer[];
  nextCursor: string | null;
}

/** Keyset pagination on the sort column plus id, so pages never drift. */
export async function listCustomers(filter: CustomersFilter): Promise<CustomerPage> {
  const where = await buildCustomerWhere(filter);
  const sort = filter.sort ?? "recent";

  const conds: SQL[] = where ? [where] : [];
  if (filter.cursor) {
    const [rawValue, id] = filter.cursor.split("|");
    if (id) {
      if (sort === "spend") conds.push(sql`(${customers.totalSpentPaisa}, ${customers.id}) < (${Number(rawValue) || 0}, ${id})`);
      else if (sort === "orders") conds.push(sql`(${customers.ordersCount}, ${customers.id}) < (${Number(rawValue) || 0}, ${id})`);
      else if (sort === "risk")
        conds.push(sql`((${customers.returnedCount} + ${customers.cancelledCount}), ${customers.id}) < (${Number(rawValue) || 0}, ${id})`);
      else
        conds.push(
          sql`(COALESCE(${customers.lastOrderAt}, ${customers.createdAt}), ${customers.id}) < (${new Date(Number(rawValue) || 0)}, ${id})`,
        );
    }
  }

  const orderBy =
    sort === "spend"
      ? [desc(customers.totalSpentPaisa), desc(customers.id)]
      : sort === "orders"
        ? [desc(customers.ordersCount), desc(customers.id)]
        : sort === "risk"
          ? [desc(sql`(${customers.returnedCount} + ${customers.cancelledCount})`), desc(customers.id)]
          : [desc(sql`COALESCE(${customers.lastOrderAt}, ${customers.createdAt})`), desc(customers.id)];

  const rows = await db
    .select()
    .from(customers)
    .where(and(...conds))
    .orderBy(...orderBy)
    .limit(CUSTOMERS_PAGE_SIZE + 1);

  const hasMore = rows.length > CUSTOMERS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, CUSTOMERS_PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  let nextCursor: string | null = null;
  if (hasMore && last) {
    const value =
      sort === "spend"
        ? last.totalSpentPaisa
        : sort === "orders"
          ? last.ordersCount
          : sort === "risk"
            ? last.returnedCount + last.cancelledCount
            : (last.lastOrderAt ?? last.createdAt).getTime();
    nextCursor = `${value}|${last.id}`;
  }
  return { rows: page, nextCursor };
}

export async function countCustomers(filter: CustomersFilter): Promise<number> {
  const where = await buildCustomerWhere(filter);
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(customers).where(where);
  return row?.n ?? 0;
}

/** No pagination — used for segment CSV export. Capped for safety. */
export async function listCustomersForExport(filter: CustomersFilter, limit = 10000): Promise<Customer[]> {
  const where = await buildCustomerWhere(filter);
  return db.select().from(customers).where(where).orderBy(desc(customers.totalSpentPaisa)).limit(limit);
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  return db.query.customers.findFirst({ where: eq(customers.id, id) });
}

export async function getCustomerByPhone(phone: string): Promise<Customer | undefined> {
  return db.query.customers.findFirst({ where: eq(customers.phone, phone) });
}

export async function getCustomerOrders(customerId: string) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalPaisa: orders.totalPaisa,
      city: orders.city,
      address: orders.address,
      createdAt: orders.createdAt,
      itemCount: orders.itemCount,
    })
    .from(orders)
    .where(and(eq(orders.customerId, customerId), isNull(orders.deletedAt)))
    .orderBy(desc(orders.createdAt))
    .limit(200);
}

/** Distinct delivery addresses this person has actually used. */
export async function getCustomerAddresses(customerId: string) {
  const rows = await db
    .select({ city: orders.city, address: orders.address, lastUsed: sql<Date>`max(${orders.createdAt})` })
    .from(orders)
    .where(and(eq(orders.customerId, customerId), isNull(orders.deletedAt)))
    .groupBy(orders.city, orders.address)
    .orderBy(desc(sql`max(${orders.createdAt})`))
    .limit(10);
  return rows;
}

/** Other orders from the same phone number, for the order detail page. */
export async function getPreviousOrdersByPhone(phone: string, excludeOrderId: string) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalPaisa: orders.totalPaisa,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(and(eq(orders.phone, phone), sql`${orders.id} <> ${excludeOrderId}`, isNull(orders.deletedAt)))
    .orderBy(desc(orders.createdAt))
    .limit(10);
}

/** Cities seen on customer records, for the filter dropdown. */
export async function distinctCustomerCities(): Promise<string[]> {
  const rows = await db
    .select({ city: customers.city })
    .from(customers)
    .where(and(isNull(customers.deletedAt), sql`${customers.city} <> ''`))
    .groupBy(customers.city)
    .orderBy(asc(customers.city))
    .limit(200);
  return rows.map((r) => r.city);
}

/**
 * Moves every order from `sourceId` onto `targetId` and tombstones the source.
 * Both records keep existing so the audit trail still resolves.
 */
export async function mergeCustomers(sourceId: string, targetId: string): Promise<{ moved: number }> {
  if (sourceId === targetId) return { moved: 0 };
  return db.transaction(async (tx) => {
    const moved = await tx
      .update(orders)
      .set({ customerId: targetId, updatedAt: new Date() })
      .where(eq(orders.customerId, sourceId))
      .returning({ id: orders.id });

    const [source] = await tx.select().from(customers).where(eq(customers.id, sourceId));
    const [target] = await tx.select().from(customers).where(eq(customers.id, targetId));
    if (source && target) {
      await tx
        .update(customers)
        .set({
          name: target.name || source.name,
          city: target.city || source.city,
          email: target.email ?? source.email,
          tags: [...new Set([...target.tags, ...source.tags])],
          internalNote: [target.internalNote, source.internalNote].filter(Boolean).join("\n"),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, targetId));
    }

    await tx
      .update(customers)
      .set({ mergedIntoId: targetId, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(customers.id, sourceId));

    await refreshCustomerStats(tx, targetId);
    return { moved: moved.length };
  });
}

/** Counts customers matching an unsaved rule set, for the segment editor. */
export async function countCustomersMatching(rules: Rule[], match: RuleMatch): Promise<number> {
  const where = compileRules(parseRules(rules), match, "customer");
  if (!where) return 0;
  const res = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM customers c
    WHERE c.deleted_at IS NULL AND c.merged_into_id IS NULL AND (${where})
  `);
  return res.rows?.[0]?.n ?? 0;
}

/** Candidate duplicates: same name, different phone. */
export async function findDuplicateCandidates(limit = 50) {
  const rows = await db.execute<{ name: string; ids: string[]; phones: string[] }>(sql`
    SELECT c.name, array_agg(c.id::text) AS ids, array_agg(c.phone) AS phones
    FROM customers c
    WHERE c.deleted_at IS NULL AND c.merged_into_id IS NULL AND c.name <> ''
    GROUP BY lower(c.name), c.name
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT ${limit}
  `);
  return rows.rows ?? [];
}

export { gt, lt };

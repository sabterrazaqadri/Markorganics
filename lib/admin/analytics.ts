import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { AnalyticsRange } from "@/lib/validation/admin";

export const ANALYTICS_TAG = "analytics";
const PK_TZ = "Asia/Karachi";

/** Statuses that represent money the store expects to collect. */
const REVENUE = sql`status IN ('pending','confirmed','shipped','delivered')`;
/** Same predicate, qualified for queries that join orders as `o`. */
const REVENUE_O = sql`o.status IN ('pending','confirmed','shipped','delivered')`;

export interface Period {
  from: Date;
  to: Date;
  label: string;
  /** Same length, immediately before `from`. */
  prevFrom: Date;
  prevTo: Date;
  days: number;
}

function pkMidnight(d: Date): Date {
  // Asia/Karachi is a fixed UTC+5 with no DST, so the arithmetic is exact.
  const shifted = new Date(d.getTime() + 5 * 3600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 5 * 3600_000);
}

export function resolvePeriod(range: AnalyticsRange, now = new Date()): Period {
  const todayStart = pkMidnight(now);
  const dayMs = 86_400_000;

  let from: Date;
  let to = new Date(todayStart.getTime() + dayMs - 1);
  let label: string;

  switch (range.range) {
    case "today":
      from = todayStart;
      label = "Today";
      break;
    case "7d":
      from = new Date(todayStart.getTime() - 6 * dayMs);
      label = "Last 7 days";
      break;
    case "90d":
      from = new Date(todayStart.getTime() - 89 * dayMs);
      label = "Last 90 days";
      break;
    case "custom": {
      from = range.from ? new Date(`${range.from}T00:00:00+05:00`) : new Date(todayStart.getTime() - 29 * dayMs);
      to = range.to ? new Date(`${range.to}T23:59:59.999+05:00`) : to;
      label = "Custom range";
      break;
    }
    default:
      from = new Date(todayStart.getTime() - 29 * dayMs);
      label = "Last 30 days";
  }

  if (to < from) to = new Date(from.getTime() + dayMs - 1);
  const span = to.getTime() - from.getTime();
  const days = Math.max(1, Math.round(span / dayMs));
  return {
    from,
    to,
    label,
    days,
    prevFrom: new Date(from.getTime() - span - 1),
    prevTo: new Date(from.getTime() - 1),
  };
}

export interface Metric {
  value: number;
  previous: number;
  /** Percent change, null when the previous period was zero. */
  changePct: number | null;
}

function metric(value: number, previous: number): Metric {
  return {
    value,
    previous,
    changePct: previous === 0 ? null : Math.round(((value - previous) / previous) * 1000) / 10,
  };
}

export interface SeriesPoint {
  day: string;
  orders: number;
  revenuePaisa: number;
}

export interface AnalyticsReport {
  period: Period;
  revenue: Metric;
  orders: Metric;
  aov: Metric;
  deliveredRate: Metric;
  cancelRate: Metric;
  returnRate: Metric;
  newCustomers: Metric;
  returningCustomers: Metric;
  repeatRatePct: number;
  series: SeriesPoint[];
  topProducts: { name: string; slug: string; units: number; revenuePaisa: number }[];
  topVariants: { name: string; sku: string; label: string; units: number; revenuePaisa: number }[];
  byCity: { city: string; orders: number; revenuePaisa: number; deliveredPct: number | null }[];
  funnel: { status: string; n: number }[];
  cancelReasons: { reason: string; n: number }[];
  discounts: { title: string; code: string | null; uses: number; discountedPaisa: number; revenuePaisa: number }[];
}

async function totals(from: Date, to: Date) {
  const res = await db.execute<{
    orders: number;
    revenue: number;
    delivered: number;
    cancelled: number;
    returned: number;
    closed: number;
  }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE ${REVENUE})::int AS orders,
      COALESCE(SUM(total_paisa) FILTER (WHERE ${REVENUE}), 0)::bigint AS revenue,
      COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (WHERE status = 'returned')::int AS returned,
      COUNT(*)::int AS closed
    FROM orders
    WHERE deleted_at IS NULL AND created_at BETWEEN ${from} AND ${to}
  `);
  const r = res.rows?.[0];
  return {
    orders: Number(r?.orders ?? 0),
    revenue: Number(r?.revenue ?? 0),
    delivered: Number(r?.delivered ?? 0),
    cancelled: Number(r?.cancelled ?? 0),
    returned: Number(r?.returned ?? 0),
    total: Number(r?.closed ?? 0),
  };
}

async function customerSplit(from: Date, to: Date) {
  const res = await db.execute<{ fresh: number; returning: number }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE o.created_at = c.first_order_at)::int AS fresh,
      COUNT(*) FILTER (WHERE c.first_order_at IS NOT NULL AND o.created_at > c.first_order_at)::int AS returning
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    WHERE o.deleted_at IS NULL AND o.created_at BETWEEN ${from} AND ${to}
  `);
  const r = res.rows?.[0];
  return { fresh: Number(r?.fresh ?? 0), returning: Number(r?.returning ?? 0) };
}

async function buildReport(range: AnalyticsRange): Promise<AnalyticsReport> {
  const period = resolvePeriod(range);
  const { from, to, prevFrom, prevTo } = period;

  const [now, prev, nowCust, prevCust, series, topProducts, topVariants, byCity, funnel, reasons, discountRows, repeat] =
    await Promise.all([
      totals(from, to),
      totals(prevFrom, prevTo),
      customerSplit(from, to),
      customerSplit(prevFrom, prevTo),
      db.execute<{ day: string; orders: number; revenue: number }>(sql`
        SELECT to_char(date_trunc('day', created_at AT TIME ZONE ${PK_TZ}), 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS orders,
               COALESCE(SUM(total_paisa), 0)::bigint AS revenue
        FROM orders
        WHERE deleted_at IS NULL AND ${REVENUE} AND created_at BETWEEN ${from} AND ${to}
        GROUP BY 1 ORDER BY 1
      `),
      db.execute<{ name: string; slug: string; units: number; revenue: number }>(sql`
        SELECT oi.product_name AS name, oi.product_slug AS slug,
               SUM(oi.quantity)::int AS units,
               SUM(oi.line_total_paisa)::bigint AS revenue
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.deleted_at IS NULL AND ${REVENUE_O} AND o.created_at BETWEEN ${from} AND ${to}
        GROUP BY 1, 2 ORDER BY revenue DESC LIMIT 15
      `),
      db.execute<{ name: string; sku: string; label: string; units: number; revenue: number }>(sql`
        SELECT oi.product_name AS name, oi.sku, oi.variant_label AS label,
               SUM(oi.quantity)::int AS units,
               SUM(oi.line_total_paisa)::bigint AS revenue
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.deleted_at IS NULL AND ${REVENUE_O} AND o.created_at BETWEEN ${from} AND ${to}
        GROUP BY 1, 2, 3 ORDER BY revenue DESC LIMIT 15
      `),
      db.execute<{ city: string; orders: number; revenue: number; delivered: number; closed: number }>(sql`
        SELECT city,
               COUNT(*) FILTER (WHERE ${REVENUE})::int AS orders,
               COALESCE(SUM(total_paisa) FILTER (WHERE ${REVENUE}), 0)::bigint AS revenue,
               COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered,
               COUNT(*) FILTER (WHERE status IN ('delivered','returned','cancelled'))::int AS closed
        FROM orders
        WHERE deleted_at IS NULL AND created_at BETWEEN ${from} AND ${to}
        GROUP BY 1 ORDER BY revenue DESC LIMIT 25
      `),
      db.execute<{ status: string; n: number }>(sql`
        SELECT status::text AS status, COUNT(*)::int AS n
        FROM orders WHERE deleted_at IS NULL AND created_at BETWEEN ${from} AND ${to}
        GROUP BY 1
      `),
      db.execute<{ reason: string; n: number }>(sql`
        SELECT COALESCE(NULLIF(TRIM(COALESCE(cancel_reason, return_reason)), ''), 'No reason given') AS reason,
               COUNT(*)::int AS n
        FROM orders
        WHERE deleted_at IS NULL AND status IN ('cancelled','returned') AND created_at BETWEEN ${from} AND ${to}
        GROUP BY 1 ORDER BY n DESC LIMIT 15
      `),
      db.execute<{ title: string; code: string | null; uses: number; discounted: number; revenue: number }>(sql`
        SELECT d.title, d.code,
               COUNT(r.id)::int AS uses,
               COALESCE(SUM(r.amount_paisa), 0)::bigint AS discounted,
               COALESCE(SUM(r.order_total_paisa), 0)::bigint AS revenue
        FROM discounts d
        LEFT JOIN discount_redemptions r ON r.discount_id = d.id AND r.created_at BETWEEN ${from} AND ${to}
        WHERE d.deleted_at IS NULL
        GROUP BY d.id, d.title, d.code
        HAVING COUNT(r.id) > 0
        ORDER BY revenue DESC LIMIT 20
      `),
      db.execute<{ repeat_customers: number; total_customers: number }>(sql`
        SELECT COUNT(*) FILTER (WHERE orders_count > 1)::int AS repeat_customers,
               COUNT(*)::int AS total_customers
        FROM customers WHERE deleted_at IS NULL AND merged_into_id IS NULL AND orders_count > 0
      `),
    ]);

  const rate = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);
  const repeatRow = repeat.rows?.[0];

  return {
    period,
    revenue: metric(now.revenue, prev.revenue),
    orders: metric(now.orders, prev.orders),
    aov: metric(
      now.orders ? Math.round(now.revenue / now.orders) : 0,
      prev.orders ? Math.round(prev.revenue / prev.orders) : 0,
    ),
    deliveredRate: metric(
      rate(now.delivered, now.delivered + now.cancelled + now.returned),
      rate(prev.delivered, prev.delivered + prev.cancelled + prev.returned),
    ),
    cancelRate: metric(rate(now.cancelled, now.total), rate(prev.cancelled, prev.total)),
    returnRate: metric(rate(now.returned, now.total), rate(prev.returned, prev.total)),
    newCustomers: metric(nowCust.fresh, prevCust.fresh),
    returningCustomers: metric(nowCust.returning, prevCust.returning),
    repeatRatePct: repeatRow && Number(repeatRow.total_customers) > 0
      ? Math.round((Number(repeatRow.repeat_customers) / Number(repeatRow.total_customers)) * 1000) / 10
      : 0,
    series: (series.rows ?? []).map((r) => ({
      day: r.day,
      orders: Number(r.orders),
      revenuePaisa: Number(r.revenue),
    })),
    topProducts: (topProducts.rows ?? []).map((r) => ({
      name: r.name,
      slug: r.slug,
      units: Number(r.units),
      revenuePaisa: Number(r.revenue),
    })),
    topVariants: (topVariants.rows ?? []).map((r) => ({
      name: r.name,
      sku: r.sku,
      label: r.label,
      units: Number(r.units),
      revenuePaisa: Number(r.revenue),
    })),
    byCity: (byCity.rows ?? []).map((r) => ({
      city: r.city,
      orders: Number(r.orders),
      revenuePaisa: Number(r.revenue),
      deliveredPct: Number(r.closed) > 0 ? Math.round((Number(r.delivered) / Number(r.closed)) * 100) : null,
    })),
    funnel: (funnel.rows ?? []).map((r) => ({ status: r.status, n: Number(r.n) })),
    cancelReasons: (reasons.rows ?? []).map((r) => ({ reason: r.reason, n: Number(r.n) })),
    discounts: (discountRows.rows ?? []).map((r) => ({
      title: r.title,
      code: r.code,
      uses: Number(r.uses),
      discountedPaisa: Number(r.discounted),
      revenuePaisa: Number(r.revenue),
    })),
  };
}

const cachedReport = unstable_cache(async (range: AnalyticsRange) => buildReport(range), ["analytics-report"], {
  tags: [ANALYTICS_TAG],
  revalidate: 300,
});

/**
 * Aggregates are cached for five minutes; every report is one page of tiles.
 *
 * The cache round-trips through JSON, so the period's Date fields come back as
 * strings on a hit. They are recomputed rather than revived, which is both
 * cheaper and guaranteed consistent with the range that was asked for.
 */
export async function getAnalytics(range: AnalyticsRange): Promise<AnalyticsReport> {
  const report = await cachedReport(range);
  return { ...report, period: resolvePeriod(range) };
}

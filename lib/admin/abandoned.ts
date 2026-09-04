import "server-only";
import { and, desc, eq, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import { abandonedCheckouts, customers, type AbandonedCheckout } from "@/lib/db/schema";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export const ABANDONED_PAGE_SIZE = 50;

export interface AbandonedCartLine {
  variantId: string;
  productName: string;
  variantLabel: string;
  sku: string;
  unitPricePaisa: number;
  quantity: number;
}

export interface AbandonedRow extends AbandonedCheckout {
  cartLines: AbandonedCartLine[];
  customerOrders: number | null;
}

export function parseCart(raw: unknown): AbandonedCartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (l): l is AbandonedCartLine =>
      !!l && typeof l === "object" && typeof (l as AbandonedCartLine).productName === "string",
  );
}

export interface CaptureInput {
  sessionKey: string;
  name?: string;
  phone?: string;
  city?: string;
  address?: string;
  cart: AbandonedCartLine[];
}

/**
 * Records a checkout in progress. Called from the storefront as soon as a
 * usable phone number is typed, and updated as the form fills in — for a COD
 * store this list is the single most valuable thing in the back office.
 */
/** Returns the row id so the caller can schedule (or reschedule) a follow-up. */
export async function captureCheckout(input: CaptureInput): Promise<string | null> {
  const itemCount = input.cart.reduce((n, l) => n + l.quantity, 0);
  const subtotal = input.cart.reduce((n, l) => n + l.unitPricePaisa * l.quantity, 0);

  const values = {
    sessionKey: input.sessionKey,
    name: (input.name ?? "").slice(0, 80),
    phone: (input.phone ?? "").slice(0, 20),
    city: (input.city ?? "").slice(0, 60),
    address: (input.address ?? "").slice(0, 200),
    cart: input.cart as never,
    itemCount,
    subtotalPaisa: subtotal,
    lastSeenAt: new Date(),
    updatedAt: new Date(),
  };

  const rows = await db
    .insert(abandonedCheckouts)
    .values(values)
    .onConflictDoUpdate({
      target: abandonedCheckouts.sessionKey,
      // Never resurrect a checkout that already turned into an order.
      set: values,
      setWhere: eq(abandonedCheckouts.status, "open"),
    })
    .returning({ id: abandonedCheckouts.id });
  return rows[0]?.id ?? null;
}

/** Marks the checkout recovered once the matching order lands. */
export async function markRecovered(tx: Tx, sessionKey: string | null, orderId: string, phone: string): Promise<void> {
  const conds: SQL[] = [eq(abandonedCheckouts.status, "open")];
  conds.push(sessionKey ? eq(abandonedCheckouts.sessionKey, sessionKey) : eq(abandonedCheckouts.phone, phone));
  await tx
    .update(abandonedCheckouts)
    .set({ status: "recovered", recoveredOrderId: orderId, updatedAt: new Date() })
    .where(and(...conds));
}

export async function listAbandoned(
  filter: { status?: "open" | "recovered" | "dismissed"; cursor?: string } = {},
): Promise<{ rows: AbandonedRow[]; nextCursor: string | null }> {
  const conds: SQL[] = [eq(abandonedCheckouts.status, filter.status ?? "open")];
  if (filter.cursor) {
    const ms = Number(filter.cursor);
    if (Number.isFinite(ms)) conds.push(lt(abandonedCheckouts.createdAt, new Date(ms)));
  }
  // Give a live checkout ten minutes before it counts as abandoned.
  if ((filter.status ?? "open") === "open") {
    conds.push(lt(abandonedCheckouts.lastSeenAt, new Date(Date.now() - 10 * 60 * 1000)));
  }

  const rows = await db
    .select({ row: abandonedCheckouts, customerOrders: customers.ordersCount })
    .from(abandonedCheckouts)
    .leftJoin(customers, eq(customers.phone, abandonedCheckouts.phone))
    .where(and(...conds))
    .orderBy(desc(abandonedCheckouts.createdAt))
    .limit(ABANDONED_PAGE_SIZE + 1);

  const hasMore = rows.length > ABANDONED_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, ABANDONED_PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    rows: page.map((r) => ({
      ...r.row,
      cartLines: parseCart(r.row.cart),
      customerOrders: r.customerOrders,
    })),
    nextCursor: hasMore && last ? String(last.row.createdAt.getTime()) : null,
  };
}

export async function abandonedCounts(): Promise<{ open: number; recovered: number; dismissed: number; valuePaisa: number }> {
  const res = await db.execute<{ status: string; n: number; value: number }>(sql`
    SELECT status::text AS status, COUNT(*)::int AS n, COALESCE(SUM(subtotal_paisa),0)::bigint AS value
    FROM abandoned_checkouts GROUP BY 1
  `);
  const out = { open: 0, recovered: 0, dismissed: 0, valuePaisa: 0 };
  for (const row of res.rows ?? []) {
    if (row.status === "open") {
      out.open = Number(row.n);
      out.valuePaisa = Number(row.value);
    } else if (row.status === "recovered") out.recovered = Number(row.n);
    else if (row.status === "dismissed") out.dismissed = Number(row.n);
  }
  return out;
}

export async function setAbandonedStatus(id: string, status: "open" | "dismissed"): Promise<void> {
  await db.update(abandonedCheckouts).set({ status, updatedAt: new Date() }).where(eq(abandonedCheckouts.id, id));
}

export { isNull };

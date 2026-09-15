import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type Db } from "@/lib/db";
import { orderItems, orders, productVariants, reviews, type Review, type ReviewStatus } from "@/lib/db/schema";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface RatingSummary {
  count: number;
  /** Rounded to one decimal, 0 when there are no reviews. */
  average: number;
  /** Index 0 is one star, index 4 is five stars. */
  distribution: [number, number, number, number, number];
}

const EMPTY: RatingSummary = { count: 0, average: 0, distribution: [0, 0, 0, 0, 0] };

const approved = (productId: string) =>
  and(eq(reviews.productId, productId), eq(reviews.status, "approved"), isNull(reviews.deletedAt));

/** Only approved, undeleted reviews are ever public. */
export async function getApprovedReviews(productId: string, limit = 20): Promise<Review[]> {
  return db.query.reviews.findMany({
    where: approved(productId),
    orderBy: [desc(reviews.isVerified), desc(reviews.createdAt)],
    limit,
  });
}

export async function getRatingSummary(productId: string): Promise<RatingSummary> {
  const map = await getRatingSummaries([productId]);
  return map.get(productId) ?? EMPTY;
}

/** One query for a whole grid of product cards. */
export async function getRatingSummaries(productIds: string[]): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  if (productIds.length === 0) return out;
  const rows = await db
    .select({ productId: reviews.productId, rating: reviews.rating, n: count() })
    .from(reviews)
    .where(and(inArray(reviews.productId, productIds), eq(reviews.status, "approved"), isNull(reviews.deletedAt)))
    .groupBy(reviews.productId, reviews.rating);
  for (const r of rows) {
    const s = out.get(r.productId) ?? { count: 0, average: 0, distribution: [0, 0, 0, 0, 0] as RatingSummary["distribution"] };
    const star = Math.min(5, Math.max(1, r.rating));
    s.distribution[star - 1] += r.n;
    s.count += r.n;
    out.set(r.productId, s);
  }
  for (const s of out.values()) {
    const total = s.distribution.reduce((n, c, i) => n + c * (i + 1), 0);
    s.average = s.count ? Math.round((total / s.count) * 10) / 10 : 0;
  }
  return out;
}

/**
 * A verified review is one whose phone number placed an order for this
 * product that was actually delivered. Returns the order id, or null.
 */
export async function findDeliveredOrder(tx: Tx, phone: string, productId: string): Promise<string | null> {
  const [row] = await tx
    .select({ id: orders.id })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .where(
      and(
        eq(orders.phone, phone),
        eq(orders.status, "delivered"),
        isNull(orders.deletedAt),
        eq(productVariants.productId, productId),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return row?.id ?? null;
}

/* ------------------------------------------------------------------ admin */

export const REVIEWS_PAGE_SIZE = 50;

export interface ReviewRow extends Review {
  productName: string;
  productSlug: string;
}

export async function listReviewsAdmin(status: ReviewStatus | "all"): Promise<ReviewRow[]> {
  const rows = await db.query.reviews.findMany({
    where: status === "all" ? isNull(reviews.deletedAt) : and(eq(reviews.status, status), isNull(reviews.deletedAt)),
    orderBy: [desc(reviews.createdAt)],
    limit: REVIEWS_PAGE_SIZE * 4,
    with: { product: { columns: { name: true, slug: true } } },
  });
  return rows.map((r) => ({ ...r, productName: r.product.name, productSlug: r.product.slug }));
}

export async function countPendingReviews(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(reviews)
    .where(and(eq(reviews.status, "pending"), isNull(reviews.deletedAt)));
  return row?.n ?? 0;
}

"use server";

import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, reviews } from "@/lib/db/schema";
import { reviewInputSchema, type ReviewInput } from "@/lib/validation/review";
import { findDeliveredOrder } from "@/lib/reviews";
import { rateLimit } from "@/lib/rate-limit";

export type SubmitReviewResult =
  | { ok: true; verified: boolean }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * A storefront review lands as "pending" and is shown only after a staff
 * member approves it in /admin/reviews. If the phone number placed an order
 * for this product that was delivered, the review is marked verified, which
 * the moderator sees and the product page shows as a badge.
 */
export async function submitReviewAction(raw: ReviewInput): Promise<SubmitReviewResult> {
  const parsed = reviewInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    if (fieldErrors.website) return { ok: false, message: "Could not submit the review." };
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }
  const data = parsed.data;

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  if (!rateLimit(`review:${ip}`, 5, 60 * 60 * 1000).ok) {
    return { ok: false, message: "You have sent a few reviews already. Try again in an hour." };
  }

  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, data.productSlug), eq(products.status, "active"), isNull(products.deletedAt)),
    columns: { id: true },
  });
  if (!product) return { ok: false, message: "That product no longer exists." };

  const orderId = data.phone ? await findDeliveredOrder(db, data.phone, product.id) : null;

  await db.insert(reviews).values({
    productId: product.id,
    orderId,
    customerName: data.name,
    phone: data.phone,
    city: data.city,
    rating: data.rating,
    title: data.title,
    body: data.body,
    lang: data.lang,
    status: "pending",
    source: "storefront",
    isVerified: orderId !== null,
    ip,
  });

  return { ok: true, verified: orderId !== null };
}

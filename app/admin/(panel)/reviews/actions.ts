"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, reviews, type ReviewStatus } from "@/lib/db/schema";
import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { ActionError, run, type ActionResult } from "@/lib/admin/result";
import { revalidateCatalog } from "@/lib/admin/revalidate";
import { adminReviewSchema, reviewReplySchema } from "@/lib/validation/review";
import { findDeliveredOrder } from "@/lib/reviews";

function refresh(slug?: string) {
  revalidateCatalog(slug);
  revalidatePath("/admin/reviews");
}

export async function setReviewStatusAction(id: string, status: ReviewStatus): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("reviews:write");
    const before = await db.query.reviews.findFirst({ where: eq(reviews.id, id), with: { product: { columns: { slug: true, name: true } } } });
    if (!before) throw new ActionError("Review not found.");
    await db.update(reviews).set({ status, updatedAt: new Date() }).where(eq(reviews.id, id));
    await audit(ctx, {
      action: "review.status",
      entityType: "review",
      entityId: id,
      entityLabel: `${before.customerName} on ${before.product.name}`,
      before: { status: before.status },
      after: { status },
    });
    refresh(before.product.slug);
    return null;
  });
}

export async function replyToReviewAction(input: { id: string; reply: string }): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("reviews:write");
    const { id, reply } = reviewReplySchema.parse(input);
    const before = await db.query.reviews.findFirst({ where: eq(reviews.id, id), with: { product: { columns: { slug: true } } } });
    if (!before) throw new ActionError("Review not found.");
    await db
      .update(reviews)
      .set({ reply, repliedAt: reply ? new Date() : null, updatedAt: new Date() })
      .where(eq(reviews.id, id));
    await audit(ctx, { action: "review.reply", entityType: "review", entityId: id, after: { reply } });
    refresh(before.product.slug);
    return null;
  });
}

export async function deleteReviewAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const ctx = await requirePermission("reviews:write");
    const before = await db.query.reviews.findFirst({ where: eq(reviews.id, id), with: { product: { columns: { slug: true } } } });
    if (!before) throw new ActionError("Review not found.");
    await db.update(reviews).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(reviews.id, id));
    await audit(ctx, { action: "review.delete", entityType: "review", entityId: id, after: { deleted: true } });
    refresh(before.product.slug);
    return null;
  });
}

/**
 * Staff add a review a customer gave on WhatsApp or by phone. It is marked
 * source "admin" so the storefront can be honest about where it came from,
 * and verified only when the phone number matches a delivered order.
 */
export async function addReviewAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await requirePermission("reviews:write");
    const data = adminReviewSchema.parse(input);
    const product = await db.query.products.findFirst({ where: eq(products.id, data.productId), columns: { id: true, slug: true, name: true } });
    if (!product) throw new ActionError("Product not found.");
    const orderId = data.phone ? await findDeliveredOrder(db, data.phone, product.id) : null;
    const [row] = await db
      .insert(reviews)
      .values({
        productId: product.id,
        orderId,
        customerName: data.name,
        phone: data.phone,
        city: data.city,
        rating: data.rating,
        title: data.title,
        body: data.body,
        lang: data.lang,
        status: data.status,
        source: "admin",
        isVerified: orderId !== null,
      })
      .returning({ id: reviews.id });
    await audit(ctx, {
      action: "review.create",
      entityType: "review",
      entityId: row.id,
      entityLabel: `${data.name} on ${product.name}`,
      after: { rating: data.rating, status: data.status, verified: orderId !== null },
    });
    refresh(product.slug);
    return { id: row.id };
  });
}

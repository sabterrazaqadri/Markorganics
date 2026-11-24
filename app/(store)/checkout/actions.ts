"use server";

import { headers } from "next/headers";
import { and, asc, eq, gt, inArray, isNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { productVariants, products } from "@/lib/db/schema";
import { quoteSchema, type CheckoutInput, type QuoteInput } from "@/lib/validation/checkout";
import { placeOrderCore, type PlaceOrderResult } from "@/lib/orders/place-order";
import { deliveryFeeWith, getDeliverySettings, getIntegrationSettings, isCityBlocked } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { bestAutomaticDiscount, resolveCode, type AppliedDiscount, type DiscountLine } from "@/lib/discounts";
import { captureCheckout, type AbandonedCartLine } from "@/lib/admin/abandoned";
import { cancelQueued, enqueue } from "@/lib/jobs/queue";
import { JOB } from "@/lib/jobs/types";

export type { PlaceOrderResult } from "@/lib/orders/place-order";

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/* ------------------------------------------------------------------ quote */

export interface CartQuote {
  subtotalPaisa: number;
  discountPaisa: number;
  deliveryPaisa: number;
  totalPaisa: number;
  itemCount: number;
  discount: { code: string | null; title: string; automatic: boolean } | null;
  /** Set when a typed code was rejected; the cart keeps the code visible. */
  discountError: string | null;
  freeShippingRemainingPaisa: number;
  freeShippingThresholdPaisa: number;
  cityBlocked: boolean;
  /** Variant ids that are gone or archived, so the cart can drop them. */
  staleVariantIds: string[];
  /** Cheapest ways to reach free delivery, for the progress bar. */
  suggestions: UpsellSuggestion[];
}

export interface UpsellSuggestion {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  sku: string;
  pricePaisa: number;
  image: string;
  stock: number;
}

/**
 * Products that would carry the cart over the free-delivery line. Prefers the
 * cheapest item that crosses it on its own, then the dearest ones below it.
 * Bundles are left out: a bundle is a decision, not a top-up.
 */
async function freeShippingSuggestions(excludeVariantIds: string[], remainingPaisa: number, limit = 3): Promise<UpsellSuggestion[]> {
  const rows = await db
    .select({
      variantId: productVariants.id,
      productSlug: products.slug,
      productName: products.name,
      variantLabel: productVariants.label,
      sku: productVariants.sku,
      pricePaisa: productVariants.pricePaisa,
      images: products.images,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(products.status, "active"),
        isNull(products.deletedAt),
        isNull(productVariants.deletedAt),
        eq(products.isBundle, false),
        gt(productVariants.stock, 0),
        excludeVariantIds.length ? notInArray(productVariants.id, excludeVariantIds) : undefined,
      ),
    )
    .orderBy(asc(productVariants.pricePaisa));
  // One variant per product, the cheapest, keeps the row from repeating a name.
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.productSlug) ? false : (seen.add(r.productSlug), true)));
  const crossing = unique.filter((r) => r.pricePaisa >= remainingPaisa);
  const below = unique.filter((r) => r.pricePaisa < remainingPaisa).reverse();
  const picked = [...crossing.slice(0, 2), ...below].slice(0, limit);
  return picked.map((r) => ({
    variantId: r.variantId,
    productSlug: r.productSlug,
    productName: r.productName,
    variantLabel: r.variantLabel,
    sku: r.sku,
    pricePaisa: r.pricePaisa,
    image: r.images[0] ?? "",
    stock: r.stock,
  }));
}

/**
 * The authoritative price of a cart.
 *
 * The browser never computes money that matters: it asks for this, and
 * placeOrder recomputes the very same way inside the order transaction.
 */
export async function quoteCart(raw: QuoteInput): Promise<CartQuote> {
  const parsed = quoteSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : { items: [], code: undefined, city: undefined, phone: undefined };
  const delivery = await getDeliverySettings();

  const empty: CartQuote = {
    subtotalPaisa: 0,
    discountPaisa: 0,
    deliveryPaisa: 0,
    totalPaisa: 0,
    itemCount: 0,
    discount: null,
    discountError: null,
    freeShippingRemainingPaisa: delivery.freeThresholdPaisa,
    freeShippingThresholdPaisa: delivery.freeThresholdPaisa,
    cityBlocked: false,
    staleVariantIds: [],
    suggestions: [],
  };
  if (data.items.length === 0) return empty;

  const wanted = new Map<string, number>();
  for (const line of data.items) wanted.set(line.variantId, (wanted.get(line.variantId) ?? 0) + line.quantity);

  const rows = await db
    .select({
      id: productVariants.id,
      productId: products.id,
      pricePaisa: productVariants.pricePaisa,
      status: products.status,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, [...wanted.keys()]));

  const byId = new Map(rows.map((r) => [r.id, r]));
  const lines: DiscountLine[] = [];
  const stale: string[] = [];

  for (const [variantId, quantity] of wanted) {
    const row = byId.get(variantId);
    if (!row || row.status !== "active") {
      stale.push(variantId);
      continue;
    }
    lines.push({ variantId, productId: row.productId, unitPricePaisa: row.pricePaisa, quantity });
  }

  const subtotal = lines.reduce((n, l) => n + l.unitPricePaisa * l.quantity, 0);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const baseDelivery = deliveryFeeWith(delivery, subtotal, data.city);

  let applied: AppliedDiscount | null = null;
  let discountError: string | null = null;

  const ctx = { lines, subtotalPaisa: subtotal, deliveryPaisa: baseDelivery, phone: data.phone ?? null, customerId: null };

  if (data.code) {
    const result = await resolveCode(db, data.code, ctx);
    if (result.ok) applied = result.applied;
    else discountError = result.error;
  }
  if (!applied) applied = await bestAutomaticDiscount(db, ctx);

  const discountPaisa = applied?.amountPaisa ?? 0;
  const deliveryPaisa = applied?.freeDelivery ? 0 : baseDelivery;
  const remaining = Math.max(0, delivery.freeThresholdPaisa - subtotal);
  const suggestions = remaining > 0 && deliveryPaisa > 0 ? await freeShippingSuggestions([...wanted.keys()], remaining) : [];

  return {
    subtotalPaisa: subtotal,
    discountPaisa,
    deliveryPaisa,
    totalPaisa: Math.max(0, subtotal - discountPaisa + deliveryPaisa),
    itemCount,
    discount: applied
      ? { code: applied.code, title: applied.title, automatic: applied.code === null }
      : null,
    discountError,
    freeShippingRemainingPaisa: remaining,
    freeShippingThresholdPaisa: delivery.freeThresholdPaisa,
    cityBlocked: data.city ? isCityBlocked(delivery, data.city) : false,
    staleVariantIds: stale,
    suggestions,
  };
}

/* ---------------------------------------------------- abandoned checkouts */

/**
 * Logs a checkout in progress. Fire-and-forget from the checkout form as soon
 * as a valid phone number is typed — the single highest-value list a COD store
 * has, because one WhatsApp message often finishes the sale.
 */
export async function recordCheckoutAttempt(input: {
  sessionKey: string;
  name?: string;
  phone?: string;
  city?: string;
  address?: string;
  items: { variantId: string; quantity: number }[];
}): Promise<void> {
  if (!input.sessionKey || input.sessionKey.length > 64) return;
  if (!input.phone) return;

  const ip = await clientIp();
  // Loose limit: this fires while someone types, but not without bound.
  if (!rateLimit(`abandoned:${ip}`, 60, 10 * 60 * 1000).ok) return;

  const variantIds = input.items.map((i) => i.variantId).filter(Boolean).slice(0, 30);
  if (variantIds.length === 0) return;

  const rows = await db
    .select({
      id: productVariants.id,
      label: productVariants.label,
      sku: productVariants.sku,
      pricePaisa: productVariants.pricePaisa,
      productName: products.name,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, variantIds));

  const byId = new Map(rows.map((r) => [r.id, r]));
  const cart: AbandonedCartLine[] = [];
  for (const item of input.items) {
    const row = byId.get(item.variantId);
    if (!row) continue;
    cart.push({
      variantId: row.id,
      productName: row.productName,
      variantLabel: row.label,
      sku: row.sku,
      unitPricePaisa: row.pricePaisa,
      quantity: Math.max(1, Math.min(99, item.quantity)),
    });
  }
  if (cart.length === 0) return;

  try {
    const abandonedId = await captureCheckout({
      sessionKey: input.sessionKey,
      name: input.name,
      phone: input.phone,
      city: input.city,
      address: input.address,
      cart,
    });

    /* Schedule the WhatsApp follow-up from the moment they last touched the
       form, not from the first keystroke: drop any pending job and queue a
       fresh one. If they finish the order, placeOrder deletes it again. */
    if (abandonedId) {
      const key = `wa:abandoned:${input.sessionKey}`;
      const { abandonedDelayHours } = await getIntegrationSettings();
      await cancelQueued(key);
      await enqueue({
        type: JOB.whatsappAbandoned,
        payload: { abandonedId, sessionKey: input.sessionKey },
        idempotencyKey: key,
        runAfter: new Date(Date.now() + Math.max(1, abandonedDelayHours) * 3600_000),
      });
    }
  } catch (err) {
    // Never let telemetry break a checkout in progress.
    console.error("recordCheckoutAttempt failed", err);
  }
}

/* ------------------------------------------------------------ place order */

export async function placeOrder(raw: CheckoutInput): Promise<PlaceOrderResult> {
  // Browser callers can never choose the source or the rate-limit key.
  return placeOrderCore(raw, { source: "storefront" });
}

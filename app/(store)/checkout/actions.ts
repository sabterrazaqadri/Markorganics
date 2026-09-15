"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { and, asc, eq, gt, inArray, isNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { discounts, orderEvents, orderItems, orders, productVariants, products } from "@/lib/db/schema";
import { allocateBundlePrice, effectiveBundleStock, getBundleComponents, type ExpandedLine } from "@/lib/bundles";
import { ORDER_TOKEN_TTL_SECONDS, orderCookieName, signOrderToken } from "@/lib/auth";
import {
  checkoutSchema,
  issuesToFieldErrors,
  quoteSchema,
  type CheckoutInput,
  type FieldErrors,
  type QuoteInput,
} from "@/lib/validation/checkout";
import { ORDER_RATE_LIMIT } from "@/config/commerce";
import { deliveryFeeWith, getDeliverySettings, getStoreSettings, isCityBlocked } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { generateOrderNumber } from "@/lib/order-number";
import { bestAutomaticDiscount, recordRedemption, resolveCode, type AppliedDiscount, type DiscountLine } from "@/lib/discounts";
import { refreshCustomerStats, upsertCustomer } from "@/lib/admin/customers";
import { adjustStock } from "@/lib/admin/inventory";
import { captureCheckout, markRecovered, type AbandonedCartLine } from "@/lib/admin/abandoned";
import { ANALYTICS_TAG } from "@/lib/admin/analytics";
import { cancelQueued, enqueue } from "@/lib/jobs/queue";
import { JOB } from "@/lib/jobs/types";
import { getIntegrationSettings } from "@/lib/settings";

export type PlaceOrderResult =
  | { ok: true; orderNumber: string }
  | { ok: false; message?: string; fieldErrors?: FieldErrors; removeVariantIds?: string[] };

class StockError extends Error {
  constructor(
    message: string,
    public readonly variantId?: string,
  ) {
    super(message);
    this.name = "StockError";
  }
}

class CheckoutError extends Error {}

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
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = issuesToFieldErrors(parsed.error.issues);
    if (fieldErrors.website) {
      // Honeypot tripped: pretend failure to the bot without creating anything.
      return { ok: false, message: "We could not place this order. Please try again." };
    }
    return { ok: false, fieldErrors, message: "Check the highlighted fields." };
  }
  const data = parsed.data;

  const ip = await clientIp();
  const rl = rateLimit(`order:${ip}`, ORDER_RATE_LIMIT.max, ORDER_RATE_LIMIT.windowMs);
  if (!rl.ok) {
    const mins = Math.ceil(rl.retryAfterMs / 60000);
    return { ok: false, message: `Too many orders from this connection. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  const [deliverySettings, store] = await Promise.all([getDeliverySettings(), getStoreSettings()]);
  if (isCityBlocked(deliverySettings, data.city)) {
    return {
      ok: false,
      fieldErrors: { city: "We do not deliver to this city yet. Message us on WhatsApp and we will see what we can do." },
      message: "Check the highlighted fields.",
    };
  }

  // Merge duplicate lines.
  const wanted = new Map<string, number>();
  for (const line of data.items) wanted.set(line.variantId, (wanted.get(line.variantId) ?? 0) + line.quantity);
  const variantIds = [...wanted.keys()];

  try {
    const placed = await db.transaction(async (tx) => {
      /* Pass one: what the cart says it holds. Bundle variants are read here
         too, but only for their price and name; their stock is derived. */
      const cartRows = await tx
        .select({
          id: productVariants.id,
          productId: products.id,
          sku: productVariants.sku,
          label: productVariants.label,
          pricePaisa: productVariants.pricePaisa,
          productName: products.name,
          productSlug: products.slug,
          status: products.status,
          isBundle: products.isBundle,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, variantIds));
      const cartById = new Map(cartRows.map((r) => [r.id, r]));

      for (const variantId of wanted.keys()) {
        const row = cartById.get(variantId);
        if (!row || row.status !== "active") {
          throw new StockError("An item in your cart is no longer available and has been removed.", variantId);
        }
      }

      const bundleIds = cartRows.filter((r) => r.isBundle).map((r) => r.id);
      const components = await getBundleComponents(tx, bundleIds);

      /* Pass two: the real variants that will leave the shelf, locked. */
      const need = new Map<string, number>();
      for (const [variantId, quantity] of wanted) {
        const row = cartById.get(variantId)!;
        if (row.isBundle) {
          const comps = components.get(variantId) ?? [];
          if (comps.length === 0) throw new StockError(`${row.productName} is not available right now.`, variantId);
          for (const c of comps) need.set(c.componentVariantId, (need.get(c.componentVariantId) ?? 0) + c.quantity * quantity);
        } else {
          need.set(variantId, (need.get(variantId) ?? 0) + quantity);
        }
      }

      const stockRows = await tx
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          label: productVariants.label,
          stock: productVariants.stock,
          productName: products.name,
          status: products.status,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, [...need.keys()]))
        .for("update", { of: productVariants });
      const stockById = new Map(stockRows.map((r) => [r.id, r]));

      for (const [variantId, quantity] of need) {
        const row = stockById.get(variantId);
        if (!row || row.status !== "active") {
          throw new StockError("An item in your cart is no longer available and has been removed.", variantId);
        }
        if (row.stock < quantity) {
          const msg =
            row.stock === 0
              ? `${row.productName} ${row.label} just sold out. Remove it to continue.`
              : `Only ${row.stock} of ${row.productName} ${row.label} left. Reduce the quantity to continue.`;
          throw new StockError(msg, row.stock === 0 ? variantId : undefined);
        }
      }

      /* The lines that go on the order: bundles expanded, everything else as is. */
      const lines: (ExpandedLine & { lineTotalPaisa: number })[] = [];
      for (const [variantId, quantity] of wanted) {
        const row = cartById.get(variantId)!;
        if (!row.isBundle) {
          lines.push({
            variantId,
            productId: row.productId,
            productSlug: row.productSlug,
            productName: row.productName,
            variantLabel: row.label,
            sku: row.sku,
            unitPricePaisa: row.pricePaisa,
            quantity,
            lineTotalPaisa: row.pricePaisa * quantity,
            bundleSku: null,
            bundleName: null,
          });
          continue;
        }
        const comps = components.get(variantId) ?? [];
        // Guard against a component that went out of stock between the two reads.
        const live = comps.map((c) => ({ ...c, stock: stockById.get(c.componentVariantId)?.stock ?? 0 }));
        if (effectiveBundleStock(live) < quantity) {
          throw new StockError(`${row.productName} just sold out. Remove it to continue.`, variantId);
        }
        const units = allocateBundlePrice(row.pricePaisa, comps);
        comps.forEach((c, i) => {
          const q = c.quantity * quantity;
          lines.push({
            variantId: c.componentVariantId,
            productId: c.productId,
            productSlug: c.productSlug,
            productName: c.productName,
            variantLabel: c.label,
            sku: c.sku,
            unitPricePaisa: units[i],
            quantity: q,
            lineTotalPaisa: units[i] * q,
            bundleSku: row.sku,
            bundleName: `${row.productName} ${row.label}`.trim(),
          });
        });
      }

      const subtotal = lines.reduce((n, l) => n + l.lineTotalPaisa, 0);
      const baseDelivery = deliveryFeeWith(deliverySettings, subtotal, data.city);

      /* The customer record exists before the discount is judged, so segment
         and first-time conditions can be evaluated against it. */
      const customerId = await upsertCustomer(tx, { phone: data.phone, name: data.fullName, city: data.city });

      /* Discounts are judged on what the customer chose, so a bundle counts as
         the bundle product (already discounted), not as its parts. */
      const discountCtx = {
        lines: [...wanted].map(([variantId, quantity]) => {
          const row = cartById.get(variantId)!;
          return { variantId, productId: row.productId, unitPricePaisa: row.pricePaisa, quantity };
        }),
        subtotalPaisa: subtotal,
        deliveryPaisa: baseDelivery,
        phone: data.phone,
        customerId,
      };

      /* Never trust an amount from the browser: only the code is accepted, and
         the value is recalculated here with the discount row locked. */
      let applied: AppliedDiscount | null = null;
      if (data.discountCode) {
        const [locked] = await tx
          .select({ id: discounts.id })
          .from(discounts)
          .where(eq(discounts.code, data.discountCode.trim().toUpperCase()))
          .for("update");
        void locked;
        const result = await resolveCode(tx, data.discountCode, discountCtx);
        if (!result.ok) throw new CheckoutError(result.error);
        applied = result.applied;
      }
      if (!applied) applied = await bestAutomaticDiscount(tx, discountCtx);

      const discountPaisa = applied?.amountPaisa ?? 0;
      const deliveryPaisa = applied?.freeDelivery ? 0 : baseDelivery;
      const totalPaisa = Math.max(0, subtotal - discountPaisa + deliveryPaisa);

      let number = generateOrderNumber(store.orderNumberPrefix);
      for (let attempt = 0; attempt < 5; attempt++) {
        const clash = await tx.select({ id: orders.id }).from(orders).where(eq(orders.orderNumber, number)).limit(1);
        if (clash.length === 0) break;
        number = generateOrderNumber(store.orderNumberPrefix);
      }

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber: number,
          status: "pending",
          customerId,
          customerName: data.fullName,
          phone: data.phone,
          altPhone: data.altPhone,
          city: data.city,
          address: data.address,
          notes: data.notes,
          subtotalPaisa: subtotal,
          discountPaisa,
          discountCode: applied?.code ?? (applied ? applied.title : null),
          discountId: applied?.discountId ?? null,
          deliveryPaisa,
          totalPaisa,
          itemCount: lines.reduce((n, l) => n + l.quantity, 0),
        })
        .returning({ id: orders.id });

      await tx.insert(orderItems).values(
        lines.map((l) => ({
          orderId: order.id,
          variantId: l.variantId,
          productSlug: l.productSlug,
          productName: l.productName,
          variantLabel: l.variantLabel,
          sku: l.sku,
          unitPricePaisa: l.unitPricePaisa,
          quantity: l.quantity,
          lineTotalPaisa: l.lineTotalPaisa,
          bundleSku: l.bundleSku,
          bundleName: l.bundleName,
        })),
      );

      for (const line of lines) {
        await adjustStock(tx, {
          variantId: line.variantId,
          delta: -line.quantity,
          reason: "sale",
          note: line.bundleName ? `Order ${number} (${line.bundleName})` : `Order ${number}`,
          orderId: order.id,
        });
      }

      await tx.insert(orderEvents).values({
        orderId: order.id,
        type: "created",
        fromStatus: null,
        toStatus: "pending",
        message: "Order placed on the storefront",
      });

      if (applied) {
        await recordRedemption(tx, applied, {
          orderId: order.id,
          customerId,
          phone: data.phone,
          orderTotalPaisa: totalPaisa,
        });
      }

      await refreshCustomerStats(tx, customerId);
      if (data.sessionKey) await markRecovered(tx, data.sessionKey, order.id, data.phone);

      return { id: order.id, number };
    });

    /* The browser that placed the order may add to it for the next hour. */
    try {
      const expiresAt = Math.floor(Date.now() / 1000) + ORDER_TOKEN_TTL_SECONDS;
      const jar = await cookies();
      jar.set(orderCookieName(placed.number), await signOrderToken(placed.id, expiresAt), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ORDER_TOKEN_TTL_SECONDS,
      });
    } catch (err) {
      console.error("could not set the order cookie", err);
    }

    // Stock and reports changed: refresh every cached surface.
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/feed/meta");
    revalidatePath("/feed/google");
    revalidatePath("/feed/tiktok");
    revalidateTag(ANALYTICS_TAG);

    /* Integrations run after the order is safely committed, never inside the
       transaction. Every call is wrapped: a dead queue, a missing table or a
       provider outage must not turn a placed order into a failed one. */
    try {
      if (data.sessionKey) await cancelQueued(`wa:abandoned:${data.sessionKey}`);
      await enqueue({
        type: JOB.analyticsPurchase,
        payload: { orderId: placed.id },
        idempotencyKey: `purchase:${placed.id}`,
      });
      await enqueue({
        type: JOB.whatsappSend,
        payload: { trigger: "order_placed", orderId: placed.id },
        idempotencyKey: `wa:order_placed:${placed.id}`,
      });
    } catch (err) {
      console.error("post-order integrations could not be queued", err);
    }

    return { ok: true, orderNumber: placed.number };
  } catch (err) {
    if (err instanceof StockError) {
      return { ok: false, message: err.message, removeVariantIds: err.variantId ? [err.variantId] : undefined };
    }
    if (err instanceof CheckoutError) {
      return { ok: false, message: err.message };
    }
    console.error("placeOrder failed", err);
    return { ok: false, message: "Something went wrong while placing your order. Please try again in a moment." };
  }
}

"use server";

import { headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { discounts, orderEvents, orderItems, orders, productVariants, products } from "@/lib/db/schema";
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
  cityBlocked: boolean;
  /** Variant ids that are gone or archived, so the cart can drop them. */
  staleVariantIds: string[];
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
    cityBlocked: false,
    staleVariantIds: [],
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
    freeShippingRemainingPaisa: Math.max(0, delivery.freeThresholdPaisa - subtotal),
    cityBlocked: data.city ? isCityBlocked(delivery, data.city) : false,
    staleVariantIds: stale,
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
    await captureCheckout({
      sessionKey: input.sessionKey,
      name: input.name,
      phone: input.phone,
      city: input.city,
      address: input.address,
      cart,
    });
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
    const orderNumber = await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: productVariants.id,
          productId: products.id,
          sku: productVariants.sku,
          label: productVariants.label,
          pricePaisa: productVariants.pricePaisa,
          stock: productVariants.stock,
          productName: products.name,
          productSlug: products.slug,
          status: products.status,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, variantIds))
        .for("update", { of: productVariants });

      const byId = new Map(rows.map((r) => [r.id, r]));
      const lines: {
        variantId: string;
        productId: string;
        productSlug: string;
        productName: string;
        variantLabel: string;
        sku: string;
        unitPricePaisa: number;
        quantity: number;
        lineTotalPaisa: number;
      }[] = [];

      for (const [variantId, quantity] of wanted) {
        const row = byId.get(variantId);
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
        });
      }

      const subtotal = lines.reduce((n, l) => n + l.lineTotalPaisa, 0);
      const baseDelivery = deliveryFeeWith(deliverySettings, subtotal, data.city);

      /* The customer record exists before the discount is judged, so segment
         and first-time conditions can be evaluated against it. */
      const customerId = await upsertCustomer(tx, { phone: data.phone, name: data.fullName, city: data.city });

      const discountCtx = {
        lines: lines.map((l) => ({
          variantId: l.variantId,
          productId: l.productId,
          unitPricePaisa: l.unitPricePaisa,
          quantity: l.quantity,
        })),
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
        })),
      );

      for (const line of lines) {
        await adjustStock(tx, {
          variantId: line.variantId,
          delta: -line.quantity,
          reason: "sale",
          note: `Order ${number}`,
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

      return number;
    });

    // Stock and reports changed: refresh every cached surface.
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/products/[slug]", "page");
    revalidatePath("/feed/meta");
    revalidatePath("/feed/google");
    revalidateTag(ANALYTICS_TAG);

    return { ok: true, orderNumber };
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

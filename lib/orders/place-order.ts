import "server-only";

import { cookies, headers } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { discounts, orderEvents, orderItems, orders, productVariants, products } from "@/lib/db/schema";
import { allocateBundlePrice, effectiveBundleStock, getBundleComponents, type ExpandedLine } from "@/lib/bundles";
import { ORDER_TOKEN_TTL_SECONDS, orderCookieName, signOrderToken } from "@/lib/auth";
import { checkoutSchema, issuesToFieldErrors, type CheckoutInput, type FieldErrors } from "@/lib/validation/checkout";
import { ORDER_RATE_LIMIT } from "@/config/commerce";
import { deliveryFeeWith, getDeliverySettings, getStoreSettings, isCityBlocked } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { generateOrderNumber } from "@/lib/order-number";
import { bestAutomaticDiscount, recordRedemption, resolveCode, type AppliedDiscount } from "@/lib/discounts";
import { refreshCustomerStats, upsertCustomer } from "@/lib/admin/customers";
import { adjustStock } from "@/lib/admin/inventory";
import { markRecovered } from "@/lib/admin/abandoned";
import { ANALYTICS_TAG } from "@/lib/admin/analytics";
import { cancelQueued, enqueue } from "@/lib/jobs/queue";
import { JOB } from "@/lib/jobs/types";

/*
 * The one place an order is created. The storefront checkout action and the
 * MCP endpoint (Claude / ChatGPT) both call this, so stock, discounts,
 * delivery, customer stats and WhatsApp/analytics jobs stay identical.
 */

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

/** Where an order came from. AI channels are tagged so the admin can filter them. */
export type OrderSource = "storefront" | "claude" | "chatgpt" | "ai";

export interface PlaceOrderOptions {
  source?: OrderSource;
  /**
   * Overrides the per-IP rate-limit key. AI assistants call from a handful of
   * shared server IPs, so the MCP endpoint limits per phone number instead.
   */
  rateLimitKey?: string;
}

export async function placeOrderCore(raw: CheckoutInput, options: PlaceOrderOptions = {}): Promise<PlaceOrderResult> {
  const source: OrderSource = options.source ?? "storefront";
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

  const rlKey = options.rateLimitKey ?? `order:${await clientIp()}`;
  const rl = rateLimit(rlKey, ORDER_RATE_LIMIT.max, ORDER_RATE_LIMIT.windowMs);
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
          avgCostPaisa: productVariants.avgCostPaisa,
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
            unitCostPaisa: stockById.get(variantId)?.avgCostPaisa ?? 0,
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
            unitCostPaisa: stockById.get(c.componentVariantId)?.avgCostPaisa ?? 0,
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
          tags: source === "storefront" ? [] : ["ai-order", `ai-${source}`],
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
          unitCostPaisa: l.unitCostPaisa,
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
        message: source === "storefront" ? "Order placed on the storefront" : `Order placed through an AI assistant (${source})`,
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

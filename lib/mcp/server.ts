import "server-only";

import { headers } from "next/headers";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { db } from "@/lib/db";
import { customers, orders, productVariants, products, type ProductWithVariants } from "@/lib/db/schema";
import { getActiveProducts, getProductBySlug } from "@/lib/queries/products";
import { getOrderByNumberAndPhone } from "@/lib/queries/orders";
import { quoteCart } from "@/app/(store)/checkout/actions";
import { placeOrderCore, type OrderSource } from "@/lib/orders/place-order";
import { isReviewPhone } from "@/lib/oauth/core";
import { getDeliverySettings, getStoreSettings, paymentMethodsOf } from "@/lib/settings";
import { normalizeOrderNumber } from "@/lib/order-number";
import { rateLimit } from "@/lib/rate-limit";
import {
  BRAND_NAME,
  DELIVERY_WINDOW,
  MAX_QTY_PER_LINE,
  absoluteImageUrl,
  absoluteUrl,
} from "@/config/commerce";

/*
 * Markorganic's MCP server: lets a shopper browse, price and order from
 * inside Claude or ChatGPT. Every tool reuses the storefront's own queries and
 * order transaction, so prices, stock, discounts, delivery and the WhatsApp
 * confirmation behave exactly as they do on markorganic.com.
 */

export const MCP_INSTRUCTIONS = `You are the shopping assistant for ${BRAND_NAME} (markorganic.com), a Pakistani herbal and natural wellness brand.

- Customers often write in Roman Urdu, Urdu or English. Reply in the language they use.
- Never invent products, prices, stock or delivery fees. Use search_products / get_product for facts and quote_order for every total.
- Prices are in Pakistani Rupees (Rs). Payment is cash on delivery; JazzCash/EasyPaisa may also be offered.
- The customer is already signed in with their verified WhatsApp number, so never ask for their phone number. Call my_account first when ordering or tracking: it returns their saved name, city, last delivery address and recent orders.
- Ordering flow: find the product and variant -> confirm full name, city and complete address (offer the saved ones from my_account) -> call quote_order and show the summary (items, delivery fee, total) -> ask the customer to confirm in so many words -> only then call place_order with customerConfirmed=true. Never place an order the customer has not explicitly confirmed.
- After an order, give the order number and say the team will confirm it on WhatsApp.
- Some products are for adults (men's and women's wellness). Discuss them respectfully and discreetly, and only describe what the product listing says. Do not promise medical results or give medical advice; suggest a doctor for health conditions.
- To check an order, use track_order (the order number is optional; without it, recent orders are listed).`;

/* ------------------------------------------------------------- helpers */

const rs = (paisa: number) => `Rs ${(paisa / 100).toLocaleString("en-PK")}`;

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

interface ToolCtx {
  http?: { authInfo?: { extra?: Record<string, unknown> } };
}

/** The WhatsApp-verified phone attached to the access token (E.164, +92...). */
function verifiedPhone(ctx: ToolCtx): string | null {
  const phone = ctx.http?.authInfo?.extra?.phone;
  return typeof phone === "string" && phone ? phone : null;
}

const NOT_SIGNED_IN = "The customer is not signed in. Ask them to reconnect the Markorganic connector.";

/** Which assistant is calling, from the request's User-Agent. Best effort only: it just tags the order. */
async function detectSource(): Promise<OrderSource> {
  try {
    const ua = ((await headers()).get("user-agent") ?? "").toLowerCase();
    if (ua.includes("openai") || ua.includes("chatgpt")) return "chatgpt";
    if (ua.includes("claude") || ua.includes("anthropic")) return "claude";
  } catch {
    /* outside a request scope */
  }
  return "ai";
}

function summarizeProduct(p: ProductWithVariants) {
  return {
    slug: p.slug,
    name: p.name,
    nameUrdu: p.i18n?.ur?.name ?? null,
    category: p.family,
    type: p.productType || null,
    bestseller: p.isBestseller,
    shortDescription: p.shortDescription,
    url: absoluteUrl(`/products/${p.slug}`),
    image: p.images[0] ? absoluteImageUrl(p.images[0]) : null,
    variants: p.variants.map((v) => ({
      variantId: v.id,
      label: v.label,
      price: rs(v.pricePaisa),
      pricePkr: v.pricePaisa / 100,
      compareAtPkr: v.compareAtPaisa ? v.compareAtPaisa / 100 : null,
      inStock: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold ? `Only ${v.stock} left` : null,
    })),
  };
}

function searchText(p: ProductWithVariants): string {
  return [
    p.name,
    p.slug.replace(/-/g, " "),
    p.family,
    p.productType,
    p.shortDescription,
    p.tags.join(" "),
    p.benefits.join(" "),
    p.i18n?.ur?.name ?? "",
    p.i18n?.ur?.shortDescription ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Common Roman Urdu shopping words mapped to the English the catalogue uses. */
const ROMAN_URDU: Record<string, string[]> = {
  dard: ["pain", "relief"],
  jor: ["joint"],
  joron: ["joint"],
  kamar: ["back"],
  sar: ["head", "headache"],
  baal: ["hair"],
  baalon: ["hair"],
  balon: ["hair"],
  jild: ["skin"],
  chehra: ["face", "skin"],
  tel: ["oil"],
  tail: ["oil"],
  sarson: ["mustard"],
  nariyal: ["coconut"],
  naariyal: ["coconut"],
  piyaz: ["onion"],
  pyaz: ["onion"],
  alsi: ["flax"],
  taqat: ["energy", "stamina"],
  takat: ["energy", "stamina"],
  kamzori: ["energy", "stamina"],
  thakan: ["energy", "stress"],
  nazla: ["cold"],
  zukam: ["cold"],
  khansi: ["cold"],
  neend: ["sleep", "stress"],
  wazan: ["weight"],
  vazan: ["weight"],
  mard: ["men"],
  mardon: ["men"],
  aurat: ["women"],
  khawateen: ["women"],
  salajeet: ["shilajit"],
};

/** Words that match almost everything and should not decide the ranking. */
const WEAK = new Set(["oil", "tel", "tail", "mark", "ka", "ki", "ke", "ke liye", "liye", "chahiye", "for", "the", "and"]);

function scoreProduct(p: ProductWithVariants, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const name = `${p.name} ${p.i18n?.ur?.name ?? ""}`.toLowerCase();
  const text = searchText(p);
  let score = 0;
  for (const raw of tokens) {
    const variants = [raw, ...(ROMAN_URDU[raw] ?? [])];
    const weight = WEAK.has(raw) ? 0.2 : 1;
    if (variants.some((t) => name.includes(t))) score += 3 * weight;
    else if (variants.some((t) => text.includes(t))) score += weight;
  }
  return score;
}

/* ---------------------------------------------------------- input schemas */

const cartLine = z.object({
  variantId: z.string().uuid().describe("variantId from search_products or get_product"),
  quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
});

const FAMILIES = ["oils", "relief", "seeds", "capsules", "herbal"] as const;

/* ---------------------------------------------------------------- tools */

export function registerMarkorganicTools(server: McpServer) {
  server.registerTool(
    "search_products",
    {
      title: "Search Markorganic products",
      description:
        "Search the Markorganic catalogue by keyword (English, Roman Urdu or Urdu), category and budget. Returns products with their variants, prices and stock. Call with no query to list everything.",
      inputSchema: z.object({
        query: z.string().max(100).optional().describe("e.g. 'hair oil', 'joint pain', 'shilajit', 'chia'"),
        category: z.enum(FAMILIES).optional(),
        maxPricePkr: z.number().positive().optional().describe("Only products with a variant at or below this price"),
        inStockOnly: z.boolean().optional().default(true),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, category, maxPricePkr, inStockOnly }) => {
      const all = await getActiveProducts();
      const tokens = (query ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 1);

      const scored = all
        .filter((p) => !category || p.family === category)
        .filter((p) => !inStockOnly || p.variants.some((v) => v.stock > 0))
        .filter((p) => !maxPricePkr || p.variants.some((v) => v.pricePaisa <= maxPricePkr * 100))
        .map((p) => ({ p, score: scoreProduct(p, tokens) }))
        .filter((r) => r.score >= (tokens.every((t) => WEAK.has(t)) ? 0.2 : 1))
        .sort((a, b) => b.score - a.score || Number(b.p.isBestseller) - Number(a.p.isBestseller));

      if (scored.length === 0) {
        return json({
          results: [],
          note: "No matching products. Try a broader keyword or call search_products with no query to see the full range.",
        });
      }
      return json({ results: scored.slice(0, 10).map((r) => summarizeProduct(r.p)) });
    },
  );

  server.registerTool(
    "get_product",
    {
      title: "Get product details",
      description:
        "Full details for one product: description, benefits, how to use, ingredients, FAQs, images and variants with prices.",
      inputSchema: z.object({ slug: z.string().min(1).max(120).describe("Product slug from search_products") }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slug }) => {
      const p = await getProductBySlug(slug.trim().toLowerCase());
      if (!p) return errorResult(`No active product with slug "${slug}". Use search_products to find the right one.`);
      return json({
        ...summarizeProduct(p),
        longDescription: p.longDescription,
        benefits: p.benefits,
        howToUse: p.howToUse,
        ingredients: p.ingredients || null,
        faqs: p.faqs,
        images: p.images.map(absoluteImageUrl),
        urdu: p.i18n?.ur ?? null,
      });
    },
  );

  server.registerTool(
    "get_store_info",
    {
      title: "Delivery and payment info",
      description: "Delivery charges, free-delivery threshold, delivery time, payment methods and contact details.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const [delivery, store] = await Promise.all([getDeliverySettings(), getStoreSettings()]);
      return json({
        store: store.name,
        website: absoluteUrl("/"),
        deliveryFee: rs(delivery.flatRatePaisa),
        freeDeliveryFrom: rs(delivery.freeThresholdPaisa),
        cityRates: delivery.cityRates.map((r) => ({ city: r.city, fee: rs(r.feePaisa) })),
        notDeliveringTo: delivery.blockedCities,
        deliveryTime: DELIVERY_WINDOW,
        paymentMethods: paymentMethodsOf(store),
        whatsapp: store.contactPhone ? `+${store.contactPhone}` : null,
        email: store.contactEmail,
      });
    },
  );

  server.registerTool(
    "quote_order",
    {
      title: "Price a cart",
      description:
        "Calculates the exact subtotal, discount, delivery fee and total for a cart, the same way checkout does. Always call this and show the result to the customer before place_order. Does not create an order.",
      inputSchema: z.object({
        items: z.array(cartLine).min(1).max(30),
        city: z.string().max(60).optional(),
        discountCode: z.string().max(40).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ items, city, discountCode }, ctx: ToolCtx) => {
      const phone = verifiedPhone(ctx) ?? undefined;
      const quote = await quoteCart({ items, city, code: discountCode, phone });

      const ids = items.map((i) => i.variantId);
      const rows = await db
        .select({
          id: productVariants.id,
          label: productVariants.label,
          pricePaisa: productVariants.pricePaisa,
          stock: productVariants.stock,
          name: products.name,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, ids));
      const byId = new Map(rows.map((r) => [r.id, r]));

      const lines = items
        .filter((i) => !quote.staleVariantIds.includes(i.variantId))
        .map((i) => {
          const r = byId.get(i.variantId);
          return {
            variantId: i.variantId,
            item: r ? `${r.name} (${r.label})` : "Unknown item",
            quantity: i.quantity,
            unitPrice: r ? rs(r.pricePaisa) : null,
            lineTotal: r ? rs(r.pricePaisa * i.quantity) : null,
            stockWarning: r && r.stock < i.quantity ? `Only ${r.stock} in stock` : null,
          };
        });

      const store = await getStoreSettings();
      return json({
        lines,
        removedUnavailableItems: quote.staleVariantIds,
        subtotal: rs(quote.subtotalPaisa),
        discount: quote.discount ? { title: quote.discount.title, amount: rs(quote.discountPaisa) } : null,
        discountError: quote.discountError,
        delivery: quote.deliveryPaisa === 0 ? "Free" : rs(quote.deliveryPaisa),
        total: rs(quote.totalPaisa),
        addForFreeDelivery: quote.freeShippingRemainingPaisa > 0 ? rs(quote.freeShippingRemainingPaisa) : null,
        cityNotServed: quote.cityBlocked,
        paymentMethods: paymentMethodsOf(store),
        next: "Show this summary and ask the customer to confirm before calling place_order.",
      });
    },
  );

  server.registerTool(
    "place_order",
    {
      title: "Place the order",
      description:
        "Places a cash-on-delivery order on markorganic.com. Only call after the customer has seen the quote_order summary and explicitly confirmed. Creates a real order; the team confirms it on WhatsApp.",
      inputSchema: z.object({
        fullName: z.string().min(3).max(60),
        altPhone: z.string().max(20).optional().describe("Optional second number for the rider"),
        city: z.string().min(2).max(60),
        address: z.string().min(10).max(200).describe("House/street, area and landmark"),
        notes: z.string().max(300).optional(),
        items: z.array(cartLine).min(1).max(30),
        discountCode: z.string().max(40).optional(),
        customerConfirmed: z
          .literal(true)
          .describe("Set to true only after the customer explicitly confirmed the quoted order"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (input, ctx: ToolCtx) => {
      const phone = verifiedPhone(ctx);
      if (!phone) return errorResult(NOT_SIGNED_IN);

      // AI traffic arrives from a few shared IPs, so limit per phone plus an overall ceiling.
      if (!rateLimit("mcp:order:all", 60, 10 * 60 * 1000).ok) {
        return errorResult("Ordering through the assistant is busy right now. Please try again in a few minutes.");
      }

      const source = await detectSource();
      const result = await placeOrderCore(
        {
          fullName: input.fullName,
          phone,
          altPhone: input.altPhone,
          city: input.city,
          address: input.address,
          notes: isReviewPhone(phone) ? `REVIEW TEST ORDER - do not ship. ${input.notes ?? ""}`.trim().slice(0, 300) : input.notes,
          items: input.items,
          discountCode: input.discountCode,
        },
        { source, rateLimitKey: `order:mcp:${phone}` },
      );

      if (!result.ok) {
        return errorResult(
          JSON.stringify({
            orderPlaced: false,
            message: result.message,
            fieldErrors: result.fieldErrors ?? null,
            removeVariantIds: result.removeVariantIds ?? null,
          }),
        );
      }

      const store = await getStoreSettings();
      return json({
        orderPlaced: true,
        orderNumber: result.orderNumber,
        payment: "Cash on delivery",
        deliveryTime: DELIVERY_WINDOW,
        whatsapp: store.contactPhone ? `+${store.contactPhone}` : null,
        message: `Order ${result.orderNumber} is placed. Our team will confirm it on WhatsApp shortly.`,
      });
    },
  );

  server.registerTool(
    "my_account",
    {
      title: "My account",
      description:
        "The signed-in customer's saved details (name, WhatsApp number, city, last delivery address) and their 5 most recent orders. Use it to pre-fill an order or answer 'where is my order'.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (_args, ctx: ToolCtx) => {
      const phone = verifiedPhone(ctx);
      if (!phone) return errorResult(NOT_SIGNED_IN);

      const [customer] = await db
        .select({ name: customers.name, city: customers.city })
        .from(customers)
        .where(and(eq(customers.phone, phone), isNull(customers.deletedAt), isNull(customers.mergedIntoId)))
        .limit(1);
      const recent = await db
        .select({
          orderNumber: orders.orderNumber,
          status: orders.status,
          totalPaisa: orders.totalPaisa,
          itemCount: orders.itemCount,
          createdAt: orders.createdAt,
          customerName: orders.customerName,
          city: orders.city,
          address: orders.address,
        })
        .from(orders)
        .where(and(eq(orders.phone, phone), isNull(orders.deletedAt)))
        .orderBy(desc(orders.createdAt))
        .limit(5);
      const last = recent[0];

      return json({
        whatsapp: phone,
        name: customer?.name || last?.customerName || null,
        city: customer?.city || last?.city || null,
        lastDeliveryAddress: last?.address ?? null,
        recentOrders: recent.map((o) => ({
          orderNumber: o.orderNumber,
          status: o.status,
          total: rs(o.totalPaisa),
          items: o.itemCount,
          placedAt: o.createdAt,
        })),
        note: recent.length === 0 ? "No orders yet: ask for name, city and full address when ordering." : undefined,
      });
    },
  );

  server.registerTool(
    "track_order",
    {
      title: "Track an order",
      description: "Status and contents of one of the signed-in customer's orders (e.g. MRK-ABC123). Without an order number, the latest order is shown.",
      inputSchema: z.object({ orderNumber: z.string().min(6).max(20).optional() }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ orderNumber }, ctx: ToolCtx) => {
      const e164 = verifiedPhone(ctx);
      if (!e164) return errorResult(NOT_SIGNED_IN);
      const store = await getStoreSettings();

      let number: string | null = null;
      if (orderNumber) {
        number = normalizeOrderNumber(orderNumber, store.orderNumberPrefix);
        if (!number) return errorResult("Check the order number (like MRK-ABC123).");
      } else {
        const [latest] = await db
          .select({ orderNumber: orders.orderNumber })
          .from(orders)
          .where(and(eq(orders.phone, e164), isNull(orders.deletedAt)))
          .orderBy(desc(orders.createdAt))
          .limit(1);
        if (!latest) return errorResult("This customer has no orders yet.");
        number = latest.orderNumber;
      }

      // Only the signed-in customer's own orders are visible.
      const order = await getOrderByNumberAndPhone(number, e164);
      if (!order) return errorResult("No order with that number on this WhatsApp number.");

      return json({
        orderNumber: order.orderNumber,
        status: order.status,
        placedAt: order.createdAt,
        city: order.city,
        items: order.items.map((i) => ({
          item: `${i.productName} (${i.variantLabel})`,
          quantity: i.quantity,
          lineTotal: rs(i.lineTotalPaisa),
        })),
        subtotal: rs(order.subtotalPaisa),
        discount: order.discountPaisa ? rs(order.discountPaisa) : null,
        delivery: order.deliveryPaisa === 0 ? "Free" : rs(order.deliveryPaisa),
        total: rs(order.totalPaisa),
        // Status changes only; staff notes stay internal.
        history: order.events
          .filter((e) => e.type === "created" || e.type === "status")
          .map((e) => ({ at: e.createdAt, status: e.toStatus })),
      });
    },
  );
}

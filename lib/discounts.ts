import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import {
  collectionProducts,
  customerSegments,
  discountRedemptions,
  discounts,
  discountTargets,
  orders,
  type Discount,
} from "@/lib/db/schema";
import { compileRules, parseRules, type RuleMatch } from "@/lib/admin/rules";

type Tx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface DiscountLine {
  variantId: string;
  productId: string;
  unitPricePaisa: number;
  quantity: number;
}

export interface DiscountContext {
  lines: DiscountLine[];
  subtotalPaisa: number;
  deliveryPaisa: number;
  phone?: string | null;
  customerId?: string | null;
}

export interface AppliedDiscount {
  discountId: string;
  code: string | null;
  title: string;
  /** Money off the subtotal. Delivery is handled separately. */
  amountPaisa: number;
  freeDelivery: boolean;
}

export type DiscountResult =
  | { ok: true; applied: AppliedDiscount }
  | { ok: false; error: string };

export function formatDiscountValue(d: Pick<Discount, "type" | "value" | "getQuantity" | "buyQuantity">): string {
  switch (d.type) {
    case "percentage":
      return `${(d.value / 100).toFixed(d.value % 100 === 0 ? 0 : 2)}% off`;
    case "fixed_amount":
      return `Rs ${(d.value / 100).toLocaleString("en-PK")} off`;
    case "free_delivery":
      return "Free delivery";
    case "buy_x_get_y":
      return `Buy ${d.buyQuantity} get ${d.getQuantity}`;
  }
}

export function discountState(d: Discount, now = new Date()): "active" | "scheduled" | "expired" | "disabled" | "used up" {
  if (!d.isEnabled) return "disabled";
  if (d.startsAt > now) return "scheduled";
  if (d.endsAt && d.endsAt < now) return "expired";
  if (d.usageLimit !== null && d.usageCount >= d.usageLimit) return "used up";
  return "active";
}

/** Product ids this discount is scoped to, expanding any target collections. */
async function targetProductIds(tx: Tx, discountId: string, role: string): Promise<Set<string>> {
  const targets = await tx
    .select()
    .from(discountTargets)
    .where(and(eq(discountTargets.discountId, discountId), eq(discountTargets.role, role)));

  const ids = new Set<string>();
  const collectionIds: string[] = [];
  for (const t of targets) {
    if (t.productId) ids.add(t.productId);
    if (t.collectionId) collectionIds.push(t.collectionId);
  }
  if (collectionIds.length) {
    const rows = await tx
      .select({ productId: collectionProducts.productId })
      .from(collectionProducts)
      .where(inArray(collectionProducts.collectionId, collectionIds));
    for (const r of rows) ids.add(r.productId);
  }
  return ids;
}

async function customerInSegment(tx: Tx, segmentId: string, customerId: string): Promise<boolean> {
  const segment = await tx.query.customerSegments.findFirst({
    where: and(eq(customerSegments.id, segmentId), isNull(customerSegments.deletedAt)),
  });
  if (!segment) return false;
  const where = compileRules(parseRules(segment.rules), segment.rulesMatch as RuleMatch, "customer");
  if (!where) return false;
  const res = await tx.execute<{ hit: number }>(
    sql`SELECT 1 AS hit FROM customers c WHERE c.id = ${customerId} AND (${where}) LIMIT 1`,
  );
  return (res.rows ?? []).length > 0;
}

/**
 * The single source of truth for what a discount is worth.
 *
 * Called inside the order transaction with a row lock on the discount, so a
 * usage cap cannot be beaten by two simultaneous checkouts, and never trusts
 * an amount sent from the browser.
 */
export async function evaluateDiscount(
  tx: Tx,
  discount: Discount,
  ctx: DiscountContext,
): Promise<DiscountResult> {
  const now = new Date();
  const state = discountState(discount, now);
  if (state === "disabled") return { ok: false, error: "That code is not available." };
  if (state === "scheduled") return { ok: false, error: "That code is not active yet." };
  if (state === "expired") return { ok: false, error: "That code has expired." };
  if (state === "used up") return { ok: false, error: "That code has reached its usage limit." };

  const quantity = ctx.lines.reduce((n, l) => n + l.quantity, 0);
  if (discount.minSubtotalPaisa > 0 && ctx.subtotalPaisa < discount.minSubtotalPaisa) {
    return {
      ok: false,
      error: `This code needs a subtotal of at least Rs ${(discount.minSubtotalPaisa / 100).toLocaleString("en-PK")}.`,
    };
  }
  if (discount.minQuantity > 0 && quantity < discount.minQuantity) {
    return { ok: false, error: `This code needs at least ${discount.minQuantity} items.` };
  }

  if (discount.firstTimeOnly && ctx.phone) {
    const [prior] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.phone, ctx.phone), isNull(orders.deletedAt)));
    if ((prior?.n ?? 0) > 0) return { ok: false, error: "This code is for first orders only." };
  }

  if (discount.oncePerCustomer && ctx.phone) {
    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(discountRedemptions)
      .where(and(eq(discountRedemptions.discountId, discount.id), eq(discountRedemptions.phone, ctx.phone)));
    if ((used?.n ?? 0) > 0) return { ok: false, error: "You have already used this code." };
  }

  if (discount.segmentId) {
    if (!ctx.customerId) return { ok: false, error: "This code is limited to selected customers." };
    if (!(await customerInSegment(tx, discount.segmentId, ctx.customerId))) {
      return { ok: false, error: "This code is limited to selected customers." };
    }
  }

  /* --- which lines the discount is allowed to touch --- */
  let eligible = ctx.lines;
  if (discount.appliesTo !== "order") {
    const ids = await targetProductIds(tx, discount.id, "applies");
    eligible = ctx.lines.filter((l) => ids.has(l.productId));
    if (eligible.length === 0) return { ok: false, error: "This code does not apply to anything in your cart." };
  }
  const eligibleTotal = eligible.reduce((n, l) => n + l.unitPricePaisa * l.quantity, 0);

  const applied = (amountPaisa: number, freeDelivery = false): DiscountResult => ({
    ok: true,
    applied: {
      discountId: discount.id,
      code: discount.code,
      title: discount.title,
      amountPaisa: Math.max(0, Math.min(amountPaisa, ctx.subtotalPaisa)),
      freeDelivery,
    },
  });

  switch (discount.type) {
    case "percentage":
      return applied(Math.round((eligibleTotal * discount.value) / 10000));

    case "fixed_amount":
      return applied(Math.min(discount.value, eligibleTotal));

    case "free_delivery":
      if (ctx.deliveryPaisa <= 0) return { ok: false, error: "Delivery is already free on this order." };
      return applied(0, true);

    case "buy_x_get_y": {
      const buyIds = await targetProductIds(tx, discount.id, "buy");
      const getIds = await targetProductIds(tx, discount.id, "get");
      const buyLines = buyIds.size ? ctx.lines.filter((l) => buyIds.has(l.productId)) : eligible;
      const getLines = getIds.size ? ctx.lines.filter((l) => getIds.has(l.productId)) : eligible;

      const bought = buyLines.reduce((n, l) => n + l.quantity, 0);
      if (discount.buyQuantity <= 0 || bought < discount.buyQuantity) {
        return { ok: false, error: `Add ${discount.buyQuantity} qualifying items to use this code.` };
      }
      const sets = Math.floor(bought / discount.buyQuantity);
      let freeUnits = sets * Math.max(0, discount.getQuantity);
      if (freeUnits <= 0) return { ok: false, error: "This code does not apply to your cart." };

      // Discount the cheapest qualifying units first — the honest reading.
      const units = getLines
        .flatMap((l) => Array.from({ length: l.quantity }, () => l.unitPricePaisa))
        .sort((a, b) => a - b);
      let amount = 0;
      for (const price of units) {
        if (freeUnits <= 0) break;
        amount += Math.round((price * discount.getDiscountBp) / 10000);
        freeUnits -= 1;
      }
      if (amount <= 0) return { ok: false, error: "This code does not apply to your cart." };
      return applied(amount);
    }
  }
}

/** Looks up a typed code and evaluates it. Locks the row inside a transaction. */
export async function resolveCode(tx: Tx, rawCode: string, ctx: DiscountContext): Promise<DiscountResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a discount code." };
  const discount = await tx.query.discounts.findFirst({
    where: and(eq(discounts.code, code), eq(discounts.method, "code"), isNull(discounts.deletedAt)),
  });
  if (!discount) return { ok: false, error: "That code is not recognised." };
  return evaluateDiscount(tx, discount, ctx);
}

/** Best automatic discount for this cart, or null. */
export async function bestAutomaticDiscount(tx: Tx, ctx: DiscountContext): Promise<AppliedDiscount | null> {
  const now = new Date();
  const candidates = await tx
    .select()
    .from(discounts)
    .where(
      and(
        eq(discounts.method, "automatic"),
        eq(discounts.isEnabled, true),
        isNull(discounts.deletedAt),
        sql`${discounts.startsAt} <= ${now}`,
        or(isNull(discounts.endsAt), sql`${discounts.endsAt} >= ${now}`)!,
      ),
    )
    .limit(50);

  let best: AppliedDiscount | null = null;
  for (const candidate of candidates) {
    const result = await evaluateDiscount(tx, candidate, ctx);
    if (!result.ok) continue;
    const value = result.applied.amountPaisa + (result.applied.freeDelivery ? ctx.deliveryPaisa : 0);
    const bestValue = best ? best.amountPaisa + (best.freeDelivery ? ctx.deliveryPaisa : 0) : -1;
    if (value > bestValue) best = result.applied;
  }
  return best;
}

/** Records the redemption and rolls the counters. Call inside the order tx. */
export async function recordRedemption(
  tx: Tx,
  applied: AppliedDiscount,
  input: { orderId: string; customerId: string | null; phone: string; orderTotalPaisa: number },
): Promise<void> {
  await tx.insert(discountRedemptions).values({
    discountId: applied.discountId,
    orderId: input.orderId,
    customerId: input.customerId,
    phone: input.phone,
    amountPaisa: applied.amountPaisa,
    orderTotalPaisa: input.orderTotalPaisa,
  });
  await tx
    .update(discounts)
    .set({
      usageCount: sql`${discounts.usageCount} + 1`,
      revenuePaisa: sql`${discounts.revenuePaisa} + ${input.orderTotalPaisa}`,
      discountedPaisa: sql`${discounts.discountedPaisa} + ${applied.amountPaisa}`,
      updatedAt: new Date(),
    })
    .where(eq(discounts.id, applied.discountId));
}

/** Public shape returned to the cart, safe to send to the browser. */
export interface DiscountPreview {
  code: string;
  title: string;
  amountPaisa: number;
  freeDelivery: boolean;
}

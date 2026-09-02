/**
 * Commerce configuration. All money values are integer paisa (1 PKR = 100 paisa).
 * Edit the two constants below to change delivery pricing site-wide.
 */
export const DELIVERY_FEE_PAISA = 200 * 100; // Rs 200 flat
export const FREE_SHIPPING_THRESHOLD_PAISA = 2000 * 100; // free delivery at Rs 2,000 and above

export const CURRENCY = "PKR" as const;
export const BRAND_NAME = "MARKORGANICS";
export const BRAND_SHORT = "MARK";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "923001234567";
export const SUPPORT_EMAIL = "hello@markorganics.pk";

/** Stock at or below this number shows a low-stock warning in admin. */
export const LOW_STOCK_THRESHOLD = 5;
/** Maximum quantity of a single variant per order. */
export const MAX_QTY_PER_LINE = 10;
/** Orders per IP allowed inside the rate-limit window. */
export const ORDER_RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
/** Typical delivery window shown to customers. */
export const DELIVERY_WINDOW = "2 to 5 working days";

export function deliveryFeeFor(subtotalPaisa: number): number {
  if (subtotalPaisa <= 0) return 0;
  return subtotalPaisa >= FREE_SHIPPING_THRESHOLD_PAISA ? 0 : DELIVERY_FEE_PAISA;
}

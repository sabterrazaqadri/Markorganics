/**
 * Shared vocabulary for the three pixels.
 *
 * Names, types and unit conversion only: this module is imported by the
 * browser bundle, so nothing in it may touch node:crypto. The shared event id
 * that makes deduplication work lives in ./event-id, server-side.
 */

export const ECOMMERCE_EVENTS = [
  "view_item",
  "add_to_cart",
  "begin_checkout",
  "purchase",
] as const;
export type EcommerceEvent = (typeof ECOMMERCE_EVENTS)[number];

/** Meta and TikTok use their own names for the same four moments. */
export const META_EVENT_NAME: Record<EcommerceEvent, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
};

export const TIKTOK_EVENT_NAME: Record<EcommerceEvent, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "PlaceAnOrder",
};

export interface EventItem {
  sku: string;
  name: string;
  quantity: number;
  pricePaisa: number;
}

export interface CommerceEventPayload {
  event: EcommerceEvent;
  eventId: string;
  valuePaisa: number;
  currency: string;
  items: EventItem[];
  /** Only present for purchase. */
  orderNumber?: string;
  sourceUrl?: string;
}

export function rupees(paisa: number): number {
  return Math.round(paisa) / 100;
}

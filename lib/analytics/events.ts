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

/**
 * Non-commerce moments Meta still optimises on. `contact` is a WhatsApp
 * button click: in month one most orders close there, not in checkout, so
 * without it the pixel would see almost none of the shop's real intent.
 */
export const ENGAGEMENT_EVENTS = ["contact"] as const;
export type EngagementEvent = (typeof ENGAGEMENT_EVENTS)[number];

export const TRACKED_EVENTS = [...ECOMMERCE_EVENTS, ...ENGAGEMENT_EVENTS] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export function isTrackedEvent(value: unknown): value is TrackedEvent {
  return typeof value === "string" && (TRACKED_EVENTS as readonly string[]).includes(value);
}

/** Meta and TikTok use their own names for the same moments. */
export const META_EVENT_NAME: Record<TrackedEvent, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
  contact: "Contact",
};

export const TIKTOK_EVENT_NAME: Record<TrackedEvent, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "PlaceAnOrder",
  contact: "Contact",
};

export interface EventItem {
  sku: string;
  name: string;
  quantity: number;
  pricePaisa: number;
}

export interface CommerceEventPayload {
  event: TrackedEvent;
  eventId: string;
  valuePaisa: number;
  currency: string;
  /** Empty for engagement events such as `contact`. */
  items: EventItem[];
  /** Only present for purchase. */
  orderNumber?: string;
  sourceUrl?: string;
}

export function rupees(paisa: number): number {
  return Math.round(paisa) / 100;
}

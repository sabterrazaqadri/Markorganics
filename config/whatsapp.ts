/**
 * The lifecycle points that can send a WhatsApp message.
 *
 * Kept here rather than in lib/settings.ts because the admin forms are client
 * components and lib/settings is server-only: a constant both halves need does
 * not belong behind that boundary.
 */

export const WHATSAPP_TRIGGERS = [
  "order_placed",
  "order_confirmed",
  "order_shipped",
  "out_for_delivery",
  "order_delivered",
  "order_cancelled",
  "abandoned_checkout",
] as const;

export type WhatsappTrigger = (typeof WHATSAPP_TRIGGERS)[number];

export const WHATSAPP_TRIGGER_LABEL: Record<WhatsappTrigger, string> = {
  order_placed: "Order placed",
  order_confirmed: "Order confirmed",
  order_shipped: "Shipped, with tracking link",
  out_for_delivery: "Out for delivery",
  order_delivered: "Delivered",
  order_cancelled: "Cancelled",
  abandoned_checkout: "Abandoned checkout follow-up",
};

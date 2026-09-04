import type { OrderStatus } from "@/lib/db/schema";

/**
 * MARK's own shipment vocabulary, and the map from each courier's words into
 * it. The raw courier status is always stored alongside, so a wrong mapping
 * here is a one-line fix rather than lost history.
 */

export const SHIPMENT_STATUSES = [
  "unbooked",
  "booked",
  "at_warehouse",
  "picked",
  "in_transit",
  "out_for_delivery",
  "attempted",
  "under_review",
  "delivered",
  "returning",
  "returned",
  "cancelled",
  "expired",
  "unknown",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  unbooked: "Unbooked",
  booked: "Booked",
  at_warehouse: "At courier warehouse",
  picked: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  attempted: "Delivery attempted",
  under_review: "Delivery under review",
  delivered: "Delivered",
  returning: "On its way back",
  returned: "Returned",
  cancelled: "Cancelled",
  expired: "Expired",
  unknown: "Unknown",
};

/** What the customer sees on MARK's own tracking page. */
export const SHIPMENT_STATUS_PUBLIC: Record<ShipmentStatus, string> = {
  unbooked: "Preparing your parcel",
  booked: "Booked with the courier",
  at_warehouse: "At the courier's warehouse",
  picked: "Picked up by the courier",
  in_transit: "On the way to your city",
  out_for_delivery: "Out for delivery today",
  attempted: "Delivery attempted — the rider will try again",
  under_review: "Delivery under review",
  delivered: "Delivered",
  returning: "On its way back to us",
  returned: "Returned to us",
  cancelled: "Shipment cancelled",
  expired: "Shipment expired",
  unknown: "In progress",
};

/** Terminal for polling purposes: nothing more will change. */
export const TERMINAL_STATUSES: ShipmentStatus[] = ["delivered", "returned", "cancelled", "expired"];

export function isTerminal(status: ShipmentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Shipment status to order status.
 *
 * Deliberately conservative: an order only leaves "shipped" for a state the
 * courier has actually confirmed. "Out for return" is still in the courier's
 * hands, so the order stays shipped until the parcel is actually back.
 */
export function orderStatusFor(status: ShipmentStatus): OrderStatus | null {
  switch (status) {
    case "unbooked":
      return null;
    case "booked":
    case "at_warehouse":
    case "picked":
    case "in_transit":
    case "out_for_delivery":
    case "attempted":
    case "under_review":
    case "returning":
      return "shipped";
    case "delivered":
      return "delivered";
    case "returned":
      return "returned";
    case "expired":
    case "cancelled":
      return "cancelled";
    default:
      return null;
  }
}

/**
 * PostEx Merchant API status vocabulary (v4.1.9).
 *
 * Matching is case-insensitive and punctuation-insensitive so "En-route to
 * warehouse" and "Enroute To Warehouse" land in the same place.
 */
const POSTEX_STATUS: Record<string, ShipmentStatus> = {
  unbooked: "unbooked",
  booked: "booked",
  postexwarehouse: "at_warehouse",
  pickedbypostex: "picked",
  enroutetowarehouse: "in_transit",
  outfordelivery: "out_for_delivery",
  attempted: "attempted",
  delivered: "delivered",
  returned: "returned",
  outforreturn: "returning",
  expired: "expired",
  deliveryunderreview: "under_review",
};

export function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function mapPostExStatus(raw: string): ShipmentStatus {
  return POSTEX_STATUS[normalizeKey(raw ?? "")] ?? "unknown";
}

/** Every PostEx status this build knows about, for the admin reference table. */
export const POSTEX_STATUS_VOCABULARY = [
  "Unbooked",
  "Booked",
  "PostEx Warehouse",
  "Picked By PostEx",
  "En-route to warehouse",
  "Out For Delivery",
  "Attempted",
  "Delivered",
  "Returned",
  "Out For Return",
  "Expired",
  "Delivery Under Review",
] as const;

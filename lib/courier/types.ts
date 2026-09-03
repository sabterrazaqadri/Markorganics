/**
 * One interface, many couriers.
 *
 * Nothing in the app books a shipment against PostEx: it books against
 * CourierAdapter. Adding Leopards later is writing one file, not touching the
 * order page.
 */

import type { ShipmentStatus } from "./status";

export interface City {
  /** The id the courier wants in a booking request. */
  id: string;
  name: string;
}

export interface PickupAddress {
  code: string;
  label: string;
  address: string;
  city: string;
}

export interface ShipmentInput {
  orderNumber: string;
  customerName: string;
  phone: string;
  altPhone?: string | null;
  address: string;
  /** MARK's city name, for the log. Use `courierCityId` for the request. */
  city: string;
  courierCityId: string;
  pickupAddressCode: string;
  codAmountPaisa: number;
  itemCount: number;
  weightGrams?: number;
  /** Short line for the courier's own paperwork. */
  description: string;
  /** Passed through so a retry cannot create a second shipment. */
  idempotencyKey?: string;
}

export interface CreatedShipment {
  trackingNumber: string;
  labelUrl?: string;
  /** Whatever the courier returned, stored on the shipment for forensics. */
  raw?: unknown;
}

export interface TrackingEvent {
  status: ShipmentStatus;
  rawStatus: string;
  message: string;
  location: string;
  occurredAt: Date;
  raw?: unknown;
}

export interface TrackingResult {
  status: ShipmentStatus;
  rawStatus: string;
  events: TrackingEvent[];
}

export type CourierCall<T> =
  | { ok: true; data: T; dryRun: boolean }
  | { ok: false; error: string; dryRun: boolean; permanent?: boolean };

export interface CourierAdapter {
  id: string;
  name: string;
  /** false = the request shapes are unconfirmed and every call refuses. */
  verified: boolean;
  getCities(): Promise<CourierCall<City[]>>;
  getPickupAddresses(): Promise<CourierCall<PickupAddress[]>>;
  createShipment(input: ShipmentInput): Promise<CourierCall<CreatedShipment>>;
  cancelShipment(trackingNumber: string): Promise<CourierCall<void>>;
  track(trackingNumber: string): Promise<CourierCall<TrackingResult>>;
  /** A harmless read used by the admin "Test connection" button. */
  testConnection(): Promise<CourierCall<string>>;
  getLoadsheet?(trackingNumbers: string[]): Promise<CourierCall<Buffer>>;
}

/** The shape an unverified adapter returns for every operation. */
export function unimplemented<T>(name: string, operation: string): CourierCall<T> {
  return {
    ok: false,
    dryRun: false,
    permanent: true,
    error: `${name}: ${operation} is not implemented. This adapter is UNVERIFIED — supply the API document and it can be completed. Until then, book with a verified courier.`,
  };
}

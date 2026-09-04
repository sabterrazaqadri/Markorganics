import "server-only";
import { PostExAdapter } from "./postex";
import { LeopardsAdapter } from "./leopards";
import { TCSAdapter } from "./tcs";
import { TraxAdapter } from "./trax";
import { MPAdapter } from "./mp";
import { BlueExAdapter } from "./blueex";
import type { CourierAdapter } from "./types";

/** Every courier MARK knows about, keyed by provider id. */
export const COURIER_ADAPTERS: Record<string, CourierAdapter> = {
  postex: PostExAdapter,
  leopards: LeopardsAdapter,
  tcs: TCSAdapter,
  trax: TraxAdapter,
  mp: MPAdapter,
  blueex: BlueExAdapter,
};

export const COURIER_IDS = Object.keys(COURIER_ADAPTERS);

export function getCourier(provider: string): CourierAdapter | null {
  return COURIER_ADAPTERS[provider] ?? null;
}

export function courierName(provider: string): string {
  return COURIER_ADAPTERS[provider]?.name ?? provider;
}

export * from "./types";
export * from "./status";

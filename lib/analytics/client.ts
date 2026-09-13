"use client";

import { META_EVENT_NAME, TIKTOK_EVENT_NAME, isTrackedEvent, type TrackedEvent } from "./events";

/**
 * The browser half of the three pixels.
 *
 * Every call is a no-op when the pixel is absent or consent has not been
 * given, so callers never guard — `trackEvent("add_to_cart", …)` is safe to
 * put straight in a click handler.
 *
 * `eventId` matters: the server sends the same id for the same event, and
 * that is the only thing stopping every purchase being counted twice.
 *
 * Every event except purchase is also posted to /api/meta-event so the
 * Conversions API gets a copy the browser cannot block. Purchase is left to
 * the job runner, which has the customer's details and sends a better one.
 */

export const CONSENT_KEY = "mark_consent";
export const CONSENT_EVENT = "mark:consent";

export type ConsentValue = "granted" | "denied" | null;

export function readConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    // Private mode, or storage blocked entirely: treat as "not asked yet".
    return null;
  }
}

export function writeConsent(value: Exclude<ConsentValue, null>): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* nothing we can do, and nothing worth breaking the page for */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export interface ClientItem {
  sku: string;
  name: string;
  quantity: number;
  pricePaisa: number;
}

export interface ClientEvent {
  event: TrackedEvent;
  eventId: string;
  valuePaisa: number;
  /** Empty for `contact`. */
  items: ClientItem[];
  orderNumber?: string;
}

interface PixelWindow extends Window {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  ttq?: { track: (name: string, payload?: unknown, options?: unknown) => void };
}

function rupees(paisa: number): number {
  return Math.round(paisa) / 100;
}

export function trackEvent(input: ClientEvent): void {
  if (typeof window === "undefined") return;
  if (!isTrackedEvent(input.event)) return;
  if (readConsent() !== "granted") return;

  const w = window as PixelWindow;
  const value = rupees(input.valuePaisa);
  const hasItems = input.items.length > 0;
  const contents = input.items.map((i) => ({
    id: i.sku,
    quantity: i.quantity,
    item_price: rupees(i.pricePaisa),
  }));

  try {
    w.fbq?.("track", META_EVENT_NAME[input.event], {
      currency: "PKR",
      value,
      ...(hasItems
        ? { content_type: "product", content_ids: input.items.map((i) => i.sku), contents }
        : {}),
      ...(input.orderNumber ? { order_id: input.orderNumber } : {}),
      // The server sends this same id, and Meta keeps one of the pair.
    }, { eventID: input.eventId });
  } catch {
    /* a blocked pixel must never break a click handler */
  }

  if (input.event !== "purchase") sendToConversionsApi(input);

  try {
    w.gtag?.("event", input.event, {
      currency: "PKR",
      value,
      ...(input.event === "purchase" && input.orderNumber ? { transaction_id: input.orderNumber } : {}),
      items: input.items.map((item, index) => ({
        item_id: item.sku,
        item_name: item.name,
        index,
        price: rupees(item.pricePaisa),
        quantity: item.quantity,
      })),
    });
  } catch {
    /* ignore */
  }

  try {
    w.ttq?.track(
      TIKTOK_EVENT_NAME[input.event],
      {
        currency: "PKR",
        value,
        ...(hasItems
          ? {
              contents: input.items.map((i) => ({
                content_id: i.sku,
                content_name: i.name,
                content_type: "product",
                quantity: i.quantity,
                price: rupees(i.pricePaisa),
              })),
            }
          : {}),
      },
      { event_id: input.eventId },
    );
  } catch {
    /* ignore */
  }
}

/**
 * The server copy of a browser event. `keepalive` is what lets the request
 * finish after the page it was sent from is gone — a Contact click navigates
 * to wa.me immediately, and without it the event would be aborted.
 */
function sendToConversionsApi(input: ClientEvent): void {
  try {
    void fetch("/api/meta-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event: input.event,
        eventId: input.eventId,
        valuePaisa: input.valuePaisa,
        items: input.items,
        sourceUrl: window.location.href,
      }),
    }).catch(() => {
      /* the browser pixel has already fired; nothing to do */
    });
  } catch {
    /* ignore */
  }
}

/**
 * An id for events that only ever fire in the browser: ViewContent,
 * AddToCart, InitiateCheckout. Nothing on the server sends those, so this
 * only has to be unique, not reproducible.
 *
 * Purchase is the exception and must NOT use this: the server also sends it,
 * so the page renders the server's own `eventIdFor("purchase", orderId)` and
 * hands it to the client. That shared id is the whole deduplication mechanism.
 */
export function clientEventId(event: string, subject: string): string {
  let hash = 0x811c9dc5;
  const input = `${event}:${subject}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `evt_${event}_c${hash.toString(16)}`;
}

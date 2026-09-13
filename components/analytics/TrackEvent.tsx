"use client";

import { useEffect, useRef } from "react";
import { clientEventId, trackEvent, type ClientItem } from "@/lib/analytics/client";
import type { EcommerceEvent } from "@/lib/analytics/events";

/**
 * Fires one commerce event on mount.
 *
 * Dropped into a server-rendered page (`view_item`, `begin_checkout`,
 * `purchase`) so the page stays a Server Component and only this leaf is
 * client-side. The ref guard is what stops React's development double-mount
 * counting the same view twice.
 *
 * `eventId` is required for `purchase` and must be the id the server
 * computed, or the platform will count the sale twice. Purchase is also
 * remembered in sessionStorage: Meta deduplicates on event id anyway, but a
 * refreshed thank-you page should not send the same sale a third time for
 * the platforms that do not.
 */
export function TrackEvent({
  event,
  valuePaisa,
  items,
  orderNumber,
  eventId,
}: {
  event: EcommerceEvent;
  valuePaisa: number;
  items: ClientItem[];
  orderNumber?: string;
  eventId?: string;
}) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const id = eventId ?? clientEventId(event, orderNumber ?? items.map((i) => i.sku).join("|"));
    if (event === "purchase" && alreadySent(id)) return;

    trackEvent({ event, eventId: id, valuePaisa, items, orderNumber });
  }, [event, eventId, valuePaisa, items, orderNumber]);

  return null;
}

const SENT_KEY = "mark_purchase_sent";

/** True if this tab has already reported the purchase; marks it otherwise. */
function alreadySent(eventId: string): boolean {
  try {
    if (window.sessionStorage.getItem(SENT_KEY) === eventId) return true;
    window.sessionStorage.setItem(SENT_KEY, eventId);
  } catch {
    // Storage blocked: fall back to the event-id deduplication upstream.
  }
  return false;
}

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
 * computed, or the platform will count the sale twice.
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
    trackEvent({
      event,
      eventId: eventId ?? clientEventId(event, orderNumber ?? items.map((i) => i.sku).join("|")),
      valuePaisa,
      items,
      orderNumber,
    });
  }, [event, eventId, valuePaisa, items, orderNumber]);

  return null;
}

"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { clientEventId, trackEvent } from "@/lib/analytics/client";
import { WHATSAPP_NUMBER } from "@/config/commerce";

/**
 * A wa.me link that reports a Contact event before the browser leaves.
 *
 * Month one's orders close on WhatsApp, not in checkout, so this click is
 * the shop's most important conversion for the pixel to learn from until
 * Purchase volume catches up. `trackEvent` uses keepalive for the server
 * copy, so nothing here delays the navigation.
 */
export function WhatsAppLink({
  text,
  onClick,
  children,
  ...rest
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  /** Pre-filled message, unencoded. */
  text?: string;
}) {
  const href = text ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}` : `https://wa.me/${WHATSAPP_NUMBER}`;

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    trackEvent({
      event: "contact",
      eventId: clientEventId("contact", `${window.location.pathname}:${Date.now()}`),
      valuePaisa: 0,
      items: [],
    });
    onClick?.(e);
  }

  return (
    <a href={href} rel="noopener" onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

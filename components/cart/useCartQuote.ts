"use client";

import { useEffect, useRef, useState } from "react";
import { useCart, type CartItem } from "@/store/cart";
import { quoteCart, type CartQuote } from "@/app/(store)/checkout/actions";

/**
 * Asks the server what this cart costs.
 *
 * Delivery rates, free-shipping thresholds and discounts all live in the
 * database now, so the browser cannot compute the real total. A local estimate
 * is shown until the first quote lands, and the order transaction recomputes
 * everything again regardless.
 */
export function useCartQuote(options: { code?: string; city?: string; phone?: string } = {}) {
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const key = JSON.stringify([
    items.map((i) => [i.variantId, i.quantity]),
    options.code ?? "",
    options.city ?? "",
    options.phone ?? "",
  ]);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      quoteCart({
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        code: options.code,
        city: options.city,
        phone: options.phone,
      })
        .then((result) => {
          if (id !== requestId.current) return;
          setQuote(result);
          // Drop anything the catalogue no longer sells.
          for (const variantId of result.staleVariantIds) remove(variantId);
        })
        .catch(() => {})
        .finally(() => {
          if (id === requestId.current) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, loading };
}

/** Local estimate, used only until the first server quote arrives. */
export function localSubtotal(items: CartItem[]): number {
  return items.reduce((n, i) => n + i.unitPricePaisa * i.quantity, 0);
}

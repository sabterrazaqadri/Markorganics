"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { formatPKR } from "@/lib/money";
import { useCartQuote } from "./useCartQuote";
import { QuantityStepper } from "./QuantityStepper";

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const discountCode = useCart((s) => s.discountCode);
  // Priced by the server: delivery rates and discounts live in the database.
  const { quote } = useCartQuote({ code: discountCode });
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus();
    };
  }, [isOpen, close]);

  const subtotal = quote?.subtotalPaisa ?? cartSubtotal(items);
  const count = quote?.itemCount ?? cartCount(items);
  const toFree = quote?.freeShippingRemainingPaisa ?? 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="anim-fade absolute inset-0 bg-ink/40"
        aria-label="Close cart"
        onClick={close}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className="anim-drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-paper shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <h2 id="cart-drawer-title" className="text-lg">
            Cart {count ? <span className="text-ink-soft">({count})</span> : null}
          </h2>
          <button ref={closeRef} type="button" onClick={close} className="btn btn-sm btn-secondary" aria-label="Close cart">
            Close
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-4 px-5">
            <p className="text-ink-soft">Your cart is empty. Start with the oils, or browse all products.</p>
            <Link href="/collections/oils" className="btn btn-band-oil" onClick={close}>
              Shop oils
            </Link>
            <Link href="/products" className="btn btn-secondary" onClick={close}>
              See all products
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-rule overflow-y-auto px-5">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-4 py-4">
                  <Link href={`/products/${item.productSlug}`} onClick={close} className="shrink-0">
                    <Image
                      src={item.image}
                      alt={item.productName}
                      width={72}
                      height={72}
                      sizes="72px"
                      className="h-[72px] w-[72px] rounded border border-rule bg-white object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/products/${item.productSlug}`} onClick={close} className="font-display font-semibold leading-tight hover:underline">
                          {item.productName}
                        </Link>
                        <p className="text-sm text-ink-soft">{item.variantLabel}</p>
                      </div>
                      <p className="tabular shrink-0 text-sm font-medium">{formatPKR(item.unitPricePaisa * item.quantity)}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <QuantityStepper
                        size="sm"
                        value={item.quantity}
                        max={item.maxQty}
                        onChange={(q) => setQuantity(item.variantId, q)}
                        label={`Quantity for ${item.productName} ${item.variantLabel}`}
                      />
                      <button type="button" className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink" onClick={() => remove(item.variantId)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-rule bg-surface px-5 py-4">
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Subtotal</dt>
                  <dd className="tabular">{formatPKR(subtotal)}</dd>
                </div>
                {quote && quote.discountPaisa > 0 ? (
                  <div className="flex justify-between text-band-care">
                    <dt>{quote.discount?.title ?? "Discount"}</dt>
                    <dd className="tabular">&minus;{formatPKR(quote.discountPaisa)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Delivery</dt>
                  <dd className="tabular">
                    {quote ? (quote.deliveryPaisa === 0 ? "Free" : formatPKR(quote.deliveryPaisa)) : "Calculating"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-rule pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular">{quote ? formatPKR(quote.totalPaisa) : "—"}</dd>
                </div>
              </dl>
              {toFree > 0 ? (
                <p className="mt-2 text-xs text-ink-soft">Add {formatPKR(toFree)} more for free delivery.</p>
              ) : (
                <p className="mt-2 text-xs text-band-care">Delivery is free on this order.</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href="/cart" className="btn btn-secondary" onClick={close}>
                  View cart
                </Link>
                <Link href="/checkout" className="btn btn-primary" onClick={close}>
                  Checkout
                </Link>
              </div>
              <p className="mt-3 text-center text-xs text-ink-soft">Pay cash when your order arrives.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

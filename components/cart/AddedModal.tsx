"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { useLang } from "@/store/lang";
import { formatPKR } from "@/lib/money";

const COPY = {
  en: {
    title: "Added to your cart",
    checkout: "Checkout",
    shopMore: "Shop more",
    viewCart: "View cart",
    inCart: (n: number, total: string) => `${n} item${n === 1 ? "" : "s"} in cart · ${total}`,
    cod: "Cash on delivery. No payment now.",
    close: "Close",
  },
  ur: {
    title: "کارٹ میں شامل ہو گیا",
    checkout: "آرڈر مکمل کریں",
    shopMore: "مزید خریداری",
    viewCart: "کارٹ دیکھیں",
    inCart: (n: number, total: string) => `کارٹ میں ${n} اشیاء · ${total}`,
    cod: "ادائیگی ڈیلیوری پر۔ ابھی کچھ نہیں دینا۔",
    close: "بند کریں",
  },
};

/**
 * The pop-up that follows every "Add to cart": what went in, what the cart
 * now holds, and the two ways forward. Checkout is focused on open so a
 * keyboard user can press Enter; Escape or the backdrop dismisses it.
 */
export function AddedModal() {
  const justAdded = useCart((s) => s.justAdded);
  const dismiss = useCart((s) => s.dismissAdded);
  const items = useCart((s) => s.items);
  const lang = useLang((s) => s.lang);
  const t = COPY[lang];
  const checkoutRef = useRef<HTMLAnchorElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!justAdded) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    checkoutRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restoreRef.current?.focus();
    };
  }, [justAdded, dismiss]);

  if (!justAdded) return null;
  const { item, quantity } = justAdded;
  const count = cartCount(items);
  const subtotal = cartSubtotal(items);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="anim-fade absolute inset-0 bg-ink/40" aria-label={t.close} onClick={dismiss} tabIndex={-1} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="added-title"
        className={`anim-toast relative w-full max-w-md rounded-t-lg bg-paper p-5 shadow-2xl sm:rounded-lg ${lang === "ur" ? "urdu" : ""}`}
        lang={lang}
      >
        <div className="flex items-start justify-between gap-3">
          <p id="added-title" className="flex items-center gap-2 font-display text-lg font-semibold">
            <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-band-care text-sm text-white">
              ✓
            </span>
            {t.title}
          </p>
          <button type="button" onClick={dismiss} className="btn btn-sm btn-secondary" aria-label={t.close}>
            ×
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {item.image ? (
            <Image src={item.image} alt="" width={64} height={64} sizes="64px" className="h-16 w-16 rounded border border-rule bg-white object-cover" />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{item.productName}</p>
            <p className="text-sm text-ink-soft">
              {item.variantLabel} × {quantity}
            </p>
          </div>
          <p className="tabular text-sm font-medium">{formatPKR(item.unitPricePaisa * quantity)}</p>
        </div>

        <p className="mt-3 text-sm text-ink-soft">{t.inCart(count, formatPKR(subtotal))}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={dismiss} className="btn btn-secondary">
            {t.shopMore}
          </button>
          <Link ref={checkoutRef} href="/checkout" onClick={dismiss} className="btn btn-primary">
            {t.checkout}
          </Link>
        </div>
        <p className="mt-3 flex items-center justify-between text-xs text-ink-soft">
          <span>{t.cod}</span>
          <Link href="/cart" onClick={dismiss} className="underline underline-offset-4 hover:text-ink">
            {t.viewCart}
          </Link>
        </p>
      </div>
    </div>
  );
}

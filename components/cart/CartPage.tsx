"use client";

import Link from "next/link";
import Image from "next/image";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { formatPKR } from "@/lib/money";
import { QuantityStepper } from "./QuantityStepper";
import { DiscountField } from "./DiscountField";
import { useCartQuote } from "./useCartQuote";

export function CartPage() {
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const discountCode = useCart((s) => s.discountCode);
  const setDiscountCode = useCart((s) => s.setDiscountCode);

  // Prices that matter come from the server; the local subtotal only fills the
  // gap for the first render.
  const { quote, loading } = useCartQuote({ code: discountCode });
  const subtotal = quote?.subtotalPaisa ?? cartSubtotal(items);
  const count = quote?.itemCount ?? cartCount(items);

  if (!hydrated) {
    return <p className="mt-6 text-ink-soft">Loading your cart.</p>;
  }

  if (items.length === 0) {
    return (
      <div className="card mt-6 max-w-xl p-6">
        <p className="text-ink-soft">Your cart is empty. Start with the oils, or browse everything.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/collections/oils" className="btn btn-band-oil">
            Shop oils
          </Link>
          <Link href="/products" className="btn btn-secondary">
            See all products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
      <ul className="card divide-y divide-rule">
        {items.map((item) => (
          <li key={item.variantId} className="flex gap-4 p-4 sm:p-5">
            <Link href={`/products/${item.productSlug}`} className="shrink-0">
              <Image
                src={item.image}
                alt={item.productName}
                width={96}
                height={96}
                sizes="96px"
                className="h-20 w-20 rounded border border-rule bg-white object-cover sm:h-24 sm:w-24"
              />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/products/${item.productSlug}`} className="font-display text-lg font-semibold leading-tight hover:underline">
                    {item.productName}
                  </Link>
                  <p className="text-sm text-ink-soft">
                    {item.variantLabel} &middot; {formatPKR(item.unitPricePaisa)} each
                  </p>
                </div>
                <p className="tabular shrink-0 font-medium">{formatPKR(item.unitPricePaisa * item.quantity)}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <QuantityStepper
                  value={item.quantity}
                  max={item.maxQty}
                  onChange={(q) => setQuantity(item.variantId, q)}
                  label={`Quantity for ${item.productName} ${item.variantLabel}`}
                />
                <button
                  type="button"
                  className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
                  onClick={() => remove(item.variantId)}
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="card h-fit p-5 lg:sticky lg:top-24" aria-labelledby="summary-title">
        <h2 id="summary-title" className="text-lg">
          Summary
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Items ({count})</dt>
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
          <div className="flex justify-between border-t border-rule pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular">{quote ? formatPKR(quote.totalPaisa) : "—"}</dd>
          </div>
        </dl>

        <DiscountField code={discountCode} onApply={setDiscountCode} quote={quote} loading={loading} />

        {quote && quote.freeShippingRemainingPaisa > 0 ? (
          <p className="mt-3 text-xs text-ink-soft">
            Add {formatPKR(quote.freeShippingRemainingPaisa)} more for free delivery.
          </p>
        ) : null}
        <Link href="/checkout" className="btn btn-primary mt-5 w-full">
          Checkout
        </Link>
        <p className="mt-3 text-center text-xs text-ink-soft">Cash on delivery. No payment now.</p>
      </aside>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cartCount, cartSubtotal, useCart } from "@/store/cart";
import { checkoutSchema, issuesToFieldErrors, type CheckoutInput, type FieldErrors } from "@/lib/validation/checkout";
import { formatPKR } from "@/lib/money";
import { DELIVERY_WINDOW } from "@/config/commerce";
import { placeOrder, recordCheckoutAttempt } from "@/app/(store)/checkout/actions";
import { normalizePkPhone } from "@/lib/phone";
import { DiscountField } from "@/components/cart/DiscountField";
import { useCartQuote } from "@/components/cart/useCartQuote";
import { CitySelect } from "./CitySelect";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function CheckoutForm() {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const hydrated = useCart((s) => s.hydrated);
  const clear = useCart((s) => s.clear);
  const remove = useCart((s) => s.remove);
  const discountCode = useCart((s) => s.discountCode);
  const setDiscountCode = useCart((s) => s.setDiscountCode);
  const sessionKey = useCart((s) => s.sessionKey);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    altPhone: "",
    city: "",
    address: "",
    notes: "",
    website: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Delivery rates, blocked cities and discounts all live in the database, so
  // the shown total is a server quote keyed on the cart, code and city.
  const { quote, loading: quoting } = useCartQuote({
    code: discountCode,
    city: form.city,
    phone: form.phone,
  });
  const subtotal = quote?.subtotalPaisa ?? cartSubtotal(items);
  const count = quote?.itemCount ?? cartCount(items);
  const total = quote?.totalPaisa ?? subtotal;

  /* Log the checkout attempt once a real phone number is typed. This is what
     fills the abandoned-checkout list, which is where most recovered COD
     revenue comes from. */
  const lastCapture = useRef("");
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const phone = normalizePkPhone(form.phone);
    if (!phone) return;
    const payload = JSON.stringify([phone, form.fullName, form.city, form.address, items.map((i) => [i.variantId, i.quantity])]);
    if (payload === lastCapture.current) return;

    const timer = setTimeout(() => {
      lastCapture.current = payload;
      void recordCheckoutAttempt({
        sessionKey,
        name: form.fullName,
        phone,
        city: form.city,
        address: form.address,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [form.fullName, form.phone, form.city, form.address, items, sessionKey, hydrated]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const input: CheckoutInput = {
      ...form,
      items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      // Only the code travels; the server recalculates what it is worth.
      discountCode: discountCode || undefined,
      sessionKey,
    };
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      const fe = issuesToFieldErrors(parsed.error.issues);
      setErrors(fe);
      if (fe.items) setMessage(fe.items);
      const first = Object.keys(fe)[0];
      document.getElementById(first)?.focus();
      return;
    }
    startTransition(async () => {
      const result = await placeOrder(input);
      if (result.ok) {
        clear();
        router.replace(`/order/${result.orderNumber}`);
        return;
      }
      if (result.fieldErrors) setErrors(result.fieldErrors);
      if (result.removeVariantIds) result.removeVariantIds.forEach(remove);
      setMessage(result.message ?? "Please check the form and try again.");
    });
  }

  if (!hydrated) return <p className="mt-6 text-ink-soft">Loading your cart.</p>;

  if (items.length === 0) {
    return (
      <div className="card mt-6 max-w-xl p-6">
        <p className="text-ink-soft">There is nothing to check out yet. Add a product first.</p>
        <Link href="/products" className="btn btn-primary mt-4">
          See all products
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        {message ? (
          <div role="alert" className="rounded border border-danger/40 bg-white px-4 py-3 text-sm text-danger">
            {message}
          </div>
        ) : null}

        <fieldset className="card space-y-5 p-5 sm:p-6">
          <legend className="sr-only">Contact</legend>
          <h2 className="text-lg">Contact</h2>
          <Field id="fullName" label="Full name" error={errors.fullName}>
            <input
              id="fullName"
              name="fullName"
              className="field"
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              aria-invalid={errors.fullName ? "true" : undefined}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
              required
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="phone" label="Mobile number" error={errors.phone} hint="We call this number to confirm the order.">
              <input
                id="phone"
                name="phone"
                className="field"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0300 1234567"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                aria-invalid={errors.phone ? "true" : undefined}
                aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
                required
              />
            </Field>
            <Field id="altPhone" label="Alternate number (optional)" error={errors.altPhone}>
              <input
                id="altPhone"
                name="altPhone"
                className="field"
                type="tel"
                inputMode="tel"
                placeholder="0300 1234567"
                value={form.altPhone}
                onChange={(e) => set("altPhone", e.target.value)}
                aria-invalid={errors.altPhone ? "true" : undefined}
                aria-describedby={errors.altPhone ? "altPhone-error" : undefined}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card space-y-5 p-5 sm:p-6">
          <legend className="sr-only">Delivery address</legend>
          <h2 className="text-lg">Delivery address</h2>
          <CitySelect value={form.city} onChange={(v) => set("city", v)} error={errors.city} />
          <Field id="address" label="Full address" error={errors.address} hint="House or flat, street, area, and any landmark.">
            <textarea
              id="address"
              name="address"
              className="field min-h-24"
              autoComplete="street-address"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              aria-invalid={errors.address ? "true" : undefined}
              aria-describedby={errors.address ? "address-error" : "address-hint"}
              required
            />
          </Field>
          <Field id="notes" label="Order notes (optional)" error={errors.notes}>
            <textarea
              id="notes"
              name="notes"
              className="field min-h-20"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Delivery timing, gate instructions"
            />
          </Field>
          {/* Honeypot: visually hidden and skipped by assistive tech. Bots fill it, people never see it. */}
          <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
          </div>
        </fieldset>
      </div>

      <aside className="card h-fit p-5 lg:sticky lg:top-24" aria-labelledby="order-summary-title">
        <h2 id="order-summary-title" className="text-lg">
          Your order
        </h2>
        <ul className="mt-4 divide-y divide-rule">
          {items.map((i) => (
            <li key={i.variantId} className="flex items-center gap-3 py-3">
              <Image src={i.image} alt="" width={48} height={48} sizes="48px" className="h-12 w-12 rounded border border-rule bg-white object-cover" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{i.productName}</p>
                <p className="text-ink-soft">
                  {i.variantLabel} &times; {i.quantity}
                </p>
              </div>
              <p className="tabular text-sm">{formatPKR(i.unitPricePaisa * i.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-2 border-t border-rule pt-3 text-sm">
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

        <DiscountField code={discountCode} onApply={setDiscountCode} quote={quote} loading={quoting} />

        {quote?.cityBlocked ? (
          <p role="alert" className="mt-3 rounded border border-danger/40 bg-white px-3 py-2 text-sm text-danger">
            We do not deliver to {form.city} yet. Message us on WhatsApp and we will see what we can do.
          </p>
        ) : null}

        <div className="mt-4 rounded border border-band-care/40 bg-white p-3 text-sm">
          <p className="font-medium text-band-care">Cash on delivery</p>
          <p className="mt-1 text-ink-soft">
            Pay <span className="tabular font-medium text-ink">{formatPKR(total)}</span> to the rider when your parcel arrives. Delivery takes {DELIVERY_WINDOW}.
          </p>
        </div>

        <button type="submit" className="btn btn-primary mt-5 w-full" disabled={pending || quote?.cityBlocked}>
          {pending ? "Placing order" : "Place order"}
        </button>
        <p className="mt-3 text-center text-xs text-ink-soft">
          By placing an order you agree to our{" "}
          <Link href="/shipping-returns" className="underline underline-offset-2">
            delivery and returns terms
          </Link>
          .
        </p>
      </aside>
    </form>
  );
}

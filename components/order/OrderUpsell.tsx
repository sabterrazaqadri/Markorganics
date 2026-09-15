"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { addToOrderAction } from "@/app/(store)/order/actions";
import { formatPKR } from "@/lib/money";
import { useLang } from "@/store/lang";
import { clientEventId, trackEvent } from "@/lib/analytics/client";

export interface UpsellOffer {
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  sku: string;
  pricePaisa: number;
  compareAtPaisa: number | null;
  image: string;
  blurb: string;
}

const COPY = {
  en: {
    title: "Add to this parcel",
    intro: (mins: number) => `Same rider, same delivery charge. You can add to this order for the next ${mins} minutes.`,
    add: "Add to order",
    adding: "Adding",
    toFree: (amount: string) => `Add ${amount} more and delivery becomes free.`,
  },
  ur: {
    title: "اسی پارسل میں شامل کریں",
    intro: (mins: number) => `وہی رائیڈر، وہی ڈیلیوری چارج۔ اگلے ${mins} منٹ تک آپ اس آرڈر میں چیزیں شامل کر سکتے ہیں۔`,
    add: "آرڈر میں شامل کریں",
    adding: "شامل ہو رہا ہے",
    toFree: (amount: string) => `${amount} کا مزید سامان شامل کریں اور ڈیلیوری مفت ہو جائے گی۔`,
  },
};

/**
 * Post-purchase upsell. Shown once, right after checkout, while the order is
 * still pending. One tap adds the item to the same order; the server action
 * re-checks the cookie, stock and delivery fee.
 */
export function OrderUpsell({
  orderNumber,
  offers,
  minutesLeft,
  toFreeDeliveryPaisa,
}: {
  orderNumber: string;
  offers: UpsellOffer[];
  minutesLeft: number;
  toFreeDeliveryPaisa: number;
}) {
  const router = useRouter();
  const lang = useLang((s) => s.lang);
  const t = COPY[lang];
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();
  const [added, setAdded] = useState<Set<string>>(new Set());

  if (offers.length === 0) return null;

  function add(offer: UpsellOffer) {
    setPendingId(offer.variantId);
    setMessage(null);
    start(async () => {
      const result = await addToOrderAction({ orderNumber, variantId: offer.variantId, quantity: 1 });
      setPendingId(null);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) {
        setAdded((s) => new Set(s).add(offer.variantId));
        trackEvent({
          event: "add_to_cart",
          eventId: clientEventId("add_to_cart", `${offer.sku}:post-purchase:${Date.now()}`),
          valuePaisa: offer.pricePaisa,
          items: [{ sku: offer.sku, name: `${offer.productName} ${offer.variantLabel}`, quantity: 1, pricePaisa: offer.pricePaisa }],
        });
        router.refresh();
      }
    });
  }

  return (
    <section aria-labelledby="upsell-title" className={`card mt-8 p-5 ${lang === "ur" ? "urdu" : ""}`} lang={lang}>
      <h2 id="upsell-title" className="text-lg">
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{t.intro(minutesLeft)}</p>
      {toFreeDeliveryPaisa > 0 ? <p className="mt-1 text-sm font-medium text-band-care">{t.toFree(formatPKR(toFreeDeliveryPaisa))}</p> : null}
      {message ? (
        <p role="status" className={`mt-3 rounded border px-3 py-2 text-sm ${message.ok ? "border-band-care/40 text-band-care" : "border-danger/40 text-danger"}`}>
          {message.text}
        </p>
      ) : null}
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {offers.map((o) => (
          <li key={o.variantId} className="flex gap-3 rounded border border-rule bg-white p-3">
            {o.image ? (
              <Image src={o.image} alt="" width={64} height={64} sizes="64px" className="h-16 w-16 rounded border border-rule object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-tight">{o.productName}</p>
              <p className="text-xs text-ink-soft">{o.variantLabel}</p>
              <p className="mt-1 text-xs text-ink-soft">{o.blurb}</p>
              <p className="tabular mt-1 text-sm font-medium">
                {formatPKR(o.pricePaisa)}
                {o.compareAtPaisa && o.compareAtPaisa > o.pricePaisa ? (
                  <s className="ml-1.5 font-normal text-ink-soft">{formatPKR(o.compareAtPaisa)}</s>
                ) : null}
              </p>
              <button
                type="button"
                className="btn btn-sm btn-primary mt-2"
                disabled={pendingId !== null || added.has(o.variantId)}
                onClick={() => add(o)}
              >
                {added.has(o.variantId) ? "✓" : pendingId === o.variantId ? t.adding : t.add}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

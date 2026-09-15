"use client";

import Image from "next/image";
import { useCart } from "@/store/cart";
import { useLang } from "@/store/lang";
import { useToast } from "@/components/ui/Toast";
import { formatPKR } from "@/lib/money";
import { STORE_COPY } from "@/lib/i18n/checkout";
import { clientEventId, trackEvent } from "@/lib/analytics/client";
import type { CartQuote } from "@/app/(store)/checkout/actions";

/**
 * Progress towards free delivery, plus the cheapest products that would get
 * the cart there in one tap. The remaining amount and the suggestions both
 * come from the server quote, so they follow the threshold in settings.
 */
export function FreeShippingBar({ quote, compact = false }: { quote: CartQuote | null; compact?: boolean }) {
  const lang = useLang((s) => s.lang);
  const t = STORE_COPY[lang];
  const add = useCart((s) => s.add);
  const show = useToast((s) => s.show);

  if (!quote || quote.itemCount === 0) return null;
  const threshold = quote.freeShippingThresholdPaisa;
  const remaining = quote.freeShippingRemainingPaisa;
  const unlocked = quote.deliveryPaisa === 0;
  const pct = threshold > 0 ? Math.min(100, Math.round(((threshold - remaining) / threshold) * 100)) : 100;
  const urdu = lang === "ur" ? "urdu" : "";

  return (
    <div className={`rounded border border-rule bg-white p-3 ${urdu}`} lang={lang}>
      <p className={`text-sm ${unlocked ? "font-medium text-band-care" : "text-ink-soft"}`}>
        {unlocked ? t.freeDeliveryUnlocked : t.freeDeliveryIn(formatPKR(remaining))}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={`h-full transition-[width] duration-300 ${unlocked ? "bg-band-care" : "bg-band-oil"}`} style={{ width: `${unlocked ? 100 : pct}%` }} />
      </div>
      {!unlocked && quote.suggestions.length > 0 ? (
        <ul className={`mt-3 ${compact ? "space-y-2" : "grid gap-2 sm:grid-cols-3"}`}>
          {quote.suggestions.map((s) => (
            <li key={s.variantId} className="flex items-center gap-2 rounded border border-rule p-2 text-xs">
              {s.image ? (
                <Image src={s.image} alt="" width={40} height={40} sizes="40px" className="h-10 w-10 rounded border border-rule bg-white object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.productName}</p>
                <p className="text-ink-soft">
                  {s.variantLabel} · <span className="tabular">{formatPKR(s.pricePaisa)}</span>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  add(
                    {
                      variantId: s.variantId,
                      productSlug: s.productSlug,
                      productName: s.productName,
                      variantLabel: s.variantLabel,
                      sku: s.sku,
                      unitPricePaisa: s.pricePaisa,
                      image: s.image,
                      maxQty: s.stock,
                    },
                    1,
                  );
                  show(lang === "ur" ? "کارٹ میں شامل" : "Added");
                  trackEvent({
                    event: "add_to_cart",
                    eventId: clientEventId("add_to_cart", `${s.sku}:upsell:${Date.now()}`),
                    valuePaisa: s.pricePaisa,
                    items: [{ sku: s.sku, name: `${s.productName} ${s.variantLabel}`, quantity: 1, pricePaisa: s.pricePaisa }],
                  });
                }}
              >
                {lang === "ur" ? "شامل کریں" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/store/cart";
import { useLang } from "@/store/lang";
import { formatPKR } from "@/lib/money";
import { MAX_QTY_PER_LINE } from "@/config/commerce";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { WhatsAppLink } from "@/components/analytics/WhatsAppLink";
import { clientEventId, trackEvent } from "@/lib/analytics/client";
import { STORE_COPY } from "@/lib/i18n/checkout";
import type { Family } from "@/lib/catalog";

export interface PanelVariant {
  id: string;
  sku: string;
  label: string;
  pricePaisa: number;
  compareAtPaisa: number | null;
  stock: number;
  lowStockThreshold: number;
}

export interface SocialProof {
  /** Units sold in the last 30 days on confirmed, shipped or delivered orders. */
  soldLast30Days: number;
  /** Distinct orders in the last 24 hours. */
  orderedToday: number;
}

interface Props {
  product: { slug: string; name: string; family: Family; image: string; url: string };
  variants: PanelVariant[];
  social?: SocialProof;
}

const bandBtn: Record<Family, string> = {
  oils: "btn-band-oil",
  relief: "btn-band-care",
  home: "btn-band-home",
};

const ringClass: Record<Family, string> = {
  oils: "border-band-oil bg-band-oil text-white",
  relief: "border-band-care bg-band-care text-white",
  home: "border-band-home bg-band-home text-white",
};

/** Thresholds below which a real number reads as weak rather than reassuring. */
const MIN_SOLD_TO_SHOW = 10;
const MIN_TODAY_TO_SHOW = 3;

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" />
    </svg>
  );
}

export function PurchasePanel({ product, variants, social }: Props) {
  const lang = useLang((s) => s.lang);
  const t = STORE_COPY[lang];
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstInStock?.id);
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const showAdded = useCart((s) => s.showAdded);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const [showBar, setShowBar] = useState(false);

  const selected = useMemo(() => variants.find((v) => v.id === selectedId) ?? firstInStock, [variants, selectedId, firstInStock]);
  const soldOut = !selected || selected.stock <= 0;
  const maxQty = selected ? Math.min(selected.stock, MAX_QTY_PER_LINE) : 1;
  const lowStock = selected && selected.stock > 0 && selected.stock <= Math.max(1, selected.lowStockThreshold);

  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, Math.max(1, maxQty))));
  }, [maxQty]);

  useEffect(() => {
    const el = mainButtonRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShowBar(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function handleAdd() {
    if (!selected || soldOut) return;
    const line = {
      variantId: selected.id,
      productSlug: product.slug,
      productName: product.name,
      variantLabel: selected.label,
      sku: selected.sku,
      unitPricePaisa: selected.pricePaisa,
      image: product.image,
      maxQty: selected.stock,
    };
    add(line, qty);
    showAdded(line, qty);
    trackEvent({
      event: "add_to_cart",
      eventId: clientEventId("add_to_cart", `${selected.sku}:${Date.now()}`),
      valuePaisa: selected.pricePaisa * qty,
      items: [{ sku: selected.sku, name: `${product.name} ${selected.label}`, quantity: qty, pricePaisa: selected.pricePaisa }],
    });
  }

  /* The WhatsApp message carries everything staff need to book the order
     without a second question: product, size, quantity, price and the link. */
  const waText = selected
    ? lang === "ur"
      ? `السلام علیکم، مجھے یہ آرڈر کرنا ہے:\n${product.name} ${selected.label} × ${qty} (${formatPKR(selected.pricePaisa * qty)})\n${product.url}\nنام:\nشہر:\nپتہ:`
      : `Assalam o Alaikum, I want to order:\n${product.name} ${selected.label} × ${qty} (${formatPKR(selected.pricePaisa * qty)})\n${product.url}\nName:\nCity:\nAddress:`
    : undefined;

  const savePct =
    selected && selected.compareAtPaisa && selected.compareAtPaisa > selected.pricePaisa
      ? Math.round(((selected.compareAtPaisa - selected.pricePaisa) / selected.compareAtPaisa) * 100)
      : 0;

  const priceBlock = selected ? (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="tabular text-2xl font-semibold">{formatPKR(selected.pricePaisa)}</span>
      {savePct > 0 && selected.compareAtPaisa ? (
        <>
          <s className="tabular text-ink-soft">{formatPKR(selected.compareAtPaisa)}</s>
          <span className="rounded bg-band-care/10 px-1.5 py-0.5 text-xs font-medium text-band-care">
            {lang === "ur" ? `${savePct}% بچت` : `Save ${savePct}%`}
          </span>
        </>
      ) : null}
    </div>
  ) : null;

  const urdu = lang === "ur" ? "urdu" : "";

  return (
    <>
      <div className={`space-y-6 ${urdu}`} lang={lang}>
        {priceBlock}

        {variants.length > 1 ? (
          <fieldset>
            <legend className="label">{lang === "ur" ? "سائز" : "Size"}</legend>
            <div role="radiogroup" aria-label="Size" className="flex flex-wrap gap-2">
              {variants.map((v) => {
                const isSelected = v.id === selected?.id;
                const out = v.stock <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={out || undefined}
                    disabled={out}
                    onClick={() => setSelectedId(v.id)}
                    className={`min-h-11 rounded border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected ? ringClass[product.family] : "border-rule bg-white hover:border-ink"
                    }`}
                  >
                    {v.label}
                    {out ? <span className="ml-1.5 text-xs font-normal">{t.soldOut}</span> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-ink-soft">
            {lang === "ur" ? "سائز" : "Size"}: {selected?.label}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper value={qty} max={Math.max(1, maxQty)} onChange={setQty} label="Quantity" />
          <button
            ref={mainButtonRef}
            type="button"
            onClick={handleAdd}
            disabled={soldOut}
            className={`btn flex-1 sm:flex-none sm:min-w-48 ${bandBtn[product.family]}`}
          >
            {soldOut ? t.soldOut : t.addToCart}
          </button>
        </div>
        {!soldOut && waText ? (
          <WhatsAppLink text={waText} className="btn btn-secondary w-full sm:w-auto" target="_blank">
            <WhatsAppGlyph />
            {t.orderOnWhatsApp}
          </WhatsAppLink>
        ) : null}

        <div className="space-y-1 text-sm">
          {lowStock && selected ? <p className="font-medium text-band-oil-ink">{t.onlyLeft(selected.stock)}</p> : null}
          {social && social.orderedToday >= MIN_TODAY_TO_SHOW ? (
            <p className="text-ink-soft">
              {lang === "ur"
                ? `آج ${social.orderedToday} لوگوں نے یہ آرڈر کیا`
                : `Ordered by ${social.orderedToday} people in the last 24 hours`}
            </p>
          ) : social && social.soldLast30Days >= MIN_SOLD_TO_SHOW ? (
            <p className="text-ink-soft">
              {lang === "ur" ? `اس مہینے ${social.soldLast30Days} فروخت ہوئے` : `${social.soldLast30Days} sold in the last 30 days`}
            </p>
          ) : null}
          <p className="text-ink-soft">{t.codLine}</p>
        </div>
      </div>

      {/* Sticky cart bar: the only elevated surface on the site. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper/95 px-4 py-3 shadow-[0_-8px_24px_rgba(23,21,15,0.12)] backdrop-blur-sm transition-transform duration-200 md:hidden ${
          showBar ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!showBar}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {product.name} <span className="text-ink-soft">{selected?.label}</span>
            </p>
            <p className="tabular text-sm">{selected ? formatPKR(selected.pricePaisa * qty) : null}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!soldOut && waText ? (
              <WhatsAppLink
                text={waText}
                target="_blank"
                tabIndex={showBar ? 0 : -1}
                aria-label={t.orderOnWhatsApp}
                className="btn btn-secondary px-3"
              >
                <WhatsAppGlyph />
              </WhatsAppLink>
            ) : null}
            <button
              type="button"
              onClick={handleAdd}
              disabled={soldOut}
              tabIndex={showBar ? 0 : -1}
              className={`btn ${bandBtn[product.family]}`}
            >
              {soldOut ? t.soldOut : t.addToCart}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/store/cart";
import { useToast } from "@/components/ui/Toast";
import { formatPKR } from "@/lib/money";
import { MAX_QTY_PER_LINE } from "@/config/commerce";
import { QuantityStepper } from "@/components/cart/QuantityStepper";
import { clientEventId, trackEvent } from "@/lib/analytics/client";
import type { Family } from "@/lib/catalog";

export interface PanelVariant {
  id: string;
  sku: string;
  label: string;
  pricePaisa: number;
  compareAtPaisa: number | null;
  stock: number;
}

interface Props {
  product: { slug: string; name: string; family: Family; image: string };
  variants: PanelVariant[];
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

export function PurchasePanel({ product, variants }: Props) {
  const firstInStock = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstInStock?.id);
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const show = useToast((s) => s.show);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const [showBar, setShowBar] = useState(false);

  const selected = useMemo(() => variants.find((v) => v.id === selectedId) ?? firstInStock, [variants, selectedId, firstInStock]);
  const soldOut = !selected || selected.stock <= 0;
  const maxQty = selected ? Math.min(selected.stock, MAX_QTY_PER_LINE) : 1;

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
    add(
      {
        variantId: selected.id,
        productSlug: product.slug,
        productName: product.name,
        variantLabel: selected.label,
        sku: selected.sku,
        unitPricePaisa: selected.pricePaisa,
        image: product.image,
        maxQty: selected.stock,
      },
      qty,
    );
    show("Added");
    trackEvent({
      event: "add_to_cart",
      eventId: clientEventId("add_to_cart", `${selected.sku}:${Date.now()}`),
      valuePaisa: selected.pricePaisa * qty,
      items: [{ sku: selected.sku, name: `${product.name} ${selected.label}`, quantity: qty, pricePaisa: selected.pricePaisa }],
    });
  }

  const priceBlock = selected ? (
    <div className="flex items-baseline gap-2">
      <span className="tabular text-2xl font-semibold">{formatPKR(selected.pricePaisa)}</span>
      {selected.compareAtPaisa && selected.compareAtPaisa > selected.pricePaisa ? (
        <s className="tabular text-ink-soft">{formatPKR(selected.compareAtPaisa)}</s>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <div className="space-y-6">
        {priceBlock}

        {variants.length > 1 ? (
          <fieldset>
            <legend className="label">Size</legend>
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
                    {out ? <span className="ml-1.5 text-xs font-normal">Sold out</span> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-ink-soft">Size: {selected?.label}</p>
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
            {soldOut ? "Sold out" : "Add to cart"}
          </button>
        </div>

        {selected && selected.stock > 0 && selected.stock <= 5 ? (
          <p className="text-sm text-band-oil-ink">Only {selected.stock} left.</p>
        ) : null}
        <p className="text-sm text-ink-soft">Cash on delivery. Pay the rider when your order arrives.</p>
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
          <button
            type="button"
            onClick={handleAdd}
            disabled={soldOut}
            tabIndex={showBar ? 0 : -1}
            className={`btn ${bandBtn[product.family]}`}
          >
            {soldOut ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </div>
    </>
  );
}

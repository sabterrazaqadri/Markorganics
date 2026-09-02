"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { formatPKR } from "@/lib/money";
import { PK_CITIES } from "@/lib/cities";
import { ConfirmButton, ErrorNote, useAction } from "./client-ui";
import { VariantPicker, type VariantOption } from "./VariantPicker";
import { convertDraftAction, saveDraftAction } from "@/app/admin/(panel)/drafts/actions";
import { searchEverything } from "@/app/admin/(panel)/search-action";
import type { SearchHit } from "@/lib/admin/search";

export interface DraftLine {
  variantId: string | null;
  productName: string;
  variantLabel: string;
  sku: string;
  productSlug: string;
  unitPriceRupees: number;
  quantity: number;
}

export interface DraftFormValues {
  id?: string;
  customerId: string;
  customerName: string;
  phone: string;
  altPhone: string;
  city: string;
  address: string;
  notes: string;
  internalNote: string;
  lines: DraftLine[];
  deliveryRupees: string;
  discountRupees: string;
  discountReason: string;
  converted: boolean;
}

export const EMPTY_DRAFT: DraftFormValues = {
  customerId: "",
  customerName: "",
  phone: "",
  altPhone: "",
  city: "",
  address: "",
  notes: "",
  internalNote: "",
  lines: [],
  deliveryRupees: "200",
  discountRupees: "0",
  discountReason: "",
  converted: false,
};

/** Phone orders, wholesale and replacements. Drafts never reserve stock. */
export function DraftOrderForm({ initial }: { initial: DraftFormValues }) {
  const router = useRouter();
  const { pending, error, fieldErrors, runAction } = useAction();
  const [form, setForm] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerHits, setCustomerHits] = useState<SearchHit[]>([]);
  const [, startSearch] = useTransition();

  function set<K extends keyof DraftFormValues>(key: K, value: DraftFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const subtotal = form.lines.reduce((n, l) => n + l.unitPriceRupees * l.quantity, 0);
  const total = Math.max(0, subtotal - Number(form.discountRupees || 0) + Number(form.deliveryRupees || 0));

  function addVariant(v: VariantOption) {
    setPicking(false);
    setForm((f) => {
      const idx = f.lines.findIndex((l) => l.variantId === v.variantId);
      if (idx >= 0) {
        return { ...f, lines: f.lines.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + 1 } : l)) };
      }
      return {
        ...f,
        lines: [
          ...f.lines,
          {
            variantId: v.variantId,
            productName: v.productName,
            variantLabel: v.label,
            sku: v.sku,
            productSlug: v.productSlug,
            unitPriceRupees: v.pricePaisa / 100,
            quantity: 1,
          },
        ],
      };
    });
  }

  function payload() {
    return {
      id: form.id,
      customerId: form.customerId,
      customerName: form.customerName,
      phone: form.phone,
      altPhone: form.altPhone,
      city: form.city,
      address: form.address,
      notes: form.notes,
      internalNote: form.internalNote,
      lines: form.lines.map((l) => ({
        variantId: l.variantId,
        productName: l.productName,
        variantLabel: l.variantLabel,
        sku: l.sku,
        productSlug: l.productSlug,
        unitPriceRupees: l.unitPriceRupees,
        quantity: l.quantity,
      })),
      deliveryRupees: form.deliveryRupees,
      discountRupees: form.discountRupees,
      discountReason: form.discountReason,
    };
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runAction(() => saveDraftAction(payload()), {
      success: form.id ? "Draft saved" : "Draft created",
      refresh: false,
      onDone: (data) => {
        router.push(`/admin/drafts/${data.id}`);
        router.refresh();
      },
    });
  }

  const err = (k: string) => (fieldErrors[k] ? <p className="a-err">{fieldErrors[k]}</p> : null);

  return (
    <form onSubmit={onSubmit} className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <ErrorNote message={error} />

        {form.converted ? (
          <p className="rounded border border-[var(--a-border)] bg-[var(--a-ok-bg)] px-2.5 py-2 text-[12px] text-[var(--a-ok)]">
            This draft has already been converted into an order and is now read-only.
          </p>
        ) : null}

        <section className="a-card space-y-3 p-3">
          <h2>Customer</h2>
          <div>
            <label htmlFor="draft-search" className="a-label">
              Find an existing customer
            </label>
            <input
              id="draft-search"
              className="a-input"
              value={customerQuery}
              placeholder="Name or phone"
              disabled={form.converted}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                startSearch(async () => {
                  const hits = await searchEverything(e.target.value);
                  setCustomerHits(hits.filter((h) => h.kind === "customer"));
                });
              }}
            />
            {customerHits.length ? (
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                {customerHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="w-full rounded border border-[var(--a-border)] px-2 py-1 text-left text-[12px]"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          customerId: hit.id,
                          customerName: hit.title,
                          phone: hit.subtitle.split(" · ")[0] ?? f.phone,
                        }));
                        setCustomerHits([]);
                        setCustomerQuery("");
                      }}
                    >
                      {hit.title} <span className="text-[var(--a-soft)]">{hit.subtitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="d-name" className="a-label">
                Name
              </label>
              <input id="d-name" className="a-input" value={form.customerName} disabled={form.converted} onChange={(e) => set("customerName", e.target.value)} />
              {err("customerName")}
            </div>
            <div>
              <label htmlFor="d-phone" className="a-label">
                Mobile number
              </label>
              <input
                id="d-phone"
                className="a-input"
                value={form.phone}
                placeholder="0300 1234567"
                disabled={form.converted}
                onChange={(e) => set("phone", e.target.value)}
              />
              {err("phone")}
            </div>
            <div>
              <label htmlFor="d-alt" className="a-label">
                Alternate number
              </label>
              <input id="d-alt" className="a-input" value={form.altPhone} disabled={form.converted} onChange={(e) => set("altPhone", e.target.value)} />
              {err("altPhone")}
            </div>
            <div>
              <label htmlFor="d-city" className="a-label">
                City
              </label>
              <input id="d-city" className="a-input" list="draft-cities" value={form.city} disabled={form.converted} onChange={(e) => set("city", e.target.value)} />
              <datalist id="draft-cities">
                {PK_CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {err("city")}
            </div>
          </div>
          <div>
            <label htmlFor="d-address" className="a-label">
              Full address
            </label>
            <textarea id="d-address" className="a-textarea" value={form.address} disabled={form.converted} onChange={(e) => set("address", e.target.value)} />
            {err("address")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="d-notes" className="a-label">
                Customer notes
              </label>
              <input id="d-notes" className="a-input" value={form.notes} disabled={form.converted} onChange={(e) => set("notes", e.target.value)} />
            </div>
            <div>
              <label htmlFor="d-internal" className="a-label">
                Internal note
              </label>
              <input id="d-internal" className="a-input" value={form.internalNote} disabled={form.converted} onChange={(e) => set("internalNote", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="a-card">
          <div className="a-card-head">
            <h2>Items</h2>
            {!form.converted ? (
              <button type="button" className="a-btn a-btn-xs" onClick={() => setPicking(true)}>
                Add a line
              </button>
            ) : null}
          </div>
          {form.lines.length === 0 ? (
            <p className="p-3 text-[12px] text-[var(--a-soft)]">No items yet. Add at least one before converting.</p>
          ) : (
            <div className="a-scroll">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="a-num" style={{ width: 80 }}>
                      Qty
                    </th>
                    <th className="a-num" style={{ width: 110 }}>
                      Unit Rs
                    </th>
                    <th className="a-num">Line</th>
                    <th style={{ width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, i) => (
                    <tr key={`${line.variantId}-${i}`}>
                      <td>
                        {line.productName} <span className="text-[var(--a-soft)]">{line.variantLabel}</span>
                      </td>
                      <td className="a-mono text-[var(--a-soft)]">{line.sku}</td>
                      <td className="a-num">
                        <input
                          className="a-input a-input-xs text-right"
                          type="number"
                          min={1}
                          aria-label={`Quantity for ${line.productName}`}
                          value={line.quantity}
                          disabled={form.converted}
                          onChange={(e) =>
                            set("lines", form.lines.map((l, idx) => (idx === i ? { ...l, quantity: Number(e.target.value) } : l)))
                          }
                        />
                      </td>
                      <td className="a-num">
                        <input
                          className="a-input a-input-xs text-right"
                          type="number"
                          min={0}
                          step="0.01"
                          aria-label={`Unit price for ${line.productName}`}
                          value={line.unitPriceRupees}
                          disabled={form.converted}
                          onChange={(e) =>
                            set("lines", form.lines.map((l, idx) => (idx === i ? { ...l, unitPriceRupees: Number(e.target.value) } : l)))
                          }
                        />
                      </td>
                      <td className="a-num">{formatPKR(Math.round(line.unitPriceRupees * line.quantity * 100))}</td>
                      <td>
                        {!form.converted ? (
                          <button
                            type="button"
                            className="a-btn-link text-[var(--a-danger)]"
                            onClick={() => set("lines", form.lines.filter((_, idx) => idx !== i))}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <VariantPicker open={picking} onClose={() => setPicking(false)} onPick={addVariant} />
        </section>
      </div>

      <div className="space-y-3">
        <section className="a-card space-y-2 p-3">
          <h2>Totals</h2>
          <div>
            <label htmlFor="d-delivery" className="a-label">
              Delivery (Rs)
            </label>
            <input
              id="d-delivery"
              className="a-input"
              type="number"
              min={0}
              step="0.01"
              value={form.deliveryRupees}
              disabled={form.converted}
              onChange={(e) => set("deliveryRupees", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="d-discount" className="a-label">
              Discount (Rs)
            </label>
            <input
              id="d-discount"
              className="a-input"
              type="number"
              min={0}
              step="0.01"
              value={form.discountRupees}
              disabled={form.converted}
              onChange={(e) => set("discountRupees", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="d-reason" className="a-label">
              Discount label
            </label>
            <input
              id="d-reason"
              className="a-input"
              value={form.discountReason}
              disabled={form.converted}
              onChange={(e) => set("discountReason", e.target.value)}
            />
          </div>

          <dl className="space-y-1 border-t border-[var(--a-border)] pt-2 text-[12.5px]">
            <div className="flex justify-between">
              <dt className="text-[var(--a-soft)]">Subtotal</dt>
              <dd className="a-num">{formatPKR(Math.round(subtotal * 100))}</dd>
            </div>
            <div className="flex justify-between text-[var(--a-ok)]">
              <dt>Discount</dt>
              <dd className="a-num">-{formatPKR(Math.round(Number(form.discountRupees || 0) * 100))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--a-soft)]">Delivery</dt>
              <dd className="a-num">{formatPKR(Math.round(Number(form.deliveryRupees || 0) * 100))}</dd>
            </div>
            <div className="flex justify-between border-t border-[var(--a-border)] pt-1 text-[14px] font-semibold">
              <dt>Collect on delivery</dt>
              <dd className="a-num">{formatPKR(Math.round(total * 100))}</dd>
            </div>
          </dl>

          {!form.converted ? (
            <>
              <button type="submit" className="a-btn a-btn-primary w-full" disabled={pending}>
                {pending ? "Saving…" : form.id ? "Save draft" : "Create draft"}
              </button>
              {form.id ? (
                <ConfirmButton
                  className="a-btn w-full"
                  confirmLabel="Yes, create the order and take stock"
                  disabled={pending || form.lines.length === 0}
                  onConfirm={() =>
                    runAction(() => convertDraftAction(form.id!), {
                      success: "Order created",
                      refresh: false,
                      onDone: (data) => {
                        router.push(`/admin/orders/${data.orderId}`);
                        router.refresh();
                      },
                    })
                  }
                >
                  Convert to an order
                </ConfirmButton>
              ) : null}
              <p className="a-hint">Drafts do not reserve stock. Stock is taken at the moment you convert.</p>
            </>
          ) : null}
        </section>
      </div>
    </form>
  );
}

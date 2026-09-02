"use client";

import { useState } from "react";
import { formatPKR } from "@/lib/money";
import { Card } from "./ui";
import { ErrorNote, useAction } from "./client-ui";
import { editOrderAction, type EditLineInput } from "@/app/admin/(panel)/orders/actions";
import { VariantPicker, type VariantOption } from "./VariantPicker";

export interface EditorLine extends EditLineInput {
  unitPriceRupees: number;
  quantity: number;
}

const rupees = (v: number | string) => (typeof v === "number" ? v : Number(v) || 0);

export function OrderEditor({
  orderId,
  items,
  deliveryRupees,
  discountRupees,
  discountReason,
}: {
  orderId: string;
  items: EditorLine[];
  deliveryRupees: number;
  discountRupees: number;
  discountReason: string;
}) {
  const { pending, error, fieldErrors, runAction } = useAction();
  const [lines, setLines] = useState<EditorLine[]>(items);
  const [delivery, setDelivery] = useState(String(deliveryRupees));
  const [discount, setDiscount] = useState(String(discountRupees));
  const [reason, setReason] = useState(discountReason);
  const [why, setWhy] = useState("");
  const [picking, setPicking] = useState(false);

  const subtotal = lines.reduce((n, l) => n + rupees(l.unitPriceRupees) * rupees(l.quantity), 0);
  const total = Math.max(0, subtotal - rupees(discount) + rupees(delivery));
  const originalTotal =
    items.reduce((n, l) => n + l.unitPriceRupees * l.quantity, 0) - discountRupees + deliveryRupees;
  const dirty =
    JSON.stringify(lines) !== JSON.stringify(items) ||
    rupees(delivery) !== deliveryRupees ||
    rupees(discount) !== discountRupees ||
    reason !== discountReason;

  function patch(index: number, next: Partial<EditorLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...next } : l)));
  }

  function addVariant(v: VariantOption) {
    setPicking(false);
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.variantId === v.variantId);
      if (existing >= 0) {
        return prev.map((l, i) => (i === existing ? { ...l, quantity: rupees(l.quantity) + 1 } : l));
      }
      return [
        ...prev,
        {
          variantId: v.variantId,
          productName: v.productName,
          variantLabel: v.label,
          sku: v.sku,
          productSlug: v.productSlug,
          unitPriceRupees: v.pricePaisa / 100,
          quantity: 1,
        },
      ];
    });
  }

  function save() {
    runAction(
      () =>
        editOrderAction({
          orderId,
          lines: lines.map((l) => ({ ...l, unitPriceRupees: rupees(l.unitPriceRupees), quantity: rupees(l.quantity) })),
          deliveryRupees: rupees(delivery),
          discountRupees: rupees(discount),
          discountReason: reason || undefined,
          reason: why || undefined,
        }),
      { success: "Order updated", onDone: () => setWhy("") },
    );
  }

  return (
    <Card
      title="Items"
      actions={
        <button type="button" className="a-btn a-btn-xs" onClick={() => setPicking(true)}>
          Add a line
        </button>
      }
    >
      <div className="p-3">
        <ErrorNote message={error} />
        <p className="a-hint mb-2">
          Editing an order moves stock the opposite way and records a timeline entry. Only orders that have not shipped
          can be edited.
        </p>
      </div>

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
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={line.id ?? `new-${i}`}>
                <td>
                  {line.productName} <span className="text-[var(--a-soft)]">{line.variantLabel}</span>
                  {fieldErrors[`lines.${i}.quantity`] ? (
                    <span className="a-err block">{fieldErrors[`lines.${i}.quantity`]}</span>
                  ) : null}
                </td>
                <td className="a-mono text-[var(--a-soft)]">{line.sku}</td>
                <td className="a-num">
                  <input
                    className="a-input a-input-xs text-right"
                    type="number"
                    min={1}
                    max={500}
                    aria-label={`Quantity for ${line.productName}`}
                    value={line.quantity}
                    onChange={(e) => patch(i, { quantity: Number(e.target.value) })}
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
                    onChange={(e) => patch(i, { unitPriceRupees: Number(e.target.value) })}
                  />
                </td>
                <td className="a-num">{formatPKR(Math.round(rupees(line.unitPriceRupees) * rupees(line.quantity) * 100))}</td>
                <td>
                  <button
                    type="button"
                    className="a-btn-link text-[var(--a-danger)]"
                    aria-label={`Remove ${line.productName}`}
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 border-t border-[var(--a-border)] p-3 sm:grid-cols-2">
        <div className="space-y-2">
          <div>
            <label htmlFor="edit-delivery" className="a-label">
              Delivery fee (Rs)
            </label>
            <input
              id="edit-delivery"
              className="a-input"
              type="number"
              min={0}
              step="0.01"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="edit-discount" className="a-label">
              Manual discount (Rs)
            </label>
            <input
              id="edit-discount"
              className="a-input"
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="edit-reason" className="a-label">
              Discount label
            </label>
            <input
              id="edit-reason"
              className="a-input"
              value={reason}
              maxLength={120}
              placeholder="e.g. Goodwill for late delivery"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <dl className="space-y-1 text-[12.5px]">
          <div className="flex justify-between">
            <dt className="text-[var(--a-soft)]">Subtotal</dt>
            <dd className="a-num">{formatPKR(Math.round(subtotal * 100))}</dd>
          </div>
          <div className="flex justify-between text-[var(--a-ok)]">
            <dt>Discount</dt>
            <dd className="a-num">-{formatPKR(Math.round(rupees(discount) * 100))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--a-soft)]">Delivery</dt>
            <dd className="a-num">{formatPKR(Math.round(rupees(delivery) * 100))}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--a-border)] pt-1 text-[14px] font-semibold">
            <dt>Collect on delivery</dt>
            <dd className="a-num">{formatPKR(Math.round(total * 100))}</dd>
          </div>
          {dirty ? (
            <p className="a-hint">
              Was {formatPKR(Math.round(originalTotal * 100))}, will become {formatPKR(Math.round(total * 100))}.
            </p>
          ) : null}
        </dl>
      </div>

      {dirty ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-[var(--a-border)] p-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="edit-why" className="a-label">
              Why (goes on the timeline)
            </label>
            <input
              id="edit-why"
              className="a-input"
              value={why}
              maxLength={200}
              placeholder="Customer asked to add a bottle"
              onChange={(e) => setWhy(e.target.value)}
            />
          </div>
          <button type="button" className="a-btn a-btn-primary" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            className="a-btn"
            onClick={() => {
              setLines(items);
              setDelivery(String(deliveryRupees));
              setDiscount(String(discountRupees));
              setReason(discountReason);
            }}
          >
            Discard
          </button>
        </div>
      ) : null}

      <VariantPicker open={picking} onClose={() => setPicking(false)} onPick={addVariant} />
    </Card>
  );
}

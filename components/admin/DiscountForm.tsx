"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { DiscountType } from "@/lib/db/schema";
import { ErrorNote, useAction } from "./client-ui";
import { discountOptionsAction, saveDiscountAction } from "@/app/admin/(panel)/discounts/actions";

export interface DiscountFormValues {
  id?: string;
  title: string;
  method: "code" | "automatic";
  code: string;
  type: DiscountType;
  percentage: string;
  amountRupees: string;
  appliesTo: "order" | "products" | "collections";
  targetProductIds: string[];
  targetCollectionIds: string[];
  buyProductIds: string[];
  getProductIds: string[];
  buyQuantity: string;
  getQuantity: string;
  getDiscountPercent: string;
  minSubtotalRupees: string;
  minQuantity: string;
  firstTimeOnly: boolean;
  segmentId: string;
  usageLimit: string;
  oncePerCustomer: boolean;
  startsAt: string;
  endsAt: string;
  isEnabled: boolean;
}

export const EMPTY_DISCOUNT: DiscountFormValues = {
  title: "",
  method: "code",
  code: "",
  type: "percentage",
  percentage: "10",
  amountRupees: "0",
  appliesTo: "order",
  targetProductIds: [],
  targetCollectionIds: [],
  buyProductIds: [],
  getProductIds: [],
  buyQuantity: "2",
  getQuantity: "1",
  getDiscountPercent: "100",
  minSubtotalRupees: "0",
  minQuantity: "0",
  firstTimeOnly: false,
  segmentId: "",
  usageLimit: "",
  oncePerCustomer: false,
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: "",
  isEnabled: true,
};

const TYPE_LABEL: Record<DiscountType, string> = {
  percentage: "Percentage off",
  fixed_amount: "Fixed amount off",
  free_delivery: "Free delivery",
  buy_x_get_y: "Buy X get Y",
};

function MultiSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="a-label">
        {label}
      </label>
      <select
        id={id}
        className="a-select"
        multiple
        size={Math.min(8, Math.max(3, options.length))}
        value={value}
        onChange={(e) => onChange([...e.target.selectedOptions].map((o) => o.value))}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="a-hint">Ctrl or Cmd click to pick several.</p>
    </div>
  );
}

export function DiscountForm({ initial }: { initial: DiscountFormValues }) {
  const router = useRouter();
  const { pending, error, fieldErrors, runAction } = useAction();
  const [form, setForm] = useState(initial);
  const [options, setOptions] = useState<{
    products: { id: string; name: string }[];
    collections: { id: string; title: string }[];
    segments: { id: string; name: string }[];
  }>({ products: [], collections: [], segments: [] });

  useEffect(() => {
    discountOptionsAction().then(setOptions);
  }, []);

  function set<K extends keyof DiscountFormValues>(key: K, value: DiscountFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runAction(() => saveDiscountAction(form), {
      success: form.id ? "Discount saved" : "Discount created",
      refresh: false,
      onDone: (data) => {
        router.push(`/admin/discounts/${data.id}`);
        router.refresh();
      },
    });
  }

  const productOptions = options.products.map((p) => ({ id: p.id, label: p.name }));

  return (
    <form onSubmit={onSubmit} className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        <ErrorNote message={error} />

        <section className="a-card space-y-3 p-3">
          <h2>Basics</h2>
          <div>
            <label htmlFor="d-title" className="a-label">
              Title (internal)
            </label>
            <input id="d-title" className="a-input" value={form.title} onChange={(e) => set("title", e.target.value)} />
            {fieldErrors.title ? <p className="a-err">{fieldErrors.title}</p> : null}
          </div>

          <div className="flex gap-4">
            {(["code", "automatic"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5 text-[12.5px]">
                <input type="radio" name="method" checked={form.method === m} onChange={() => set("method", m)} />
                {m === "code" ? "Customer enters a code" : "Applied automatically"}
              </label>
            ))}
          </div>

          {form.method === "code" ? (
            <div>
              <label htmlFor="d-code" className="a-label">
                Discount code
              </label>
              <input
                id="d-code"
                className="a-input uppercase"
                value={form.code}
                maxLength={40}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
              />
              {fieldErrors.code ? <p className="a-err">{fieldErrors.code}</p> : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="d-type" className="a-label">
                Type
              </label>
              <select id="d-type" className="a-select" value={form.type} onChange={(e) => set("type", e.target.value as DiscountType)}>
                {(Object.keys(TYPE_LABEL) as DiscountType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            {form.type === "percentage" ? (
              <div>
                <label htmlFor="d-percentage" className="a-label">
                  Percent off
                </label>
                <input
                  id="d-percentage"
                  className="a-input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.percentage}
                  onChange={(e) => set("percentage", e.target.value)}
                />
                {fieldErrors.percentage ? <p className="a-err">{fieldErrors.percentage}</p> : null}
              </div>
            ) : null}

            {form.type === "fixed_amount" ? (
              <div>
                <label htmlFor="d-amount" className="a-label">
                  Amount off (Rs)
                </label>
                <input
                  id="d-amount"
                  className="a-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amountRupees}
                  onChange={(e) => set("amountRupees", e.target.value)}
                />
                {fieldErrors.amountRupees ? <p className="a-err">{fieldErrors.amountRupees}</p> : null}
              </div>
            ) : null}
          </div>

          {form.type === "buy_x_get_y" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="d-buy" className="a-label">
                  Buy quantity
                </label>
                <input id="d-buy" className="a-input" type="number" min={1} value={form.buyQuantity} onChange={(e) => set("buyQuantity", e.target.value)} />
                {fieldErrors.buyQuantity ? <p className="a-err">{fieldErrors.buyQuantity}</p> : null}
              </div>
              <div>
                <label htmlFor="d-get" className="a-label">
                  Get quantity
                </label>
                <input id="d-get" className="a-input" type="number" min={1} value={form.getQuantity} onChange={(e) => set("getQuantity", e.target.value)} />
              </div>
              <div>
                <label htmlFor="d-getpct" className="a-label">
                  Discount on the free units (%)
                </label>
                <input
                  id="d-getpct"
                  className="a-input"
                  type="number"
                  min={0}
                  max={100}
                  value={form.getDiscountPercent}
                  onChange={(e) => set("getDiscountPercent", e.target.value)}
                />
              </div>
              <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2">
                <MultiSelect
                  id="d-buy-products"
                  label="Qualifying products (blank means anything eligible)"
                  options={productOptions}
                  value={form.buyProductIds}
                  onChange={(v) => set("buyProductIds", v)}
                />
                <MultiSelect
                  id="d-get-products"
                  label="Discounted products"
                  options={productOptions}
                  value={form.getProductIds}
                  onChange={(v) => set("getProductIds", v)}
                />
              </div>
            </div>
          ) : null}
        </section>

        <section className="a-card space-y-3 p-3">
          <h2>Applies to</h2>
          <div className="flex flex-wrap gap-4">
            {(["order", "products", "collections"] as const).map((a) => (
              <label key={a} className="flex items-center gap-1.5 text-[12.5px]">
                <input type="radio" name="appliesTo" checked={form.appliesTo === a} onChange={() => set("appliesTo", a)} />
                {a === "order" ? "Entire order" : a === "products" ? "Specific products" : "Specific collections"}
              </label>
            ))}
          </div>
          {form.appliesTo === "products" ? (
            <MultiSelect
              id="d-products"
              label="Products"
              options={productOptions}
              value={form.targetProductIds}
              onChange={(v) => set("targetProductIds", v)}
            />
          ) : null}
          {form.appliesTo === "collections" ? (
            <MultiSelect
              id="d-collections"
              label="Collections"
              options={options.collections.map((c) => ({ id: c.id, label: c.title }))}
              value={form.targetCollectionIds}
              onChange={(v) => set("targetCollectionIds", v)}
            />
          ) : null}
        </section>

        <section className="a-card space-y-3 p-3">
          <h2>Conditions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="d-minsub" className="a-label">
                Minimum order value (Rs)
              </label>
              <input
                id="d-minsub"
                className="a-input"
                type="number"
                min={0}
                value={form.minSubtotalRupees}
                onChange={(e) => set("minSubtotalRupees", e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="d-minqty" className="a-label">
                Minimum quantity
              </label>
              <input
                id="d-minqty"
                className="a-input"
                type="number"
                min={0}
                value={form.minQuantity}
                onChange={(e) => set("minQuantity", e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={form.firstTimeOnly} onChange={(e) => set("firstTimeOnly", e.target.checked)} />
            First-time customers only
          </label>
          <div>
            <label htmlFor="d-segment" className="a-label">
              Limit to a customer segment
            </label>
            <select id="d-segment" className="a-select" value={form.segmentId} onChange={(e) => set("segmentId", e.target.value)}>
              <option value="">Everyone</option>
              {options.segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="a-card space-y-3 p-3">
          <h2>Limits</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="d-limit" className="a-label">
                Total uses (blank means unlimited)
              </label>
              <input
                id="d-limit"
                className="a-input"
                type="number"
                min={1}
                value={form.usageLimit}
                onChange={(e) => set("usageLimit", e.target.value)}
              />
            </div>
            <label className="flex items-end gap-2 pb-1.5 text-[12.5px]">
              <input type="checkbox" checked={form.oncePerCustomer} onChange={(e) => set("oncePerCustomer", e.target.checked)} />
              One use per phone number
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="d-start" className="a-label">
                Starts
              </label>
              <input id="d-start" className="a-input" type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </div>
            <div>
              <label htmlFor="d-end" className="a-label">
                Ends (optional)
              </label>
              <input id="d-end" className="a-input" type="date" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-3">
        <section className="a-card space-y-2 p-3">
          <h2>Status</h2>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={form.isEnabled} onChange={(e) => set("isEnabled", e.target.checked)} />
            Enabled
          </label>
          <p className="a-hint">
            The amount is always recalculated on the server inside the order transaction. Nothing the browser sends is
            trusted.
          </p>
          <button type="submit" className="a-btn a-btn-primary w-full" disabled={pending}>
            {pending ? "Saving…" : form.id ? "Save discount" : "Create discount"}
          </button>
        </section>
      </div>
    </form>
  );
}

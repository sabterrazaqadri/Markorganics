"use client";

import { useState, type FormEvent } from "react";
import type { CityRate, DeliverySettings, StoreSettings } from "@/lib/settings";
import { PK_CITIES } from "@/lib/cities";
import { formatPKR } from "@/lib/money";
import { Card } from "./ui";
import { ErrorNote, useAction } from "./client-ui";
import { saveDeliverySettingsAction, saveStoreSettingsAction, saveTemplateAction } from "@/app/admin/(panel)/settings/actions";

export function StoreSettingsForm({ initial, canWrite }: { initial: StoreSettings; canWrite: boolean }) {
  const { pending, error, fieldErrors, runAction } = useAction();
  const [form, setForm] = useState(initial);

  function set<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runAction(() => saveStoreSettingsAction(form), { success: "Store settings saved" });
  }

  return (
    <form onSubmit={onSubmit}>
      <Card title="Store details">
        <div className="grid gap-3 p-3 sm:grid-cols-2">
          <ErrorNote message={error} />
          <div>
            <label htmlFor="s-name" className="a-label">
              Store name
            </label>
            <input id="s-name" className="a-input" value={form.name} disabled={!canWrite} onChange={(e) => set("name", e.target.value)} />
            {fieldErrors.name ? <p className="a-err">{fieldErrors.name}</p> : null}
          </div>
          <div>
            <label htmlFor="s-phone" className="a-label">
              Contact phone
            </label>
            <input id="s-phone" className="a-input" value={form.contactPhone} disabled={!canWrite} onChange={(e) => set("contactPhone", e.target.value)} />
          </div>
          <div>
            <label htmlFor="s-email" className="a-label">
              Contact email
            </label>
            <input id="s-email" className="a-input" type="email" value={form.contactEmail} disabled={!canWrite} onChange={(e) => set("contactEmail", e.target.value)} />
            {fieldErrors.contactEmail ? <p className="a-err">{fieldErrors.contactEmail}</p> : null}
          </div>
          <div>
            <label htmlFor="s-prefix" className="a-label">
              Order number prefix
            </label>
            <input
              id="s-prefix"
              className="a-input"
              value={form.orderNumberPrefix}
              disabled={!canWrite}
              onChange={(e) => set("orderNumberPrefix", e.target.value.toUpperCase())}
            />
            <p className="a-hint">New orders become {form.orderNumberPrefix}ABC123. Existing numbers never change.</p>
            {fieldErrors.orderNumberPrefix ? <p className="a-err">{fieldErrors.orderNumberPrefix}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="s-address" className="a-label">
              Business address
            </label>
            <textarea id="s-address" className="a-textarea" value={form.address} disabled={!canWrite} onChange={(e) => set("address", e.target.value)} />
            <p className="a-hint">Printed on packing slips.</p>
          </div>
          <div>
            <label htmlFor="s-currency" className="a-label">
              Currency
            </label>
            <input id="s-currency" className="a-input" value={form.currency} disabled onChange={() => {}} />
            <p className="a-hint">Cash on delivery in Pakistani rupees only.</p>
          </div>
          <div>
            <label htmlFor="s-tz" className="a-label">
              Timezone
            </label>
            <input id="s-tz" className="a-input" value={form.timezone} disabled onChange={() => {}} />
            <p className="a-hint">Every date in the admin is shown in Asia/Karachi.</p>
          </div>
        </div>
        {canWrite ? (
          <div className="border-t border-[var(--a-border)] p-3">
            <button type="submit" className="a-btn a-btn-primary" disabled={pending}>
              {pending ? "Saving…" : "Save store details"}
            </button>
          </div>
        ) : null}
      </Card>
    </form>
  );
}

/* ------------------------------------------------------------- delivery */

export function DeliverySettingsForm({ initial, canWrite }: { initial: DeliverySettings; canWrite: boolean }) {
  const { pending, error, runAction } = useAction();
  const [flat, setFlat] = useState(String(initial.flatRatePaisa / 100));
  const [threshold, setThreshold] = useState(String(initial.freeThresholdPaisa / 100));
  const [cityRates, setCityRates] = useState<CityRate[]>(initial.cityRates);
  const [blocked, setBlocked] = useState<string[]>(initial.blockedCities);
  const [newCity, setNewCity] = useState("");
  const [newFee, setNewFee] = useState("");
  const [newBlocked, setNewBlocked] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    runAction(
      () =>
        saveDeliverySettingsAction({
          flatRateRupees: flat,
          freeThresholdRupees: threshold,
          cityRates: cityRates.map((r) => ({ city: r.city, feeRupees: r.feePaisa / 100 })),
          blockedCities: blocked,
        }),
      { success: "Delivery settings saved" },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <ErrorNote message={error} />

      <Card title="Rates">
        <div className="grid gap-3 p-3 sm:grid-cols-2">
          <div>
            <label htmlFor="d-flat" className="a-label">
              Flat delivery rate (Rs)
            </label>
            <input id="d-flat" className="a-input" type="number" min={0} value={flat} disabled={!canWrite} onChange={(e) => setFlat(e.target.value)} />
          </div>
          <div>
            <label htmlFor="d-threshold" className="a-label">
              Free delivery at or above (Rs)
            </label>
            <input
              id="d-threshold"
              className="a-input"
              type="number"
              min={0}
              value={threshold}
              disabled={!canWrite}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
        </div>
        <p className="a-hint px-3 pb-3">
          The storefront, the cart and the order transaction all read these. config/commerce.ts stays the fallback if
          the row is missing.
        </p>
      </Card>

      <Card title="Per-city rates">
        <div className="p-3">
          {cityRates.length === 0 ? (
            <p className="text-[12px] text-[var(--a-soft)]">No overrides. Every city pays the flat rate.</p>
          ) : (
            <ul className="mb-2 space-y-1">
              {cityRates.map((r, i) => (
                <li key={r.city} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-[140px]">{r.city}</span>
                  <span className="a-num min-w-[80px]">{formatPKR(r.feePaisa)}</span>
                  {canWrite ? (
                    <button
                      type="button"
                      className="a-btn-link text-[var(--a-danger)]"
                      onClick={() => setCityRates(cityRates.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canWrite ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="d-city" className="a-label">
                  City
                </label>
                <input id="d-city" className="a-input" list="rate-cities" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                <datalist id="rate-cities">
                  {PK_CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="d-fee" className="a-label">
                  Fee (Rs)
                </label>
                <input id="d-fee" className="a-input" type="number" min={0} value={newFee} onChange={(e) => setNewFee(e.target.value)} />
              </div>
              <button
                type="button"
                className="a-btn"
                disabled={!newCity.trim() || newFee === ""}
                onClick={() => {
                  setCityRates([
                    ...cityRates.filter((r) => r.city.toLowerCase() !== newCity.trim().toLowerCase()),
                    { city: newCity.trim(), feePaisa: Math.round(Number(newFee) * 100) },
                  ]);
                  setNewCity("");
                  setNewFee("");
                }}
              >
                Add rate
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="Cities we do not deliver to">
        <div className="p-3">
          {blocked.length === 0 ? (
            <p className="text-[12px] text-[var(--a-soft)]">Delivering everywhere.</p>
          ) : (
            <ul className="mb-2 flex flex-wrap gap-1">
              {blocked.map((c) => (
                <li key={c} className="a-tag">
                  {c}
                  {canWrite ? (
                    <button
                      type="button"
                      aria-label={`Allow ${c} again`}
                      className="text-[var(--a-danger)]"
                      onClick={() => setBlocked(blocked.filter((x) => x !== c))}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canWrite ? (
            <div className="flex items-end gap-2">
              <div>
                <label htmlFor="d-block" className="a-label">
                  Add a city
                </label>
                <input id="d-block" className="a-input" list="rate-cities" value={newBlocked} onChange={(e) => setNewBlocked(e.target.value)} />
              </div>
              <button
                type="button"
                className="a-btn"
                disabled={!newBlocked.trim()}
                onClick={() => {
                  const city = newBlocked.trim();
                  if (!blocked.some((c) => c.toLowerCase() === city.toLowerCase())) setBlocked([...blocked, city]);
                  setNewBlocked("");
                }}
              >
                Block city
              </button>
            </div>
          ) : null}
          <p className="a-hint">Checkout refuses an order to a blocked city with a clear message.</p>
        </div>
      </Card>

      {canWrite ? (
        <button type="submit" className="a-btn a-btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save delivery settings"}
        </button>
      ) : null}
    </form>
  );
}

/* -------------------------------------------------------- notifications */

export interface TemplateRow {
  key: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
  isEnabled: boolean;
}

const PLACEHOLDERS = ["{{customer_name}}", "{{order_number}}", "{{total}}", "{{city}}", "{{status}}", "{{store_name}}"];

/** Templates are stored and previewed only. Nothing is ever sent from here. */
export function TemplateForm({ template, canWrite }: { template: TemplateRow; canWrite: boolean }) {
  const { pending, error, runAction } = useAction();
  const [form, setForm] = useState(template);

  const preview = form.body
    .replace(/\{\{customer_name\}\}/g, "Ayesha Khan")
    .replace(/\{\{order_number\}\}/g, "MRK-7HQ2XF")
    .replace(/\{\{total\}\}/g, "Rs 1,450")
    .replace(/\{\{city\}\}/g, "Karachi")
    .replace(/\{\{status\}\}/g, "confirmed")
    .replace(/\{\{store_name\}\}/g, "MARKORGANICS");

  return (
    <Card title={template.name}>
      <div className="space-y-2 p-3">
        <ErrorNote message={error} />
        <div className="flex items-center gap-3">
          <span className="a-badge a-badge-neutral">{form.channel}</span>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={form.isEnabled}
              disabled={!canWrite}
              onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
            />
            Marked ready to send
          </label>
        </div>
        <div>
          <label htmlFor={`t-subject-${form.key}`} className="a-label">
            Subject or title
          </label>
          <input
            id={`t-subject-${form.key}`}
            className="a-input"
            value={form.subject}
            disabled={!canWrite}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor={`t-body-${form.key}`} className="a-label">
            Message
          </label>
          <textarea
            id={`t-body-${form.key}`}
            className="a-textarea"
            value={form.body}
            disabled={!canWrite}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          <p className="a-hint">
            Placeholders: {PLACEHOLDERS.map((p) => <code key={p} className="a-mono mr-1">{p}</code>)}
          </p>
        </div>
        <div className="rounded border border-[var(--a-border)] bg-[var(--a-surface-2)] p-2">
          <p className="a-label mb-1">Preview</p>
          <p className="whitespace-pre-wrap text-[12.5px]">{preview || "Nothing to preview yet."}</p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className="a-btn a-btn-primary"
            disabled={pending}
            onClick={() => runAction(() => saveTemplateAction(form), { success: "Template saved" })}
          >
            {pending ? "Saving…" : "Save template"}
          </button>
        ) : null}
      </div>
    </Card>
  );
}

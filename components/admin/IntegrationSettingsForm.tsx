"use client";

import { useState, type FormEvent } from "react";
import type { IntegrationSettings } from "@/lib/settings";
import { WHATSAPP_TRIGGERS, WHATSAPP_TRIGGER_LABEL } from "@/config/whatsapp";
import { Card } from "./ui";
import { ErrorNote, useAction } from "./client-ui";
import { saveIntegrationSettingsAction } from "@/app/admin/(panel)/integrations/actions";

/**
 * The switches that apply across every provider — most importantly the global
 * dry-run, which is the one control that guarantees nothing real happens.
 */
export function IntegrationSettingsForm({
  initial,
  couriers,
  canWrite,
}: {
  initial: IntegrationSettings;
  couriers: { id: string; name: string; verified: boolean }[];
  canWrite: boolean;
}) {
  const { pending, error, runAction } = useAction();
  const [form, setForm] = useState(initial);

  function set<K extends keyof IntegrationSettings>(key: K, value: IntegrationSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    runAction(
      () =>
        saveIntegrationSettingsAction({
          dryRun: form.dryRun,
          defaultCourier: form.defaultCourier,
          restockOnReturn: form.restockOnReturn,
          codRemittanceDays: form.codRemittanceDays,
          abandonedDelayHours: form.abandonedDelayHours,
          consentBanner: form.consentBanner,
          whatsappTriggers: form.whatsappTriggers,
        }),
      { success: "Integration settings saved" },
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <ErrorNote message={error} />

      <Card title="Global">
        <div className="space-y-3 p-3">
          <label className="flex items-start gap-2 text-[12.5px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.dryRun}
              disabled={!canWrite}
              onChange={(e) => set("dryRun", e.target.checked)}
            />
            <span>
              <strong>Dry run everything.</strong>
              <span className="block text-[var(--a-soft)]">
                Every outbound call is logged in full and answered with a realistic fake. No parcel is booked, no
                message is sent, no event reaches an ad platform. Turn this off only when you are ready for real
                traffic.
              </span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="i-courier" className="a-label">
                Default courier
              </label>
              <select
                id="i-courier"
                className="a-select"
                value={form.defaultCourier}
                disabled={!canWrite}
                onChange={(e) => set("defaultCourier", e.target.value)}
              >
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.verified ? "" : " (unverified)"}
                  </option>
                ))}
              </select>
              <p className="a-hint">Pre-selected on the order page. You can still pick another per order.</p>
            </div>
            <div>
              <label htmlFor="i-cod-days" className="a-label">
                Flag unpaid COD after (days)
              </label>
              <input
                id="i-cod-days"
                type="number"
                min={1}
                max={120}
                className="a-input"
                value={form.codRemittanceDays}
                disabled={!canWrite}
                onChange={(e) => set("codRemittanceDays", Number(e.target.value))}
              />
              <p className="a-hint">Delivered this long ago with nothing remitted shows on the COD page.</p>
            </div>
            <div>
              <label htmlFor="i-abandoned" className="a-label">
                Abandoned checkout follow-up after (hours)
              </label>
              <input
                id="i-abandoned"
                type="number"
                min={1}
                max={168}
                className="a-input"
                value={form.abandonedDelayHours}
                disabled={!canWrite}
                onChange={(e) => set("abandonedDelayHours", Number(e.target.value))}
              />
              <p className="a-hint">Cancelled automatically if the customer orders in the meantime.</p>
            </div>
          </div>

          <label className="flex items-start gap-2 text-[12.5px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.restockOnReturn}
              disabled={!canWrite}
              onChange={(e) => set("restockOnReturn", e.target.checked)}
            />
            <span>
              <strong>Restock automatically on a courier return.</strong>
              <span className="block text-[var(--a-soft)]">
                Off if you would rather inspect returned parcels before the stock counts again.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-[12.5px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.consentBanner}
              disabled={!canWrite}
              onChange={(e) => set("consentBanner", e.target.checked)}
            />
            <span>
              <strong>Ask for cookie consent before loading pixels.</strong>
              <span className="block text-[var(--a-soft)]">
                Server-side purchase events still fire either way — that is the shop&rsquo;s record of its own sale.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card title="WhatsApp triggers">
        <div className="space-y-2 p-3">
          <p className="text-[12px] text-[var(--a-soft)]">
            Each one still needs an approved template mapped to it on the WhatsApp tab. A trigger with no template
            simply does nothing.
          </p>
          {WHATSAPP_TRIGGERS.map((trigger) => (
            <label key={trigger} className="flex items-center gap-2 text-[12.5px]">
              <input
                type="checkbox"
                checked={Boolean(form.whatsappTriggers[trigger])}
                disabled={!canWrite}
                onChange={(e) =>
                  set("whatsappTriggers", { ...form.whatsappTriggers, [trigger]: e.target.checked })
                }
              />
              {WHATSAPP_TRIGGER_LABEL[trigger]}
            </label>
          ))}
        </div>
      </Card>

      {canWrite ? (
        <button type="submit" className="a-btn a-btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save integration settings"}
        </button>
      ) : null}
    </form>
  );
}

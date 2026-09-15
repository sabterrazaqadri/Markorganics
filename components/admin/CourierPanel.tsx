"use client";

import { useEffect, useState } from "react";
import type { PickupAddress } from "@/lib/courier/types";
import { SHIPMENT_STATUS_LABEL, type ShipmentStatus } from "@/lib/courier/status";
import { ConfirmButton, ErrorNote, useAction } from "./client-ui";
import {
  bookOrderAction,
  cancelShipmentAction,
  pickupAddressesAction,
  syncShipmentAction,
} from "@/app/admin/(panel)/orders/courier-actions";

export interface ShipmentView {
  id: string;
  provider: string;
  providerName: string;
  trackingNumber: string;
  status: string;
  rawStatus: string;
  labelUrl: string | null;
  cancelledAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  events: { id: string; status: string; rawStatus: string; message: string; occurredAt: string }[];
}

/**
 * Booking, tracking and cancelling from the order page.
 *
 * The city warning is shown before the button rather than after the failure:
 * an unmapped city is the most common reason a booking is refused, and it is
 * fixable in thirty seconds on the mapping page.
 */
export function CourierPanel({
  orderId,
  couriers,
  defaultCourier,
  shipment,
  cityMapped,
  city,
  trackingUrl,
  canWrite,
}: {
  orderId: string;
  couriers: { id: string; name: string; verified: boolean }[];
  defaultCourier: string;
  shipment: ShipmentView | null;
  cityMapped: boolean;
  city: string;
  trackingUrl: string;
  canWrite: boolean;
}) {
  const { pending, error, runAction, show } = useAction();
  const [provider, setProvider] = useState(defaultCourier);
  const [pickups, setPickups] = useState<PickupAddress[]>([]);
  const [pickup, setPickup] = useState("");
  const [loadingPickups, setLoadingPickups] = useState(false);

  // Pickup addresses come from the courier, so they are fetched per courier
  // rather than stored — a warehouse added this morning should just appear.
  useEffect(() => {
    if (shipment || !canWrite) return;
    let cancelled = false;
    setLoadingPickups(true);
    setPickups([]);
    void pickupAddressesAction(provider).then((result) => {
      if (cancelled) return;
      setLoadingPickups(false);
      if (result.ok) {
        setPickups(result.data);
        setPickup((current) => current || result.data[0]?.code || "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [provider, shipment, canWrite]);

  if (shipment && !shipment.cancelledAt) {
    const status = shipment.status as ShipmentStatus;
    return (
      <section className="a-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2>Shipment</h2>
          <span className="a-badge a-badge-info">{SHIPMENT_STATUS_LABEL[status] ?? shipment.status}</span>
        </div>
        <ErrorNote message={error} />

        <dl className="space-y-1 text-[12px]">
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--a-soft)]">Courier</dt>
            <dd>{shipment.providerName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--a-soft)]">Tracking</dt>
            <dd className="a-mono">{shipment.trackingNumber}</dd>
          </div>
          {shipment.rawStatus ? (
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--a-soft)]">Courier says</dt>
              <dd className="text-right">{shipment.rawStatus}</dd>
            </div>
          ) : null}
        </dl>

        {shipment.lastError ? (
          <p className="mt-2 text-[11.5px] text-[var(--a-danger)]">Last sync failed: {shipment.lastError}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-2">
          <a href={trackingUrl} target="_blank" rel="noopener" className="a-btn a-btn-xs">
            Customer tracking page ↗
          </a>
          {shipment.labelUrl ? (
            <a href={shipment.labelUrl} target="_blank" rel="noopener" className="a-btn a-btn-xs">
              Label ↗
            </a>
          ) : null}
          <button
            type="button"
            className="a-btn a-btn-xs"
            disabled={pending}
            onClick={() =>
              runAction(() => syncShipmentAction(shipment.id, orderId), {
                onDone: (data) =>
                  show(
                    data.changed
                      ? `Now ${SHIPMENT_STATUS_LABEL[data.status as ShipmentStatus] ?? data.status}`
                      : "No change since the last check",
                  ),
              })
            }
          >
            {pending ? "Checking…" : "Refresh status"}
          </button>
          {canWrite ? (
            <ConfirmButton
              className="a-btn a-btn-xs a-btn-danger"
              confirmLabel="Yes, cancel it"
              disabled={pending}
              onConfirm={() =>
                runAction(() => cancelShipmentAction(shipment.id, orderId), { success: "Shipment cancelled" })
              }
            >
              Cancel shipment
            </ConfirmButton>
          ) : null}
        </div>

        {shipment.events.length ? (
          <ol className="mt-3 space-y-1 border-t border-[var(--a-border)] pt-2 text-[11.5px]">
            {[...shipment.events]
              .reverse()
              .slice(0, 6)
              .map((event) => (
                <li key={event.id} className="flex justify-between gap-2">
                  <span>{SHIPMENT_STATUS_LABEL[event.status as ShipmentStatus] ?? event.rawStatus}</span>
                  <time className="shrink-0 text-[var(--a-soft)]" dateTime={event.occurredAt}>
                    {new Date(event.occurredAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      timeZone: "Asia/Karachi",
                    })}
                  </time>
                </li>
              ))}
          </ol>
        ) : null}
      </section>
    );
  }

  return (
    <section className="a-card p-3">
      <h2 className="mb-2">Book with a courier</h2>
      <ErrorNote message={error} />

      {shipment?.cancelledAt ? (
        <p className="a-hint mb-2">
          A previous shipment ({shipment.trackingNumber}) was cancelled. Booking again creates a new one.
        </p>
      ) : null}

      {!canWrite ? (
        <p className="text-[12px] text-[var(--a-soft)]">Your role cannot book shipments.</p>
      ) : (
        <div className="space-y-2">
          <div>
            <label htmlFor="courier-provider" className="a-label">
              Courier
            </label>
            <select
              id="courier-provider"
              className="a-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.verified ? "" : " (unverified)"}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="courier-pickup" className="a-label">
              Pickup address
            </label>
            {loadingPickups ? (
              <p className="a-hint">Loading from the courier…</p>
            ) : pickups.length === 0 ? (
              <input
                id="courier-pickup"
                className="a-input"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="Pickup address code"
              />
            ) : (
              <select id="courier-pickup" className="a-select" value={pickup} onChange={(e) => setPickup(e.target.value)}>
                {pickups.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label} — {p.city}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!cityMapped ? (
            <p className="rounded border border-[#e6cfa0] bg-[var(--a-warn-bg)] px-2 py-1.5 text-[11.5px] text-[var(--a-warn)]">
              <strong>{city} is not mapped</strong> for this courier, so the booking will be refused. Map it under
              Integrations &rarr; City mapping first.
            </p>
          ) : null}

          <button
            type="button"
            className="a-btn a-btn-primary w-full"
            disabled={pending}
            onClick={() =>
              runAction(() => bookOrderAction({ orderId, provider, pickupAddressCode: pickup }), {
                onDone: (data) =>
                  show(`Booked${data.dryRun ? " (dry run)" : ""}. Tracking ${data.trackingNumber}`),
              })
            }
          >
            {pending ? "Booking…" : "Book shipment"}
          </button>
          <p className="a-hint">
            Booking stores the tracking number, moves the order to Shipped and adds a timeline entry.
          </p>
        </div>
      )}
    </section>
  );
}

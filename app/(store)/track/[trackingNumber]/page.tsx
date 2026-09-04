import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { getShipmentByTracking, shipmentTimeline } from "@/lib/courier/shipments";
import { courierName } from "@/lib/courier";
import { SHIPMENT_STATUS_PUBLIC, isTerminal, type ShipmentStatus } from "@/lib/courier/status";
import { WHATSAPP_NUMBER } from "@/config/commerce";

/**
 * MARK's own tracking page.
 *
 * The customer is never sent to the courier's website: the timeline is built
 * from the events already stored against the shipment, so it stays on brand,
 * stays readable, and keeps working when the courier's own portal is down.
 *
 * Deliberately shows no address, no phone number and no money — a tracking
 * number is a weak secret, so this page shows only what the person holding
 * the parcel already knows.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track your parcel",
  robots: { index: false, follow: false },
};

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Karachi",
});

export default async function TrackShipmentPage({ params }: { params: Promise<{ trackingNumber: string }> }) {
  const { trackingNumber } = await params;
  const clean = decodeURIComponent(trackingNumber).trim();
  if (!clean || clean.length > 64) notFound();

  const shipment = await getShipmentByTracking(clean);
  if (!shipment) notFound();

  const [[order], events] = await Promise.all([
    db
      .select({ orderNumber: orders.orderNumber, city: orders.city, itemCount: orders.itemCount })
      .from(orders)
      .where(eq(orders.id, shipment.orderId))
      .limit(1),
    shipmentTimeline(shipment.id),
  ]);

  const status = shipment.status as ShipmentStatus;
  const done = isTerminal(status);
  const waText = encodeURIComponent(`Hello, I am asking about parcel ${shipment.trackingNumber}.`);

  return (
    <div className="container-x py-8 md:py-12">
      <p className="text-sm font-medium text-band-care">{courierName(shipment.provider)}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl">{SHIPMENT_STATUS_PUBLIC[status] ?? "In progress"}</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Tracking number <strong className="font-semibold text-ink">{shipment.trackingNumber}</strong>
        {order ? (
          <>
            {" "}
            · order {order.orderNumber} · {order.itemCount} item{order.itemCount === 1 ? "" : "s"} to {order.city}
          </>
        ) : null}
      </p>

      <ol className="mt-8 border-l border-rule pl-5" aria-label="Parcel history">
        {events.length === 0 ? (
          <li className="pb-5 text-sm text-ink-soft">
            The courier has not scanned this parcel yet. Updates appear here as it moves.
          </li>
        ) : (
          [...events].reverse().map((event, index) => (
            <li key={event.id} className="relative pb-5">
              <span
                aria-hidden="true"
                className={`absolute -left-[26px] top-1 inline-block h-3 w-3 rounded-full ${
                  index === 0 ? "bg-band-care" : "border border-rule bg-white"
                }`}
              />
              <p className={`text-sm ${index === 0 ? "font-semibold" : ""}`}>
                {SHIPMENT_STATUS_PUBLIC[event.status as ShipmentStatus] ?? event.rawStatus}
              </p>
              <p className="text-xs text-ink-soft">
                <time dateTime={event.occurredAt.toISOString()}>{DATE_FMT.format(event.occurredAt)}</time>
                {event.location ? ` · ${event.location}` : ""}
                {event.message ? ` · ${event.message}` : ""}
              </p>
            </li>
          ))
        )}
      </ol>

      {!done ? (
        <p className="rounded border border-rule bg-white px-4 py-3 text-sm text-ink-soft">
          Cash on delivery: please keep the exact amount ready for the rider. If nobody is home, the courier tries again
          the next working day.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`} className="btn btn-secondary" rel="noopener">
          Ask on WhatsApp
        </a>
        <Link href="/track" className="btn btn-secondary">
          Track a different order
        </Link>
        <Link href="/products" className="btn btn-primary">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

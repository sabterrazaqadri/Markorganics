import { requirePermission } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { getStoreSettings } from "@/lib/settings";
import { getCourier } from "@/lib/courier";
import { bookingsOn } from "@/lib/courier/shipments";
import { buildLoadsheet } from "@/lib/courier/loadsheet";

/**
 * A day's bookings as a signable PDF.
 *
 *   /api/admin/loadsheet?provider=postex&day=2026-09-03
 *
 * Behind the admin middleware, and behind orders:read on top of it.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const ctx = await requirePermission("orders:read");
  const url = new URL(request.url);

  const provider = url.searchParams.get("provider") ?? "postex";
  if (!getCourier(provider)) {
    return new Response(`Unknown courier "${provider}".`, { status: 400 });
  }

  const dayParam = url.searchParams.get("day");
  const day = dayParam ? new Date(`${dayParam}T00:00:00+05:00`) : new Date();
  if (Number.isNaN(day.getTime())) return new Response("Bad date.", { status: 400 });

  const [shipments, store] = await Promise.all([bookingsOn(provider, day), getStoreSettings()]);
  const pdf = buildLoadsheet({ provider, day, storeName: store.name, shipments });

  await audit(ctx, {
    action: "courier.loadsheet",
    entityType: "shipment",
    entityLabel: `${provider} ${day.toISOString().slice(0, 10)}`,
    after: { parcels: shipments.length },
  });

  const filename = `loadsheet-${provider}-${day.toISOString().slice(0, 10)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

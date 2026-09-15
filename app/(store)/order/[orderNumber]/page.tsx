import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNumber } from "@/lib/queries/orders";
import { normalizeOrderNumber } from "@/lib/order-number";
import { OrderDetails } from "@/components/order/OrderDetails";
import { OrderUpsell, type UpsellOffer } from "@/components/order/OrderUpsell";
import { TrackEvent } from "@/components/analytics/TrackEvent";
import { eventIdFor } from "@/lib/analytics/event-id";
import { WhatsAppLink } from "@/components/analytics/WhatsAppLink";
import { getDeliverySettings, getStoreSettings } from "@/lib/settings";
import { getActiveProducts } from "@/lib/queries/products";
import { POST_PURCHASE_WINDOW_MS } from "@/config/commerce";
import { canAddToOrder } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ orderNumber: string }>;
}

/**
 * Three things the customer has not got yet, bestsellers first, cheapest
 * first within that, never a bundle. Real prices from the catalogue.
 */
async function upsellOffers(exclude: Set<string>): Promise<UpsellOffer[]> {
  const products = await getActiveProducts();
  const offers: UpsellOffer[] = [];
  const ranked = [...products]
    .filter((p) => !p.isBundle)
    .sort((a, b) => Number(b.isBestseller) - Number(a.isBestseller) || a.sortOrder - b.sortOrder);
  for (const p of ranked) {
    if (exclude.has(p.slug)) continue;
    const v = [...p.variants].filter((v) => v.stock > 0).sort((a, b) => a.pricePaisa - b.pricePaisa)[0];
    if (!v) continue;
    offers.push({
      variantId: v.id,
      productSlug: p.slug,
      productName: p.name,
      variantLabel: v.label,
      sku: v.sku,
      pricePaisa: v.pricePaisa,
      compareAtPaisa: v.compareAtPaisa,
      image: p.images[0] ?? "",
      blurb: p.shortDescription,
    });
    if (offers.length === 3) break;
  }
  return offers;
}

export default async function OrderPage({ params }: Props) {
  const { orderNumber } = await params;
  const { orderNumberPrefix } = await getStoreSettings();
  const normalized = normalizeOrderNumber(orderNumber, orderNumberPrefix);
  if (!normalized) notFound();
  const order = await getOrderByNumber(normalized);
  if (!order) notFound();

  const age = Date.now() - order.createdAt.getTime();
  const justPlaced = age < 5 * 60 * 1000 && order.status === "pending";
  const inWindow = age < POST_PURCHASE_WINDOW_MS && order.status === "pending";
  const mayAdd = inWindow && (await canAddToOrder(order.orderNumber, order.id));

  let offers: UpsellOffer[] = [];
  let toFree = 0;
  if (mayAdd) {
    const delivery = await getDeliverySettings();
    offers = await upsellOffers(new Set(order.items.map((i) => i.productSlug)));
    toFree = order.deliveryPaisa > 0 ? Math.max(0, delivery.freeThresholdPaisa - order.subtotalPaisa) : 0;
  }

  return (
    <div className="container-x py-8 md:py-12">
      <p className="text-sm font-medium text-band-care">{justPlaced ? "Order placed" : "Order"}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl">{order.orderNumber}</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        {justPlaced
          ? "We will call your number to confirm before dispatch. Keep this order number for tracking."
          : "Here is the latest on your order."}
      </p>
      {/* The server fires the same Purchase from the job runner with this exact
          event id, so whichever arrives first is the one that counts. */}
      {justPlaced ? (
        <TrackEvent
          event="purchase"
          eventId={eventIdFor("purchase", order.id)}
          valuePaisa={order.totalPaisa}
          orderNumber={order.orderNumber}
          items={order.items.map((i) => ({
            sku: i.sku,
            name: `${i.productName} ${i.variantLabel}`.trim(),
            quantity: i.quantity,
            pricePaisa: i.unitPricePaisa,
          }))}
        />
      ) : null}
      {mayAdd ? (
        <OrderUpsell
          orderNumber={order.orderNumber}
          offers={offers}
          minutesLeft={Math.max(1, Math.round((POST_PURCHASE_WINDOW_MS - age) / 60000))}
          toFreeDeliveryPaisa={toFree}
        />
      ) : null}
      <OrderDetails order={order} />
      <div className="mt-8 flex flex-wrap gap-3">
        <WhatsAppLink text={`Hello, I have a question about order ${order.orderNumber}.`} className="btn btn-secondary">
          Ask on WhatsApp
        </WhatsAppLink>
        <Link href="/products" className="btn btn-primary">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}

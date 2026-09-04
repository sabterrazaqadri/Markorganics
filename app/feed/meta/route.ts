import { getActiveProducts } from "@/lib/queries/products";
import { buildProductFeed } from "@/lib/feeds";
import { getDeliverySettings } from "@/lib/settings";

export const revalidate = 3600;

export async function GET() {
  const [products, delivery] = await Promise.all([getActiveProducts(), getDeliverySettings()]);
  const xml = buildProductFeed(products, "meta", { deliveryPaisa: delivery.flatRatePaisa });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}

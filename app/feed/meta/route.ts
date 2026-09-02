import { getActiveProducts } from "@/lib/queries/products";
import { buildProductFeed } from "@/lib/feeds";

export const revalidate = 3600;

export async function GET() {
  const products = await getActiveProducts();
  const xml = buildProductFeed(products, "meta");
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}

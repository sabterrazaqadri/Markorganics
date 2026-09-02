import { ImageResponse } from "next/og";
import { getProductBySlug } from "@/lib/queries/products";
import { FAMILIES } from "@/lib/catalog";
import { formatPKR } from "@/lib/money";
import { BRAND_NAME } from "@/config/commerce";

export const alt = "Product";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  const band = product ? FAMILIES[product.family].hex : "#C1841B";
  const name = product?.name ?? BRAND_NAME;
  const price = product ? formatPKR(Math.min(...product.variants.map((v) => v.pricePaisa))) : "";
  const desc = product?.shortDescription ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FCFBF8",
          color: "#17150F",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ height: 28, background: band }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "72px 80px", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#5A5449" }}>{BRAND_NAME}</div>
          <div style={{ fontSize: 80, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05, marginTop: 16 }}>{name}</div>
          <div style={{ fontSize: 32, color: "#5A5449", marginTop: 24, maxWidth: 1000 }}>{desc}</div>
          <div style={{ fontSize: 40, fontWeight: 700, marginTop: 36, color: band }}>{price}</div>
        </div>
      </div>
    ),
    size,
  );
}

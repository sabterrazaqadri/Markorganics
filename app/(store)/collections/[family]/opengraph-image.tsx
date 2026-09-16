import { ImageResponse } from "next/og";
import { FAMILIES, FAMILY_ORDER, isFamily } from "@/lib/catalog";
import { COLLECTIONS } from "@/lib/collections";
import { BRAND_NAME } from "@/config/commerce";

export const alt = "MARKORGANIC collection";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return FAMILY_ORDER.map((family) => ({ family }));
}

export default async function Image({ params }: { params: Promise<{ family: string }> }) {
  const { family } = await params;
  const key = isFamily(family) ? family : "oils";
  const fam = FAMILIES[key];
  const copy = COLLECTIONS[key];

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
        <div style={{ height: 32, background: fam.hex }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "70px 80px", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#5A5449", letterSpacing: -0.5 }}>{BRAND_NAME}</div>
          <div style={{ fontSize: 74, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05, marginTop: 18, maxWidth: 1000 }}>
            {copy.heading}
          </div>
          <div style={{ fontSize: 31, color: "#5A5449", marginTop: 24, maxWidth: 940 }}>{copy.standfirst}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 40 }}>
            <div style={{ width: 54, height: 12, background: fam.hex }} />
            <div style={{ fontSize: 27, fontWeight: 700, color: fam.hex }}>{copy.ogLine}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

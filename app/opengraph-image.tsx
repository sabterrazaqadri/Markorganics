import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/config/commerce";

export const alt = `${BRAND_NAME} - oils, balms and neel for Pakistani homes`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
        <div style={{ display: "flex", height: 28 }}>
          <div style={{ flex: 1, background: "#C1841B" }} />
          <div style={{ flex: 1, background: "#2E6A65" }} />
          <div style={{ flex: 1, background: "#2C3C8C" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "72px 80px", flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, color: "#5A5449" }}>{BRAND_NAME}</div>
          <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05, marginTop: 20, maxWidth: 980 }}>
            Honest oils, balms and neel for every Pakistani home.
          </div>
          <div style={{ fontSize: 30, color: "#5A5449", marginTop: 28 }}>Cash on delivery, nationwide.</div>
        </div>
      </div>
    ),
    size,
  );
}

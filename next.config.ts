import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Admin uploads go to Vercel Blob in production; see lib/admin/storage.ts.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [64, 96, 128, 200, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    optimizePackageImports: ["@react-three/drei"],
  },
  // Old query-string family URLs are already shared and indexed, so keep them working.
  async redirects() {
    return (["oils", "relief", "home"] as const).map((family) => ({
      source: "/products",
      has: [{ type: "query" as const, key: "family", value: family }],
      // Next always forwards the matched query param to the destination, so the
      // landing URL is /collections/<family>?family=<family>. That page sets its
      // canonical to the clean /collections/<family>, which is what gets indexed.
      destination: `/collections/${family}`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/:all*(webp|jpg|png|svg|glb|wasm|hdr)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { BRAND_NAME, SITE_URL } from "@/config/commerce";
import { ToastViewport } from "@/components/ui/Toast";
import { CartHydration } from "@/components/cart/CartHydration";
import { getStorefrontIntegrations } from "@/lib/integrations/config";
import { LangScript } from "@/components/i18n/LangScript";
import "./globals.css";

// Variable fonts committed to the repo (latin subset), self-hosted by next/font.
// adjustFontFallback generates a size-adjusted fallback so text does not shift when the font loads.
const archivo = localFont({
  src: "./fonts/archivo.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-archivo",
  adjustFontFallback: "Arial",
  preload: true,
});

const interTight = localFont({
  src: "./fonts/inter-tight.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter-tight",
  adjustFontFallback: "Arial",
  preload: true,
});

const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} - Hair oils, pain relief balm and liquid neel`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "Everyday Pakistani household and personal-care products: cold-pressed hair oils, MARK Balm and Iodex for pain relief, and MARK Liquid Neel. Cash on delivery across Pakistan.",
  applicationName: BRAND_NAME,
  openGraph: {
    type: "website",
    siteName: BRAND_NAME,
    locale: "en_PK",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

/**
 * Search Console's verification tag comes from settings rather than a
 * constant, so claiming the domain does not need a deploy.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { searchConsoleToken } = await pixelIds();
  if (!searchConsoleToken) return baseMetadata;
  return { ...baseMetadata, verification: { google: searchConsoleToken } };
}

/**
 * The root layout is the one place every page passes through (including
 * `/admin/**`, which nests inside it with no `<html>` of its own), so it must
 * not be able to fail. A database that is momentarily unreachable should cost
 * the shop its pixels, never its storefront.
 *
 * The pixels themselves are NOT rendered here — only the Search Console
 * verification tag is read from this. `<Analytics>` mounts in
 * `app/(store)/layout.tsx` so it never loads on `/admin/**`.
 */
async function pixelIds() {
  try {
    return await getStorefrontIntegrations();
  } catch (err) {
    console.error("could not read integration ids; rendering without pixels", err);
    return { metaPixelId: "", ga4MeasurementId: "", tiktokPixelCode: "", searchConsoleToken: "" };
  }
}

export const viewport: Viewport = {
  themeColor: "#FCFBF8",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivo.variable} ${interTight.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-paper text-ink">
        <LangScript />
        {children}
        <CartHydration />
        <ToastViewport />
      </body>
    </html>
  );
}

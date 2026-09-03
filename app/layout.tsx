import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { BRAND_NAME, SITE_URL } from "@/config/commerce";
import { ToastViewport } from "@/components/ui/Toast";
import { CartHydration } from "@/components/cart/CartHydration";
import { Analytics } from "@/components/analytics/Analytics";
import { getStorefrontIntegrations } from "@/lib/integrations/config";
import { DEFAULT_SETTINGS, getIntegrationSettings } from "@/lib/settings";
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
 * The root layout is the one place every page passes through, so it must not
 * be able to fail. A database that is momentarily unreachable should cost the
 * shop its pixels, never its storefront.
 */
async function pixelIds() {
  try {
    return await getStorefrontIntegrations();
  } catch (err) {
    console.error("could not read integration ids; rendering without pixels", err);
    return { metaPixelId: "", ga4MeasurementId: "", tiktokPixelCode: "", searchConsoleToken: "" };
  }
}

async function consentSetting(): Promise<boolean> {
  try {
    return (await getIntegrationSettings()).consentBanner;
  } catch {
    // Asking for consent we do not need is the harmless failure; loading a
    // pixel without it is not.
    return DEFAULT_SETTINGS.integrations.consentBanner;
  }
}

export const viewport: Viewport = {
  themeColor: "#FCFBF8",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [ids, requireConsent] = await Promise.all([pixelIds(), consentSetting()]);

  return (
    <html lang="en" className={`${archivo.variable} ${interTight.variable}`}>
      <body className="min-h-dvh bg-paper text-ink">
        {children}
        <CartHydration />
        <ToastViewport />
        <Analytics
          ids={{
            metaPixelId: ids.metaPixelId,
            ga4MeasurementId: ids.ga4MeasurementId,
            tiktokPixelCode: ids.tiktokPixelCode,
          }}
          requireConsent={requireConsent}
        />
      </body>
    </html>
  );
}
